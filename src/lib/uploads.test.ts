import { describe, expect, it } from "vitest";

import {
  buildFileKey,
  formatBytes,
  isAllowedMime,
  MAX_UPLOAD_BYTES,
  safeFilename,
} from "@/lib/uploads";

describe("upload policy", () => {
  it("allows the documented mime types and rejects others", () => {
    expect(isAllowedMime("application/pdf")).toBe(true);
    expect(isAllowedMime("image/png")).toBe(true);
    expect(isAllowedMime("application/x-msdownload")).toBe(false);
    expect(isAllowedMime("")).toBe(false);
  });

  it("caps uploads at 15 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(15 * 1024 * 1024);
  });

  it("sanitizes filenames into safe key segments", () => {
    expect(safeFilename("My Contract (final).pdf")).toBe("My_Contract_final_.pdf");
    expect(safeFilename("   ")).toBe("file");
  });

  it("builds a grouped, unique key", () => {
    expect(buildFileKey("client", "abc", "fid", "Plan v2.pdf")).toBe("client/abc/fid/Plan_v2.pdf");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(15 * 1024 * 1024)).toBe("15.0 MB");
  });
});
