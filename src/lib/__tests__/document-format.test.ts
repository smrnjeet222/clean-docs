import { describe, it, expect } from "vitest";
import { formatForFilename, titleFromFilename, fileTextToHtml } from "../document-format";

describe("import format detection", () => {
  it("recognizes .md / .markdown / .txt, rejects others", () => {
    expect(formatForFilename("notes.md")).toBe("markdown");
    expect(formatForFilename("README.MARKDOWN")).toBe("markdown");
    expect(formatForFilename("log.txt")).toBe("text");
    expect(formatForFilename("photo.png")).toBeNull();
  });

  it("derives a title from the filename", () => {
    expect(titleFromFilename("Meeting Notes.md")).toBe("Meeting Notes");
    expect(titleFromFilename("plain.txt")).toBe("plain");
  });
});

describe("fileTextToHtml", () => {
  it("wraps plain-text lines in paragraphs and escapes HTML", () => {
    const html = fileTextToHtml("line one\n\n<b>not bold</b>", "text");
    expect(html).toContain("<p>line one</p>");
    expect(html).toContain("&lt;b&gt;not bold&lt;/b&gt;");
    expect(html).not.toContain("<b>");
  });

  it("converts markdown to HTML", () => {
    const html = fileTextToHtml("# Title\n\n- a\n- b", "markdown");
    expect(html).toContain("<h1");
    expect(html).toContain("<li>a</li>");
  });
});
