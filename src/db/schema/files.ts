import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";

// Object-storage file metadata (docs/02 §8.1, docs/16 §5). The blob lives in R2;
// the row is PENDING until a confirm step HEADs the object (docs/17 §5).
export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    status: text("status").notNull().default("PENDING"), // PENDING | CONFIRMED
    uploadedBy: text("uploaded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("files_status_idx").on(t.status)],
);
