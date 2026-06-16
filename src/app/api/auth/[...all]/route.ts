import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better Auth's catch-all route handler (sign-in, sign-out, session, admin
// provisioning, etc.). This is one of the few real HTTP routes — all domain
// mutations go through guarded Server Actions instead (docs/17 §3).
export const { GET, POST } = toNextJsHandler(auth);
