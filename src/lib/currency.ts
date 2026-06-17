// Client-safe currency formatting. The Money value object (src/lib/money.ts) is
// server-only (it pulls Drizzle), so client components format a plain decimal
// amount + the firm currency code here instead.
export function formatCurrency(amount: number | string, currency: string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
}
