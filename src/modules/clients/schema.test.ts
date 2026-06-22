import { describe, expect, it } from "vitest";

import { addClientNoteSchema, createClientSchema, presignClientDocumentSchema } from "./schema";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("client schema", () => {
  it("requires a name", () => {
    expect(createClientSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createClientSchema.safeParse({ name: "City Hall" }).success).toBe(true);
  });

  it("normalizes a provided email to trimmed lowercase", () => {
    const parsed = createClientSchema.parse({ name: "Acme", email: "Sales@Acme.com " });
    expect(parsed.email).toBe("sales@acme.com");
  });

  it("defaults isActive to true and accepts an explicit boolean", () => {
    expect(createClientSchema.parse({ name: "Acme" }).isActive).toBe(true);
    expect(createClientSchema.parse({ name: "Acme", isActive: false }).isActive).toBe(false);
    expect(createClientSchema.safeParse({ name: "Acme", isActive: "yes" }).success).toBe(false);
  });

  it("document presign validates mime + size", () => {
    const base = { clientId: UUID, filename: "contract.pdf", mime: "application/pdf", size: 1000 };
    expect(presignClientDocumentSchema.safeParse(base).success).toBe(true);
    expect(
      presignClientDocumentSchema.safeParse({ ...base, mime: "application/x-bad" }).success,
    ).toBe(false);
    expect(presignClientDocumentSchema.safeParse({ ...base, size: 999_999_999 }).success).toBe(
      false,
    );
  });

  it("note requires a non-empty body", () => {
    expect(addClientNoteSchema.safeParse({ clientId: UUID, body: "" }).success).toBe(false);
    expect(addClientNoteSchema.safeParse({ clientId: UUID, body: "Called today" }).success).toBe(
      true,
    );
  });
});
