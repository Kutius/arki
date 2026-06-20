import { describe, it, expect } from "vitest";
import { getFileIconConfig } from "../fileIcons";

describe("getFileIconConfig", () => {
  it("returns archive icon for archive extensions", () => {
    const config = getFileIconConfig("zip");
    expect(config.color).toContain("amber");
    expect(config.icon).toBeDefined();
  });

  it("returns image icon for image extensions", () => {
    const config = getFileIconConfig("png");
    expect(config.color).toContain("pink");
  });

  it("returns code icon for programming language extensions", () => {
    const config = getFileIconConfig("ts");
    expect(config.color).toContain("emerald");
  });

  it("returns spreadsheet icon for spreadsheet extensions", () => {
    const config = getFileIconConfig("xlsx");
    expect(config.color).toContain("green");
  });

  it("returns document icon for document extensions", () => {
    const config = getFileIconConfig("pdf");
    expect(config.color).toContain("red");
  });

  it("returns text icon for text extensions", () => {
    const config = getFileIconConfig("txt");
    expect(config.color).toContain("muted-foreground");
  });

  it("returns default icon for unknown extensions", () => {
    const config = getFileIconConfig("xyz");
    expect(config.color).toContain("muted-foreground");
  });

  it("returns default icon for undefined", () => {
    const config = getFileIconConfig(undefined);
    expect(config.icon).toBeDefined();
  });
});
