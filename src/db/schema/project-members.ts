import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { projects } from "./projects";
import { user } from "./auth";

// The engineer↔project access grant (docs/17 §10.1). One LEAD + many MEMBER
// engineers per project, all with equal scoped capability; INSPECTOR rows are
// added on an inspection request (deferred module). `role_on_project` is plain
// text validated against PROJECT_MEMBER_ROLES — it scopes/targets, never narrows
// a role's capabilities. This table IS the membership predicate baked into every
// project-scoped read, and the resolver for `PROJECT:*` notifications.
export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleOnProject: text("role_on_project").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("project_members_project_user_unique").on(t.projectId, t.userId),
    // Backs the engineer-scope predicate: "the projects this user belongs to".
    index("project_members_user_idx").on(t.userId, t.projectId),
  ],
);
