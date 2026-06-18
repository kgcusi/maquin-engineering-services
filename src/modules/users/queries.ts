import { and, count, desc } from "drizzle-orm";

import { db } from "@/db/client";
import { user } from "@/db/schema/auth";
import { visibleUserWhere } from "@/lib/rbac";
import {
  offsetFor,
  PAGE_SIZE,
  searchClause,
  type DirectoryListParams,
  type Paginated,
} from "@/modules/shared/list-params";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  isActive: boolean | null;
  createdAt: Date;
};

const COLUMNS = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
} as const;

// Every user read MUST apply visibleUserWhere() so the hidden webmaster never
// surfaces (src/lib/rbac.ts) — AND'd here with the optional name/email search so
// the scoping survives. Newest first, one page at a time; sibling COUNT(*) over
// the same WHERE powers the numbered footer.
export async function listVisibleUsers(params: DirectoryListParams): Promise<Paginated<UserRow>> {
  const where = and(visibleUserWhere(), searchClause(params.q, [user.name, user.email]));

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select(COLUMNS)
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(PAGE_SIZE)
      .offset(offsetFor(params.page, PAGE_SIZE)),
    db.select({ value: count() }).from(user).where(where),
  ]);

  return { rows, total, page: params.page, pageSize: PAGE_SIZE };
}
