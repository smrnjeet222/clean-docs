import sanitizeHtml from "sanitize-html";

/**
 * Allowlist sanitizer for editor content. Tiptap emits a small, known set of
 * tags; we strip everything else to prevent stored XSS from shared editors.
 */
export function sanitizeDocumentHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "strike",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "blockquote", "code", "pre", "a", "span",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: [],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}
