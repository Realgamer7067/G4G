import { describe, expect, it } from "vitest";
import { cleanName } from "./clean-name";

describe("cleanName", () => {
  it("keeps a normal filename", () => {
    expect(cleanName("resume.pdf")).toBe("resume.pdf");
  });

  it("strips directory components", () => {
    expect(cleanName("../../etc/passwd")).toBe("passwd");
    expect(cleanName("/tmp/uploads/cv.pdf")).toBe("cv.pdf");
  });

  it("strips control characters, including NUL", () => {
    expect(cleanName("resume\u0000.pdf")).toBe("resume.pdf");
    expect(cleanName("cv\u001f\u007f.docx")).toBe("cv.docx");
  });

  it("falls back to a default name when nothing usable is left", () => {
    expect(cleanName("")).toBe("upload");
    expect(cleanName("   ")).toBe("upload");
    expect(cleanName("\u0000\u0001")).toBe("upload");
  });

  it("caps length at 200 characters", () => {
    expect(cleanName(`${"a".repeat(250)}.pdf`).length).toBe(200);
  });
});
