import { z } from "zod";

import { ROLES } from "@/lib/roles";

// WEBMASTER is deliberately not assignable — it is seed/DB-only and hidden
// (src/lib/roles.ts HIDDEN_ROLES); the enum rejects it.
const roleField = z.enum([ROLES.ADMIN, ROLES.ENGINEER], {
  message: "Choose a role",
});

const nameField = z.string().trim().min(1, "Name is required").max(120, "Name is too long");

const emailField = z.string().trim().toLowerCase().email("Enter a valid email");

// No upper cap, but an 8-character floor (best-practice minimum). Better Auth's
// own min/max are set to match in src/lib/auth.ts.
const passwordField = z.string().min(8, "Use at least 8 characters");

export const createUserSchema = z
  .object({
    name: nameField,
    email: emailField,
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
  email: emailField,
  role: roleField,
});

// Admin-initiated reset of ANOTHER user's password — no current password, since
// the admin doesn't know it (that's the point). Accountability comes from the
// audit trail, not re-authentication. The matching guard + Better Auth credential
// write live in actions.ts (resetUserPasswordAction).
export const resetUserPasswordSchema = z
  .object({
    id: z.string().min(1),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, "Confirm the password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// The Edit-user form bundles identity fields with an OPTIONAL password reset:
// both blank → password untouched; either filled → validated like a reset. The
// form splits into updateUserSchema + resetUserPasswordSchema on submit.
export const editUserFormSchema = z
  .object({
    id: z.string().min(1),
    name: nameField,
    email: emailField,
    role: roleField,
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.newPassword && !data.confirmPassword) return;
    if (data.newPassword.length < 8) {
      ctx.addIssue({ code: "custom", message: "Use at least 8 characters", path: ["newPassword"] });
    }
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", message: "Passwords don't match", path: ["confirmPassword"] });
    }
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
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
export type EditUserFormInput = z.infer<typeof editUserFormSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
