import { describe, expect, it } from "vitest";

import { maskApiKey } from "@/lib/email-settings";
import { updateEmailSettingsSchema } from "@/modules/settings/schema";

describe("maskApiKey", () => {
  it("keeps the prefix + last 4 and bullets the middle", () => {
    expect(maskApiKey("re_abcdefghijklmnop")).toBe("re_••••mnop");
  });

  it("never reveals the full key", () => {
    const key = "re_abcdefghijklmnop";
    const masked = maskApiKey(key)!;
    expect(masked).not.toContain("abcdefghij");
    expect(masked.length).toBeLessThan(key.length);
  });

  it("returns a generic mask for short values and null for empty", () => {
    expect(maskApiKey("re_12")).toBe("••••");
    expect(maskApiKey("   ")).toBeNull();
    expect(maskApiKey("")).toBeNull();
  });
});

describe("updateEmailSettingsSchema", () => {
  it("accepts empty fields (meaning: keep stored values)", () => {
    expect(updateEmailSettingsSchema.safeParse({ fromAddress: "", apiKey: "" }).success).toBe(true);
  });

  it("accepts a bare email and a display-name sender", () => {
    expect(
      updateEmailSettingsSchema.safeParse({ fromAddress: "no-reply@firm.com", apiKey: "" }).success,
    ).toBe(true);
    expect(
      updateEmailSettingsSchema.safeParse({
        fromAddress: "MAQUIN <no-reply@firm.com>",
        apiKey: "",
      }).success,
    ).toBe(true);
  });

  it("rejects a malformed sender", () => {
    expect(
      updateEmailSettingsSchema.safeParse({ fromAddress: "not-an-email", apiKey: "" }).success,
    ).toBe(false);
  });

  it("requires the Resend key prefix when a key is provided", () => {
    expect(
      updateEmailSettingsSchema.safeParse({ fromAddress: "", apiKey: "sk_live_x" }).success,
    ).toBe(false);
    expect(
      updateEmailSettingsSchema.safeParse({ fromAddress: "", apiKey: "re_validkey" }).success,
    ).toBe(true);
  });
});
