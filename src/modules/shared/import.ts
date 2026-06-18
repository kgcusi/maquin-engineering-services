import type { z } from "zod";

// Shared bulk-import engine for the directory modules (clients, suppliers,
// employees). The flow is: parse a CSV/XLSX file → map its headers onto a module
// `ImportDescriptor` → normalize + validate each row with the module's EXISTING
// create schema → hand the valid rows to a guarded bulk Server Action.
//
// Client-safe: no `db`, no `next/*`. `exceljs` is the locked-stack spreadsheet
// lib (docs/16) and is **dynamically imported** so it never lands in the main
// bundle — only when a user actually parses or downloads a template. CSV is
// handled in-house (no Node streams in the browser, which ExcelJS's CSV reader
// needs).

export const IMPORT_ROW_LIMIT = 500;

/** A spreadsheet column mapped onto one field of the module's create schema. */
export type ColumnSpec<T> = {
  /** The create-schema field this column feeds. */
  key: keyof T & string;
  /** Canonical header — shown in the template and the column reference. */
  header: string;
  /** Other accepted header spellings (matched case/spacing/punctuation-insensitive). */
  aliases?: string[];
  required?: boolean;
  /** Plain-language explanation shown in the column reference. */
  description: string;
  /** Example value used to seed the downloadable template. */
  example: string;
  /** Turn a raw cell string into what `rowSchema` expects. Default: trim. */
  normalize?: (cell: string) => string;
};

export type ImportDescriptor<T> = {
  /** Capitalized singular, e.g. "Client". */
  entity: string;
  /** Lowercase plural, e.g. "clients". */
  noun: string;
  columns: ColumnSpec<T>[];
  /** The module's create schema — the single source of truth for validity. */
  rowSchema: z.ZodType<T>;
  /** Field used for the soft duplicate warning (e.g. "name" / "fullName"). */
  dedupeKey: keyof T & string;
};

export type ParsedSheet = { headers: string[]; rows: string[][] };

export type RowStatus = "ok" | "error" | "duplicate";

export type RowError = { field: string; message: string };

export type PreviewRow<T> = {
  /** 1-based data-row number (header excluded) for human-facing messages. */
  index: number;
  /** Field values after header-mapping + normalization (display + commit source). */
  values: Record<string, string>;
  /** The validated row, or null when it failed validation. */
  parsed: T | null;
  status: RowStatus;
  errors: RowError[];
  /** Soft warning: the dedupe key already exists (in the data or earlier in the file). */
  duplicate: boolean;
};

export type ImportPreview<T> = {
  headers: string[];
  /** Required columns whose header was not found in the file. */
  missingRequired: string[];
  rows: PreviewRow<T>[];
  counts: { total: number; ready: number; errors: number; duplicates: number };
};

// Headers/keys are compared with punctuation and case stripped, so "Full Name",
// "full_name" and "fullname" all match the same column.
const canon = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// ── Cell coercion ───────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ExcelJS cell values are a union (number | string | Date | rich-text | formula
// result | hyperlink | …). Flatten any of them to a display string.
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return toISODate(value);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) {
      return (v.richText as { text?: string }[]).map((r) => r.text ?? "").join("");
    }
    if ("text" in v) return String(v.text ?? "");
    if ("result" in v) return cellToString(v.result);
    if ("hyperlink" in v) return String(v.text ?? v.hyperlink ?? "");
    if ("error" in v) return "";
    return "";
  }
  return String(value);
}

// ── Parsing ───────────────────────────────────────────────────────────────────

function matrixToSheet(matrix: string[][]): ParsedSheet {
  const nonEmpty = matrix.filter((r) => r.some((c) => c.trim() !== ""));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const [headerRow, ...rest] = nonEmpty;
  return { headers: headerRow.map((h) => h.trim()), rows: rest };
}

// A correct CSV reader: handles quoted fields, escaped quotes (""), and embedded
// commas/newlines. Excel exports valid RFC-4180 CSV, so this covers the cases a
// naive split would mangle.
function parseCsvToMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

export function parseCsv(text: string): ParsedSheet {
  return matrixToSheet(parseCsvToMatrix(text.replace(/^﻿/, "")));
}

export function isCsvFile(file: File): boolean {
  return /\.csv$/i.test(file.name) || file.type === "text/csv";
}

export async function parseWorkbook(file: File): Promise<ParsedSheet> {
  if (isCsvFile(file)) return parseCsv(await file.text());

  const buffer = await file.arrayBuffer();
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    // `row.values` is 1-based (index 0 is unused); empty middle cells are holes.
    const values = row.values as unknown[];
    const cells: string[] = [];
    for (let i = 1; i < values.length; i++) cells[i - 1] = cellToString(values[i]);
    matrix.push(cells);
  });
  return matrixToSheet(matrix);
}

// ── Normalizers (reusable across descriptors) ──────────────────────────────────

/** Build a label/code resolver from a lookup set: accepts the code or the human
 *  label (case/spacing-insensitive) and returns the canonical code. Unknown input
 *  passes through unchanged so the schema's enum check produces the error. */
