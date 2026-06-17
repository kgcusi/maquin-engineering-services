// Drizzle schema barrel — every table module is re-exported here so the client
// (src/db/client.ts) and Drizzle Kit (drizzle.config.ts) see one schema object.
//
// Stage 0 encodes the Better Auth tables + the settled foundation/infra tables.
// Domain feature tables (docs/02) are added per-stage (see STATUS.md → next gate).
export * from "./auth";
export * from "./app-settings";
export * from "./ref-counters";
export * from "./audit-logs";
export * from "./outbox";
export * from "./notifications";
export * from "./notification-settings";
export * from "./files";
export * from "./attachments";
export * from "./notes";
export * from "./employees";
export * from "./clients";
export * from "./suppliers";
