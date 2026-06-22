import { customType } from "drizzle-orm/pg-core";

// Money is stored as DECIMAL(14,2) in the DB and represented in TS as a value
// object over integer **minor units** (e.g. centavos) — never a float. Valuation
// (qty × cost) rounds **half-up on the product** to 2 dp. docs/17 §3, docs/00 §7.
//
// Range note: DECIMAL(14,2) maxes at ~10^12 major units → ~10^14 minor, well
// inside Number.MAX_SAFE_INTEGER, so a JS number is safe for the minor amount.

const SCALE = 100;

function roundHalfUp(n: number): number {
  // Half away from zero (accounting round-half-up), symmetric for negatives.
  return Math.sign(n) * Math.round(Math.abs(n));
}

export class Money {
  private constructor(private readonly minor: number) {
    if (!Number.isInteger(minor)) {
      throw new Error(`Money minor units must be an integer, got ${minor}`);
    }
  }

  static fromMinor(minor: number): Money {
    return new Money(minor);
  }

  /** From a major decimal amount or a numeric string ("12.34"). */
  static fromDecimal(amount: number | string): Money {
    const value = typeof amount === "string" ? Number(amount) : amount;
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid money amount: ${amount}`);
    }
    return new Money(roundHalfUp(value * SCALE));
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.minor + other.minor);
  }

  subtract(other: Money): Money {
    return new Money(this.minor - other.minor);
  }

  /** Multiply by a plain factor (e.g. a quantity); rounds half-up on the product. */
  multiply(factor: number): Money {
    return new Money(roundHalfUp(this.minor * factor));
  }

  get minorUnits(): number {
    return this.minor;
  }

  isZero(): boolean {
    return this.minor === 0;
  }

  isNegative(): boolean {
    return this.minor < 0;
  }

  /** Negative if this < other, 0 if equal, positive if this > other. */
  compare(other: Money): number {
    return this.minor - other.minor;
  }

  /** DECIMAL(14,2) string for the DB driver, e.g. "12.34". */
  toDecimalString(): string {
    const sign = this.minor < 0 ? "-" : "";
    const abs = Math.abs(this.minor);
    const cents = (abs % SCALE).toString().padStart(2, "0");
    return `${sign}${Math.floor(abs / SCALE)}.${cents}`;
  }
}

export function formatMoney(value: Money, currency = "PHP", locale = "en-PH"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    value.minorUnits / SCALE,
  );
}

// Reusable Drizzle column types so the money/quantity decisions live in one place.
// Used by the finance/inventory tables in later stages.
export const moneyColumn = customType<{ data: Money; driverData: string }>({
  dataType() {
    return "numeric(14, 2)";
  },
  toDriver(value) {
    return value.toDecimalString();
  },
  fromDriver(value) {
    return Money.fromDecimal(value);
  },
});

export const quantityColumn = customType<{ data: number; driverData: string }>({
  dataType() {
    return "numeric(14, 3)";
  },
  toDriver(value) {
    return value.toString();
  },
  fromDriver(value) {
    return Number(value);
  },
});

// Progress percentage 0–100 with 2 decimals (task/phase/project roll-ups). Stored
// as numeric(5,2); surfaced as a plain number so the roll-up averages stay
// arithmetic instead of string-juggling. A CHECK(0..100) is added per-table.
export const percentColumn = customType<{ data: number; driverData: string }>({
  dataType() {
    return "numeric(5, 2)";
  },
  toDriver(value) {
    return value.toString();
  },
  fromDriver(value) {
    return Number(value);
  },
});
