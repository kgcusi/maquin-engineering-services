import { describe, expect, it } from "vitest";

import {
  CASHFLOW_CATEGORIES,
  CASHFLOW_CATEGORY_CODES,
  COST_CATEGORIES,
  COST_CATEGORY_CODES,
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_CODES,
  TRADES,
  TRADE_CODES,
  UNITS,
  UNIT_CODES,
  cashflowCategoryLabel,
  costCategoryLabel,
  inventoryCategoryLabel,
  tradeLabel,
  unitLabel,
  unitSymbol,
} from "@/lib/lookups";

const SETS = [
  { name: "UNITS", entries: UNITS, codes: UNIT_CODES },
  { name: "TRADES", entries: TRADES, codes: TRADE_CODES },
  { name: "COST_CATEGORIES", entries: COST_CATEGORIES, codes: COST_CATEGORY_CODES },
  { name: "CASHFLOW_CATEGORIES", entries: CASHFLOW_CATEGORIES, codes: CASHFLOW_CATEGORY_CODES },
  { name: "INVENTORY_CATEGORIES", entries: INVENTORY_CATEGORIES, codes: INVENTORY_CATEGORY_CODES },
] as const;

describe("lookup code-set integrity", () => {
  for (const { name, entries, codes } of SETS) {
    it(`${name} has unique codes and labels, codes tuple matches order`, () => {
      const codeList = entries.map((e) => e.code);
      expect(new Set(codeList).size).toBe(codeList.length);
      expect(entries.every((e) => e.label.length > 0)).toBe(true);
      expect([...codes]).toEqual(codeList);
    });
  }
});

describe("label + symbol lookups", () => {
  it("resolve known codes and fall back to the raw code / dash", () => {
    expect(unitLabel("m3")).toBe("Cubic Meter");
    expect(unitSymbol("m3")).toBe("m³");
    expect(unitSymbol("m2")).toBe("m²");
    expect(tradeLabel("REBAR")).toBe("Steelman / Rebar");
    expect(costCategoryLabel("PERMITS_AND_FEES")).toBe("Permits & Fees");
    expect(cashflowCategoryLabel("RETENTION_RELEASE")).toBe("Retention Release");
    expect(inventoryCategoryLabel("STEEL_REBAR")).toBe("Steel / Rebar");

    expect(unitLabel("nope")).toBe("nope");
    expect(unitLabel(null)).toBe("—");
    expect(tradeLabel(undefined)).toBe("—");
  });
});
