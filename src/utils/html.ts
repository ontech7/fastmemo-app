import { stripHtml } from "@/libs/ai";

/**
 * Pure, platform-agnostic helpers for converting note HTML into export
 * formats. No native / web / Tauri bindings here -- use \`@/utils/export\` for
 * the platform-aware wrappers around these helpers.
 */

export function htmlToMarkdown(html: string): string {
  let md = html;

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");

  // Bold + italic combo
  md = md.replace(/<(b|strong)[^>]*><(i|em)[^>]*>(.*?)<\/(i|em)><\/(b|strong)>/gi, "***$3***");
  md = md.replace(/<(i|em)[^>]*><(b|strong)[^>]*>(.*?)<\/(b|strong)><\/(i|em)>/gi, "***$3***");

  // Bold
  md = md.replace(/<(b|strong)[^>]*>(.*?)<\/(b|strong)>/gi, "**$2**");

  // Italic
  md = md.replace(/<(i|em)[^>]*>(.*?)<\/(i|em)>/gi, "*$2*");

  // Underline (no standard markdown, use HTML)
  md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, "<u>$1</u>");

  // Strikethrough
  md = md.replace(/<(s|strike|del)[^>]*>(.*?)<\/(s|strike|del)>/gi, "~~$2~~");

  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n\n");
  md = md.replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```\n\n");

  // Inline code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");

  // Blockquote
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_, content) => {
    const lines = stripHtml(content)
      .split("\n")
      .map((line) => `> ${line.trim()}`)
      .join("\n");
    return lines + "\n\n";
  });

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, "![]($1)");

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Horizontal rule
  md = md.replace(/<hr[^>]*\/?>/gi, "\n---\n\n");

  // Unordered lists
  md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_, content) => {
    return (
      content.replace(/<li[^>]*>(.*?)<\/li>/gis, (__, item) => {
        return `- ${stripHtml(item).trim()}\n`;
      }) + "\n"
    );
  });

  // Ordered lists
  md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_, content) => {
    let index = 0;
    return (
      content.replace(/<li[^>]*>(.*?)<\/li>/gis, (__, item) => {
        index++;
        return `${index}. ${stripHtml(item).trim()}\n`;
      }) + "\n"
    );
  });

  // Subscript / Superscript (no standard markdown)
  md = md.replace(/<sub[^>]*>(.*?)<\/sub>/gi, "<sub>$1</sub>");
  md = md.replace(/<sup[^>]*>(.*?)<\/sup>/gi, "<sup>$1</sup>");

  // Paragraphs and divs
  md = md.replace(/<\/p>/gi, "\n\n");
  md = md.replace(/<p[^>]*>/gi, "");
  md = md.replace(/<\/div>/gi, "\n");
  md = md.replace(/<div[^>]*>/gi, "");

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  md = md.replace(/&nbsp;/g, " ");
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");

  // Clean up excessive newlines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim();
}

/**
 * Create an HTML document wrapper for PDF export.
 */
export function wrapHtmlForPdf(title: string, htmlContent: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title || "Note"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
      line-height: 1.6;
    }
    h1.note-title {
      font-size: 28px;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h1 { font-size: 24px; }
    h2 { font-size: 20px; }
    h3 { font-size: 18px; }
    blockquote {
      border-left: 4px solid #ddd;
      padding: 8px 16px;
      margin: 16px 0;
      color: #555;
      background: #f9f9f9;
    }
    pre {
      background: #f4f4f4;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 13px;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 13px;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 24px 0;
    }
    img {
      max-width: 100%;
      border-radius: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    table td, table th {
      border: 1px solid #ddd;
      padding: 8px;
    }
  </style>
</head>
<body>
  ${title ? `<h1 class="note-title">${title}</h1>` : ""}
  ${htmlContent}
</body>
</html>`;
}
