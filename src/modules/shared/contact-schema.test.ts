import { describe, expect, it } from "vitest";

import { entityDocumentSchemas, entityName, optionalEmail } from "./contact-schema";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("entityName", () => {
  it("requires a non-empty, in-bounds name", () => {
    expect(entityName.safeParse("").success).toBe(false);
    expect(entityName.safeParse("City Hall").success).toBe(true);
    expect(entityName.safeParse("x".repeat(161)).success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(entityName.parse("  Acme  ")).toBe("Acme");
  });
});

describe("optionalEmail", () => {
  it("treats blank as allowed and absent", () => {
    expect(optionalEmail.safeParse("").success).toBe(true);
    expect(optionalEmail.safeParse(undefined).success).toBe(true);
  });

  it("trims and lower-cases a real address", () => {
    expect(optionalEmail.parse("Foo@Bar.com ")).toBe("foo@bar.com");
  });

  it("rejects an invalid address", () => {
    expect(optionalEmail.safeParse("nope").success).toBe(false);
  });
});

describe("entityDocumentSchemas", () => {
  const docs = entityDocumentSchemas("widgetId");

  it("keys the document + note schemas by the supplied id", () => {
    const file = { filename: "spec.pdf", mime: "application/pdf", size: 1000 };
    expect(docs.presign.safeParse({ widgetId: UUID, ...file }).success).toBe(true);
    expect(docs.presign.safeParse(file).success).toBe(false); // missing widgetId
    expect(docs.confirm.safeParse({ widgetId: UUID, fileId: UUID }).success).toBe(true);
    expect(docs.docId.safeParse({ widgetId: UUID, attachmentId: UUID }).success).toBe(true);
    expect(docs.addNote.safeParse({ widgetId: UUID, body: "Called today" }).success).toBe(true);
    expect(docs.addNote.safeParse({ widgetId: UUID, body: "" }).success).toBe(false);
    expect(docs.noteId.safeParse({ widgetId: UUID, noteId: UUID }).success).toBe(true);
  });
});
