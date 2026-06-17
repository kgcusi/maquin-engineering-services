import { describe, expect, it } from "vitest";

import {
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  TIMEZONES,
  TIMEZONE_CODES,
  currencyLabel,
  timezoneLabel,
} from "@/lib/settings";

const SETS = [
  { name: "TIMEZONES", entries: TIMEZONES, codes: TIMEZONE_CODES },
  { name: "CURRENCIES", entries: CURRENCIES, codes: CURRENCY_CODES },
] as const;

describe("settings registry integrity", () => {
  for (const { name, entries, codes } of SETS) {
    it(`${name} has unique codes + non-empty labels and a matching codes tuple`, () => {
      const codeList = entries.map((e) => e.code);
      expect(new Set(codeList).size).toBe(codeList.length);
      expect(entries.every((e) => e.label.length > 0)).toBe(true);
      expect([...codes]).toEqual(codeList);
    });
  }

  it("defaults are valid members of their sets", () => {
    expect([...TIMEZONE_CODES]).toContain(DEFAULT_SETTINGS.timezone);
    expect([...CURRENCY_CODES]).toContain(DEFAULT_SETTINGS.currency);
    expect(DEFAULT_SETTINGS).toEqual({ timezone: "Asia/Manila", currency: "PHP" });
  });

  it("exposes exactly the timezone + currency keys", () => {
    expect([...SETTINGS_KEYS]).toEqual(["timezone", "currency"]);
  });
});

describe("settings label lookups", () => {
  it("resolve known codes and fall back to the raw value / dash", () => {
    expect(timezoneLabel("Asia/Manila")).toBe("Manila (PHT, UTC+8)");
    expect(currencyLabel("PHP")).toBe("Philippine Peso (₱)");
    expect(timezoneLabel("Mars/Olympus")).toBe("Mars/Olympus");
    expect(currencyLabel(null)).toBe("—");
    expect(timezoneLabel(undefined)).toBe("—");
  });
});
