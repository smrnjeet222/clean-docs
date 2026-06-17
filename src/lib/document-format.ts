import { marked } from "marked";
import TurndownService from "turndown";

// Conversions for importing files into / exporting documents out of the editor.
// Client-side only (marked + turndown run in the browser). Imported HTML is
// re-sanitized server-side on save and re-parsed by Tiptap's schema, so unknown
// markup never survives.

export type ImportFormat = "markdown" | "text";

export function formatForFilename(name: string): ImportFormat | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".txt")) return "text";
  return null;
}

export function titleFromFilename(name: string): string {
  return name.replace(/\.(md|markdown|txt)$/i, "").trim() || "Imported document";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Plain text → HTML: each non-empty line becomes a paragraph. */
function textToHtml(text: string): string {
  const paras = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`);
  return paras.join("") || "<p></p>";
}

/** Convert an imported file's text to editor HTML based on its format. */
export function fileTextToHtml(text: string, format: ImportFormat): string {
  if (format === "markdown") return marked.parse(text, { async: false }) as string;
  return textToHtml(text);
}

let turndown: TurndownService | null = null;
function getTurndown(): TurndownService {
  turndown ??= new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  return turndown;
}

/** Editor HTML → Markdown, for export. */
export function htmlToMarkdown(html: string): string {
  return getTurndown().turndown(html);
}
