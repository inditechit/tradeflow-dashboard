/** Lightweight markdown → HTML for CMS blog bodies. */
export function markdownToHtml(md: string): string {
  const escaped = String(md || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const blocks = escaped.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html: string[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    if (/^### /.test(block)) {
      html.push(`<h3>${inline(block.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }
    if (/^## /.test(block)) {
      html.push(`<h2>${inline(block.replace(/^##\s+/, ""))}</h2>`);
      continue;
    }
    if (/^# /.test(block)) {
      html.push(`<h2>${inline(block.replace(/^#\s+/, ""))}</h2>`);
      continue;
    }

    const lines = block.split("\n");
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      html.push(
        `<ul>${lines
          .map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`)
          .join("")}</ul>`,
      );
      continue;
    }

    html.push(`<p>${inline(lines.join("<br />"))}</p>`);
  }

  return html.join("\n");
}

function inline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
