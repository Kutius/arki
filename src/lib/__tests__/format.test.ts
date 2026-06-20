import { describe, it, expect } from "vitest";
import { formatFileSize, getPreviewType } from "../format";

describe("formatFileSize", () => {
  it("returns '0 B' for 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats bytes correctly", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes correctly", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatFileSize(1048576)).toBe("1 MB");
    expect(formatFileSize(5242880)).toBe("5 MB");
  });

  it("formats gigabytes correctly", () => {
    expect(formatFileSize(1073741824)).toBe("1 GB");
  });

  it("formats terabytes correctly", () => {
    expect(formatFileSize(1099511627776)).toBe("1 TB");
  });
});

describe("getPreviewType", () => {
  it("returns 'image' for image extensions", () => {
    expect(getPreviewType("photo.jpg")).toBe("image");
    expect(getPreviewType("photo.jpeg")).toBe("image");
    expect(getPreviewType("icon.png")).toBe("image");
    expect(getPreviewType("animation.gif")).toBe("image");
    expect(getPreviewType("vector.svg")).toBe("image");
  });

  it("returns 'json' for .json files", () => {
    expect(getPreviewType("data.json")).toBe("json");
  });

  it("returns 'xml' for .xml files", () => {
    expect(getPreviewType("config.xml")).toBe("xml");
  });

  it("returns 'text' for text-based extensions", () => {
    expect(getPreviewType("readme.txt")).toBe("text");
    expect(getPreviewType("notes.md")).toBe("text");
    expect(getPreviewType("config.yaml")).toBe("text");
    expect(getPreviewType("style.css")).toBe("text");
    expect(getPreviewType("index.html")).toBe("text");
    expect(getPreviewType("main.rs")).toBe("text");
    expect(getPreviewType("app.py")).toBe("text");
  });

  it("returns null for unsupported extensions", () => {
    expect(getPreviewType("video.mp4")).toBeNull();
    expect(getPreviewType("archive.zip")).toBeNull();
    expect(getPreviewType("binary.exe")).toBeNull();
    expect(getPreviewType("noext")).toBeNull();
  });

  it("handles case insensitivity via extension extraction", () => {
    // The function lowercases the extension
    expect(getPreviewType("FILE.TXT")).toBe("text");
    expect(getPreviewType("IMAGE.PNG")).toBe("image");
  });
});
