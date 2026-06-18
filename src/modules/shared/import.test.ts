import { describe, expect, it } from "vitest";

import { EMPLOYMENT_TYPES } from "@/lib/lookups";
import { clientImportDescriptor } from "@/modules/clients/import";
import { employeeImportDescriptor } from "@/modules/employees/import";

import {
  buildErrorReport,
  codeResolver,
  mapAndValidate,
  normalizeAmount,
  normalizeDate,
  parseCsv,
} from "./import";

describe("parseCsv", () => {
  it("reads headers + rows and handles quoted commas", () => {
    const sheet = parseCsv('Name,Address\nAcme,"12 Ayala Ave, Makati"\n');
    expect(sheet.headers).toEqual(["Name", "Address"]);
    expect(sheet.rows).toEqual([["Acme", "12 Ayala Ave, Makati"]]);
  });

  it("ignores fully blank lines", () => {
    const sheet = parseCsv("Name\nAcme\n\n\n");
    expect(sheet.rows).toEqual([["Acme"]]);
  });
});

describe("normalizeDate", () => {
  it("passes through ISO dates", () => {
    expect(normalizeDate("2026-01-15")).toBe("2026-01-15");
  });
  it("converts M/D/YYYY", () => {
    expect(normalizeDate("1/15/2026")).toBe("2026-01-15");
    expect(normalizeDate("01/05/2026")).toBe("2026-01-05");
  });
  it("swaps when the first part can only be a day", () => {
    expect(normalizeDate("15/1/2026")).toBe("2026-01-15");
  });
  it("handles a leading 4-digit year with slashes", () => {
    expect(normalizeDate("2026/1/5")).toBe("2026-01-05");
  });
  it("leaves blanks and junk for the schema to judge", () => {
    expect(normalizeDate("")).toBe("");
    expect(normalizeDate("next monday")).toBe("next monday");
  });
});

describe("normalizeAmount", () => {
  it("strips separators, currency and spaces", () => {
    expect(normalizeAmount("1,200.50")).toBe("1200.50");
    expect(normalizeAmount("₱ 850.00")).toBe("850.00");
  });
});

describe("codeResolver", () => {
  const resolve = codeResolver(EMPLOYMENT_TYPES);
  it("accepts the human label (any case/spacing)", () => {
    expect(resolve("Project-based")).toBe("PROJECT_BASED");
    expect(resolve("regular")).toBe("REGULAR");
  });
  it("accepts the raw code", () => {
    expect(resolve("PROJECT_BASED")).toBe("PROJECT_BASED");
  });
  it("passes unknown/blank through unchanged", () => {
    expect(resolve("freelance")).toBe("freelance");
    expect(resolve("")).toBe("");
  });
});

describe("mapAndValidate — clients", () => {
  it("matches headers case-insensitively and via aliases", () => {
    const sheet = parseCsv("NAME,Contact,Email Address\nAcme Corp,Maria,maria@acme.com\n");
    const preview = mapAndValidate(sheet, clientImportDescriptor, []);
    expect(preview.missingRequired).toEqual([]);
    expect(preview.counts).toMatchObject({ total: 1, ready: 1, errors: 0, duplicates: 0 });
    expect(preview.rows[0].parsed).toMatchObject({
      name: "Acme Corp",
      contactPerson: "Maria",
      email: "maria@acme.com",
    });
  });

  it("flags an invalid email as an error row", () => {
    const sheet = parseCsv("Name,Email\nBad Inc,not-an-email\n");
    const preview = mapAndValidate(sheet, clientImportDescriptor, []);
    expect(preview.counts.errors).toBe(1);
    expect(preview.rows[0].status).toBe("error");
    expect(preview.rows[0].errors[0].field).toBe("email");
    expect(preview.rows[0].parsed).toBeNull();
  });

  it("reports a missing required column", () => {
    const sheet = parseCsv("Title,Email\nX,x@y.com\n");
    const preview = mapAndValidate(sheet, clientImportDescriptor, []);
    expect(preview.missingRequired).toEqual(["Name"]);
    expect(preview.rows[0].status).toBe("error");
  });

  it("warns on duplicates against existing data and within the file", () => {
    const sheet = parseCsv("Name\nAcme Corp\nBeta\nacme corp\n");
    const preview = mapAndValidate(sheet, clientImportDescriptor, ["Beta"]);
    // row 0: new, row 1: matches existing "Beta", row 2: matches row 0 (case-insensitive)
    expect(preview.rows[0].status).toBe("ok");
    expect(preview.rows[1].status).toBe("duplicate");
    expect(preview.rows[2].status).toBe("duplicate");
    expect(preview.counts).toMatchObject({ ready: 1, duplicates: 2 });
  });
});

describe("mapAndValidate — employees", () => {
  it("normalizes enum labels, dates, amounts and defaults rate basis", () => {
    const sheet = parseCsv(
      "Full Name,Employment Type,Pay Rate,Rate Basis,Date Hired\n" +
        'Pedro Reyes,Project-based,"1,200.50",Monthly,1/15/2026\n' +
        "Maria Cruz,,,,\n",
    );
    const preview = mapAndValidate(sheet, employeeImportDescriptor, []);
    expect(preview.counts).toMatchObject({ total: 2, ready: 2, errors: 0 });
    expect(preview.rows[0].parsed).toMatchObject({
      fullName: "Pedro Reyes",
      employmentType: "PROJECT_BASED",
      rate: "1200.50",
      rateUnit: "MONTHLY",
      dateHired: "2026-01-15",
    });
    // blank rate basis falls back to the DB/form default
    expect(preview.rows[1].parsed).toMatchObject({ fullName: "Maria Cruz", rateUnit: "DAILY" });
  });
});

describe("buildErrorReport", () => {
  it("lists failed rows with their reasons", async () => {
    const sheet = parseCsv("Name,Email\nBad Inc,not-an-email\nGood Inc,good@x.com\n");
    const preview = mapAndValidate(sheet, clientImportDescriptor, []);
    const text = await buildErrorReport(clientImportDescriptor, preview).text();
    expect(text).toContain("Errors");
    expect(text).toContain("Bad Inc");
    expect(text).toContain("not-an-email");
    expect(text).not.toContain("Good Inc");
  });
});
