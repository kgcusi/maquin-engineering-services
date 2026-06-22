// Fixed, code-owned reference values — units, trades, and category families.
// These were once admin-editable System Settings lookup tables; they are now
// fixed in code (docs/17 addendum). NO server imports (no db, no next/headers),
// so this is safe to import from CLIENT components (forms, pickers) as well as
// server code and Server Action Zod schemas.
//
// Each set is the single source of truth for its `*_code` text column. Array
// order IS the display sort order (same convention as PERMISSION_KEYS). Adding a
// value is a one-line edit here — no migration, because the column is plain text
// validated against these codes.

type CodedEntry = { readonly code: string; readonly label: string };

// Codes as a Zod-ready tuple: `z.enum(UNIT_CODES)` in a module schema.
function codesOf<const T extends CodedEntry>(entries: readonly T[]): [T["code"], ...T["code"][]] {
  return entries.map((e) => e.code) as [T["code"], ...T["code"][]];
}

function labelLookup<T extends CodedEntry>(entries: readonly T[]) {
  const map = new Map(entries.map((e) => [e.code, e.label]));
  return (code: string | null | undefined): string => (code ? (map.get(code) ?? code) : "—");
}

// ── Units of measure (items.unit_code, *_line.unit_code, dsr_materials.unit_code) ──
// A focused construction set, not the full UN/CEFACT catalogue. `symbol` is the
// compact display token (m³, m²); `label` is the long form for pickers.
export const UNITS = [
  { code: "pcs", label: "Pieces", symbol: "pcs" },
  { code: "set", label: "Set", symbol: "set" },
  { code: "lot", label: "Lot", symbol: "lot" },
  { code: "pair", label: "Pair", symbol: "pair" },
  { code: "ls", label: "Lump Sum", symbol: "ls" },
  { code: "kg", label: "Kilogram", symbol: "kg" },
  { code: "g", label: "Gram", symbol: "g" },
  { code: "ton", label: "Metric Ton", symbol: "t" },
  { code: "bag", label: "Bag", symbol: "bag" },
  { code: "l", label: "Liter", symbol: "L" },
  { code: "ml", label: "Milliliter", symbol: "mL" },
  { code: "m", label: "Meter", symbol: "m" },
  { code: "cm", label: "Centimeter", symbol: "cm" },
  { code: "mm", label: "Millimeter", symbol: "mm" },
  { code: "m2", label: "Square Meter", symbol: "m²" },
  { code: "m3", label: "Cubic Meter", symbol: "m³" },
  { code: "ft", label: "Foot", symbol: "ft" },
  { code: "in", label: "Inch", symbol: "in" },
  { code: "sheet", label: "Sheet", symbol: "sheet" },
  { code: "roll", label: "Roll", symbol: "roll" },
  { code: "length", label: "Length", symbol: "length" },
  { code: "box", label: "Box", symbol: "box" },
  { code: "can", label: "Can", symbol: "can" },
  { code: "drum", label: "Drum", symbol: "drum" },
  { code: "hr", label: "Hour", symbol: "hr" },
  { code: "day", label: "Day", symbol: "day" },
  { code: "trip", label: "Trip", symbol: "trip" },
] as const;

export type UnitCode = (typeof UNITS)[number]["code"];
export const UNIT_CODES = codesOf(UNITS);
export const unitLabel = labelLookup(UNITS);

const UNIT_SYMBOLS = new Map<string, string>(UNITS.map((u) => [u.code, u.symbol]));
export function unitSymbol(code: string | null | undefined): string {
  return code ? (UNIT_SYMBOLS.get(code) ?? code) : "—";
}

// ── Employment types (employees.employment_type) ──────────────────────────────
export const EMPLOYMENT_TYPES = [
  { code: "REGULAR", label: "Regular" },
  { code: "PROBATIONARY", label: "Probationary" },
  { code: "PROJECT_BASED", label: "Project-based" },
  { code: "CONTRACTUAL", label: "Contractual" },
] as const;

export type EmploymentTypeCode = (typeof EMPLOYMENT_TYPES)[number]["code"];
export const EMPLOYMENT_TYPE_CODES = codesOf(EMPLOYMENT_TYPES);
export const employmentTypeLabel = labelLookup(EMPLOYMENT_TYPES);

// ── Pay-rate units (employees.rate_unit) — the basis a rate is quoted in ───────
export const RATE_UNITS = [
  { code: "DAILY", label: "Daily" },
  { code: "MONTHLY", label: "Monthly" },
  { code: "HOURLY", label: "Hourly" },
] as const;

export type RateUnitCode = (typeof RATE_UNITS)[number]["code"];
export const RATE_UNIT_CODES = codesOf(RATE_UNITS);
export const rateUnitLabel = labelLookup(RATE_UNITS);

