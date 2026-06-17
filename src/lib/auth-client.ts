"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

// Browser-side Better Auth client. baseURL is inferred from the current origin
// in the browser; the admin client plugin mirrors the server admin plugin.
export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export const { signIn, signOut, useSession, changePassword } = authClient;
