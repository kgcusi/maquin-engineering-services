import { z } from "zod";

import { ROLES } from "@/lib/roles";

// WEBMASTER is deliberately not assignable — it is seed/DB-only and hidden
// (src/lib/roles.ts HIDDEN_ROLES); the enum rejects it.
const roleField = z.enum([ROLES.ADMIN, ROLES.ENGINEER], {
  message: "Choose a role",
});

const nameField = z.string().trim().min(1, "Name is required").max(120, "Name is too long");

// No upper cap, but an 8-character floor (best-practice minimum). Better Auth's
// own min/max are set to match in src/lib/auth.ts.
const passwordField = z.string().min(8, "Use at least 8 characters");

export const createUserSchema = z
  .object({
    name: nameField,
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: passwordField,
    confirmPassword: z.string().min(1, "Confirm the password"),
    role: roleField,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const updateUserSchema = z.object({
  id: z.string().min(1),
  name: nameField,
  role: roleField,
});

export const userIdSchema = z.object({ id: z.string().min(1) });

// Self-service password change (the account dialog). currentPassword is required
// so the change re-authenticates; Better Auth verifies it server-side.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, "Confirm the new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must differ from the current one",
    path: ["newPassword"],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
