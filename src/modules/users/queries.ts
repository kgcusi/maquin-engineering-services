import { desc } from "drizzle-orm";

import { db } from "@/db/client";
import { user } from "@/db/schema/auth";
import { visibleUserWhere } from "@/lib/rbac";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  isActive: boolean | null;
  createdAt: Date;
};

// Every user read MUST apply visibleUserWhere() so the hidden webmaster never
// surfaces (src/lib/rbac.ts). Newest first.
export async function listVisibleUsers(): Promise<UserRow[]> {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(visibleUserWhere())
    .orderBy(desc(user.createdAt));
}