// ── Trades / labor disciplines (dsr_manpower.trade_code) ───────────────────────
export const TRADES = [
  { code: "FOREMAN", label: "Foreman" },
  { code: "MASON", label: "Mason" },
  { code: "CARPENTER", label: "Carpenter" },
  { code: "REBAR", label: "Steelman / Rebar" },
  { code: "ELECTRICIAN", label: "Electrician" },
  { code: "PLUMBER", label: "Plumber" },
  { code: "WELDER", label: "Welder" },
  { code: "PAINTER", label: "Painter" },
  { code: "HEAVY_EQUIPMENT_OPERATOR", label: "Heavy Equipment Operator" },
  { code: "SURVEYOR", label: "Surveyor" },
  { code: "SAFETY_OFFICER", label: "Safety Officer" },
  { code: "LABORER", label: "Laborer / Helper" },
] as const;

export type TradeCode = (typeof TRADES)[number]["code"];
export const TRADE_CODES = codesOf(TRADES);
export const tradeLabel = labelLookup(TRADES);

// ── Project membership roles (project_members.role_on_project) — docs/17 §10.13 ─
// LEAD: one per project — a display/notification label, NOT a power level. MEMBER:
// many, all with equal scoped capability. INSPECTOR: scoped read access granted
// when an inspection is requested (the inspection module is deferred; the value
// ships now). Plain text validated against these codes — NOT a pg enum — per
// docs/17 §10.1, so membership never narrows a role's capabilities.
export const PROJECT_MEMBER_ROLES = [
  { code: "LEAD", label: "Lead Engineer" },
  { code: "MEMBER", label: "Member" },
  { code: "INSPECTOR", label: "Inspector" },
] as const;

export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number]["code"];
export const PROJECT_MEMBER_ROLE_CODES = codesOf(PROJECT_MEMBER_ROLES);
export const projectMemberRoleLabel = labelLookup(PROJECT_MEMBER_ROLES);

// ── Cost categories — ONE set shared by budget_lines.category_code AND
// expenses.category_code, so budget-vs-actual reconciles on a single vocabulary. ──
export const COST_CATEGORIES = [
  { code: "MATERIALS", label: "Materials" },
  { code: "LABOR", label: "Labor" },
  { code: "EQUIPMENT", label: "Equipment" },
  { code: "SUBCONTRACTOR", label: "Subcontractor" },
  { code: "PERMITS_AND_FEES", label: "Permits & Fees" },
  { code: "OVERHEAD", label: "Overhead" },
  { code: "OTHER", label: "Other" },
] as const;

export type CostCategoryCode = (typeof COST_CATEGORIES)[number]["code"];
export const COST_CATEGORY_CODES = codesOf(COST_CATEGORIES);
export const costCategoryLabel = labelLookup(COST_CATEGORIES);

// ── Cash-flow categories (cashflow_tx.category_code) — payment-type axis. ──
export const CASHFLOW_CATEGORIES = [
  { code: "CLIENT_PAYMENT", label: "Client Payment" },
  { code: "SUPPLIER_PAYMENT", label: "Supplier Payment" },
  { code: "EQUIPMENT_RENTAL", label: "Equipment Rental" },
  { code: "SUBCONTRACTOR", label: "Subcontractor" },
  { code: "PAYROLL", label: "Payroll" },
  { code: "RETENTION_RELEASE", label: "Retention Release" },
  { code: "OTHER", label: "Other" },
] as const;

export type CashflowCategoryCode = (typeof CASHFLOW_CATEGORIES)[number]["code"];
export const CASHFLOW_CATEGORY_CODES = codesOf(CASHFLOW_CATEGORIES);
export const cashflowCategoryLabel = labelLookup(CASHFLOW_CATEGORIES);

// ── Inventory / material categories (items.category_code) — material-type axis. ──
export const INVENTORY_CATEGORIES = [
  { code: "CEMENT", label: "Cement" },
  { code: "AGGREGATES", label: "Aggregates" },
  { code: "STEEL_REBAR", label: "Steel / Rebar" },
  { code: "LUMBER", label: "Lumber" },
  { code: "ELECTRICAL", label: "Electrical" },
  { code: "PLUMBING", label: "Plumbing" },
  { code: "HARDWARE", label: "Hardware" },
  { code: "FINISHING", label: "Finishing" },
  { code: "CONSUMABLES", label: "Consumables" },
  { code: "OTHER", label: "Other" },
] as const;

export type InventoryCategoryCode = (typeof INVENTORY_CATEGORIES)[number]["code"];
export const INVENTORY_CATEGORY_CODES = codesOf(INVENTORY_CATEGORIES);
export const inventoryCategoryLabel = labelLookup(INVENTORY_CATEGORIES);
