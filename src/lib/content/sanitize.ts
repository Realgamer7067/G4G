import sanitizeHtml from "sanitize-html";

const RICH_TEXT: sanitizeHtml.IOptions = {
  allowedTags: ["h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "code", "pre", "hr"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  transformTags: {
    h1: "h2",
    a: (_tag, attribs) => {
      const href = attribs.href ?? "";
      const out: Record<string, string> = {};
      if (href) out.href = href;
      if (/^https?:\/\//i.test(href)) {
        out.target = "_blank";
        out.rel = "noopener noreferrer";
      }
      return { tagName: "a", attribs: out };
    },
  },
  exclusiveFilter: (frame) => frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren?.length,
};

/** Allow-list sanitiser for admin-written rich text. Run on save and again when rendering. */
export function sanitizeRichText(html: string | null | undefined): string {
  return sanitizeHtml(html ?? "", RICH_TEXT).trim();
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** Plain-text excerpt for meta descriptions and cards, cut on a word boundary. */
export function richTextToPlain(html: string | null | undefined, max = 160): string {
  const spaced = (html ?? "").replace(/<\/(p|h[1-6]|li|blockquote|pre|div)>|<br\s*\/?>/gi, " ");
  const text = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
