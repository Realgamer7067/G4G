import { describe, expect, it } from "vitest";
import { richTextToPlain, sanitizeRichText } from "./sanitize";

describe("sanitizeRichText", () => {
  it("keeps basic formatting", () => {
    const html = "<h2>Schedule</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><blockquote>Quote</blockquote>";
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("removes scripts, event handlers and inline styles", () => {
    expect(sanitizeRichText('<p onclick="x()" style="color:red">Hi<script>alert(1)</script></p>')).toBe("<p>Hi</p>");
    expect(sanitizeRichText('<img src=x onerror="alert(1)"><p>ok</p>')).toBe("<p>ok</p>");
  });

  it("drops javascript: links but keeps the text", () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">click</a>')).toBe("<a>click</a>");
  });

  it("marks external links safe and leaves internal ones alone", () => {
    expect(sanitizeRichText('<a href="https://gfg.example">site</a>')).toBe(
      '<a href="https://gfg.example" target="_blank" rel="noopener noreferrer">site</a>',
    );
    expect(sanitizeRichText('<a href="/events">events</a>')).toBe('<a href="/events">events</a>');
    expect(sanitizeRichText('<a href="mailto:hi@example.edu">mail</a>')).toBe('<a href="mailto:hi@example.edu">mail</a>');
  });

  it("demotes h1 so each page keeps a single h1", () => {
    expect(sanitizeRichText("<h1>Title</h1>")).toBe("<h2>Title</h2>");
  });

  it("returns empty string for empty editor output", () => {
    expect(sanitizeRichText("<p></p>")).toBe("");
    expect(sanitizeRichText("   ")).toBe("");
  });
});

describe("richTextToPlain", () => {
  it("strips tags, collapses whitespace and truncates on a word", () => {
    expect(richTextToPlain("<p>Hello <strong>world</strong></p><p>Second   line</p>", 100)).toBe("Hello world Second line");
    expect(richTextToPlain("<p>A long sentence about the hackathon weekend</p>", 20)).toBe("A long sentence…");
  });
});
