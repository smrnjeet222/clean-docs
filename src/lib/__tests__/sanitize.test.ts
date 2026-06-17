import { describe, it, expect } from "vitest";
import { sanitizeDocumentHtml } from "../sanitize";

describe("sanitizeDocumentHtml", () => {
  it("preserves allowed rich-text formatting", () => {
    const input = "<h1>Title</h1><p><strong>bold</strong> <em>italic</em> <u>under</u></p><ul><li>a</li></ul>";
    expect(sanitizeDocumentHtml(input)).toBe(input);
  });

  it("strips script tags (stored XSS)", () => {
    const out = sanitizeDocumentHtml('<p>hi</p><script>alert("xss")</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>hi</p>");
  });

  it("removes event-handler attributes", () => {
    const out = sanitizeDocumentHtml('<p onclick="steal()">click</p>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("click");
  });

  it("drops javascript: protocol on links but keeps https", () => {
    expect(sanitizeDocumentHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    expect(sanitizeDocumentHtml('<a href="https://example.com">x</a>')).toContain("https://example.com");
  });
});
