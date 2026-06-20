import { describe, it, expect } from "vitest";
import { getParentPath } from "../path";

describe("getParentPath", () => {
  it("extracts parent from backslash paths", () => {
    expect(getParentPath("C:\\Users\\file.txt")).toBe("C:\\Users");
  });

  it("extracts parent from forward slash paths", () => {
    expect(getParentPath("/home/user/file.txt")).toBe("/home/user");
  });

  it("returns empty string for root-level backslash path", () => {
    expect(getParentPath("file.txt")).toBe("");
  });

  it("returns empty string for root-level forward slash path", () => {
    expect(getParentPath("/file.txt")).toBe("");
  });

  it("handles nested directories", () => {
    expect(getParentPath("a/b/c/d.txt")).toBe("a/b/c");
    expect(getParentPath("a\\b\\c\\d.txt")).toBe("a\\b\\c");
  });

  it("returns empty string for empty string", () => {
    expect(getParentPath("")).toBe("");
  });

  it("handles paths with no separators", () => {
    expect(getParentPath("filename")).toBe("");
  });
});