export function codeResolver(
  entries: readonly { code: string; label: string }[],
): (cell: string) => string {
  const map = new Map<string, string>();
  for (const e of entries) {
    map.set(canon(e.code), e.code);
    map.set(canon(e.label), e.code);
  }
  return (cell) => {
    const s = cell.trim();
    if (!s) return "";
    return map.get(canon(s)) ?? s;
  };
}

/** Normalize a date cell to YYYY-MM-DD. XLSX date cells already arrive ISO; this
 *  rescues common CSV spellings (M/D/YYYY, YYYY-M-D, 2-digit years). Unrecognized
 *  input passes through so the schema's date check produces the error. */
export function normalizeDate(cell: string): string {
  const s = cell.trim();
  if (!s || /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (!m) return s;
  const [, a, b, c] = m;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (a.length === 4) return `${a}-${pad(Number(b))}-${pad(Number(c))}`;
  let month = Number(a);
  let day = Number(b);
  if (month > 12 && day <= 12) [month, day] = [day, month];
  const year = c.length === 2 ? `20${c}` : c;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Strip thousands separators, currency symbols and whitespace from an amount. */
export const normalizeAmount = (cell: string): string => cell.trim().replace(/[,\s₱$]/g, "");

// ── Mapping + validation ────────────────────────────────────────────────────

export function mapAndValidate<T>(
  sheet: ParsedSheet,
  descriptor: ImportDescriptor<T>,
  existingKeys: Iterable<string>,
): ImportPreview<T> {
  const headerIndex = new Map<string, number>();
  sheet.headers.forEach((h, i) => {
    const key = canon(h);
    if (key && !headerIndex.has(key)) headerIndex.set(key, i);
  });

  const colIndex = new Map<string, number>();
  const missingRequired: string[] = [];
  for (const col of descriptor.columns) {
    const candidates = [col.header, ...(col.aliases ?? [])].map(canon);
    let idx = -1;
    for (const candidate of candidates) {
      const found = headerIndex.get(candidate);
      if (found !== undefined) {
        idx = found;
        break;
      }
    }
    colIndex.set(col.key, idx);
    if (idx === -1 && col.required) missingRequired.push(col.header);
  }

  const existing = new Set<string>();
  for (const k of existingKeys) {
    const c = canon(k);
    if (c) existing.add(c);
  }
  const seenInFile = new Set<string>();

  const rows: PreviewRow<T>[] = [];
  let ready = 0;
  let errors = 0;
  let duplicates = 0;

  sheet.rows.forEach((raw, i) => {
    const values: Record<string, string> = {};
    for (const col of descriptor.columns) {
      const idx = colIndex.get(col.key) ?? -1;
      const cell = idx >= 0 ? (raw[idx] ?? "") : "";
      values[col.key] = (col.normalize ?? ((c) => c.trim()))(cell);
    }

    const result = descriptor.rowSchema.safeParse(values);
    const rowErrors: RowError[] = [];
    let parsed: T | null = null;
    if (result.success) {
      parsed = result.data;
    } else {
      for (const issue of result.error.issues) {
        rowErrors.push({ field: String(issue.path[0] ?? ""), message: issue.message });
      }
    }

    let duplicate = false;
    const keyValue = values[descriptor.dedupeKey];
    if (parsed && keyValue) {
      const key = canon(keyValue);
      if (existing.has(key) || seenInFile.has(key)) duplicate = true;
      seenInFile.add(key);
    }

    let status: RowStatus = "ok";
    if (!parsed) {
      status = "error";
      errors++;
    } else if (duplicate) {
      status = "duplicate";
      duplicates++;
    } else {
      ready++;
    }

    rows.push({ index: i + 1, values, parsed, status, errors: rowErrors, duplicate });
  });

  return {
    headers: sheet.headers,
    missingRequired,
    rows,
    counts: { total: rows.length, ready, errors, duplicates },
  };
}

// ── Template + error-report generation ─────────────────────────────────────────

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsvBlob(rows: string[][]): Blob {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  // BOM so Excel opens UTF-8 (e.g. ₱) correctly.
  return new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
}

export async function buildTemplate<T>(descriptor: ImportDescriptor<T>): Promise<Blob> {
  const headers = descriptor.columns.map((c) => c.header);
  const example = descriptor.columns.map((c) => c.example);

  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(descriptor.entity);
  sheet.addRow(headers);
  sheet.addRow(example);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((col, i) => {
    col.width = Math.max(14, (headers[i]?.length ?? 0) + 2);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** CSV of the rows that failed validation, with a trailing column of reasons —
 *  so the user can fix them offline and re-upload. */
export function buildErrorReport<T>(
  descriptor: ImportDescriptor<T>,
  preview: ImportPreview<T>,
): Blob {
  const headers = [...descriptor.columns.map((c) => c.header), "Errors"];
  const rows = preview.rows
    .filter((r) => r.status === "error")
    .map((r) => [
      ...descriptor.columns.map((c) => r.values[c.key] ?? ""),
      r.errors.map((e) => `${e.field}: ${e.message}`).join("; "),
    ]);
  return toCsvBlob([headers, ...rows]);
}
