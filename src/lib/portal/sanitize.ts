/**
 * Conservative allowlist HTML sanitizer for admin-authored lesson and
 * announcement content (TipTap output). Strips scripts, event handlers,
 * iframes, and unknown tags while keeping basic formatting. Defense in
 * depth: authors are admins, but stored content should still never be able
 * to run script in a student's browser.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "code",
  "pre",
  "hr",
  "span",
]);

const ALIGN_STYLE = /^text-align:\s*(left|right|center|justify);?$/i;

function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("mailto:")) return value;
  return null;
}

function escapeAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rebuildTag(tagName: string, rawAttrs: string, closing: boolean) {
  const tag = tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return "";
  if (closing) return `</${tag}>`;

  const attrs: string[] = [];

  if (tag === "a") {
    const hrefMatch = rawAttrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
    const href = hrefMatch ? safeHref(hrefMatch[2] ?? hrefMatch[3] ?? "") : null;
    if (href) {
      attrs.push(`href="${escapeAttr(href)}"`);
      attrs.push('target="_blank"', 'rel="noopener noreferrer nofollow"');
    }
  }

  const styleMatch = rawAttrs.match(/style\s*=\s*("([^"]*)"|'([^']*)')/i);
  const style = styleMatch ? (styleMatch[2] ?? styleMatch[3] ?? "") : "";
  if (style && ALIGN_STYLE.test(style.trim())) {
    attrs.push(`style="${escapeAttr(style.trim())}"`);
  }

  const selfClose = tag === "br" || tag === "hr" ? " /" : "";
  return attrs.length
    ? `<${tag} ${attrs.join(" ")}${selfClose}>`
    : `<${tag}${selfClose}>`;
}

export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";

  let html = input;

  // Remove entire dangerous blocks including their content.
  html = html.replace(
    /<(script|style|iframe|object|embed|form|svg|math|template|noscript)\b[\s\S]*?<\/\1\s*>/gi,
    ""
  );
  // Remove comments and CDATA.
  html = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");

  // Rebuild every remaining tag from the allowlist.
  html = html.replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (_match, slash: string, tag: string, attrs: string) =>
      rebuildTag(tag, attrs ?? "", slash === "/")
  );

  // Any leftover angle brackets from malformed markup get escaped by the
  // browser as text; nothing executable remains.
  return html;
}

/** True when the value contains no meaningful text once tags are removed. */
export function isEmptyHtml(input: string | null | undefined): boolean {
  if (!input) return true;
  return input.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim() === "";
}
