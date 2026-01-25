// Minimal deterministic Markdown -> HTML converter (dependency-free).
// Supports common headings, lists, code blocks, inline code, bold/italic, links, and breaks.
// Intentionally simple to avoid non-deterministic ids/mangling.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text: string): string {
  // code
  let out = text.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safeHref = escapeHtml(href);
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  });
  return out;
}

function renderParagraph(line: string): string {
  return `<p>${renderInline(line)}</p>`;
}

export function mdToHtml(md: string): string {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // Fenced code block ```...```
    if (line.startsWith("```")) {
      const fence = line;
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && lines[i] !== fence) {
        codeLines.push(lines[i]);
        i += 1;
      }
      // skip closing fence
      if (i < lines.length && lines[i] === fence) i += 1;
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    // List
    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length) {
        const lm = lines[j].match(/^[-*]\s+(.*)$/);
        if (!lm) break;
        items.push(`<li>${renderInline(lm[1])}</li>`);
        j += 1;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      i = j;
      continue;
    }

    // Blank line -> <br> to preserve breaks (like marked breaks=true)
    if (line.trim().length === 0) {
      html.push("<br>");
      i += 1;
      continue;
    }

    // Paragraph
    html.push(renderParagraph(line));
    i += 1;
  }

  return html.join("");
}
