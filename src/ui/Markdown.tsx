import { marked } from 'marked';

/** Code-interpreter models reference produced files with INTERNAL paths in the
 *  text — e.g. OpenAI's `[download here](sandbox:/mnt/data/chart.png)`. These aren't
 *  real URLs (they'd 404 / show a broken image), and the file is already surfaced
 *  separately as a downloadable output. Keep the link label as plain text and drop
 *  broken internal images. */
const INTERNAL_HREF = /^(sandbox:|attachment:|\/mnt\/)/i;
function neutralizeInternalLinks(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, (m, href) => (INTERNAL_HREF.test(href.trim()) ? '' : m))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, href) =>
      INTERNAL_HREF.test(href.trim()) ? label : m,
    );
}

/** Render assistant text as markdown. BYOK local sandbox — output is not
 *  sanitized; do not reuse this verbatim in a multi-user context. */
export function Markdown({ text }: { text: string }) {
  const html = marked.parse(neutralizeInternalLinks(text), { async: false }) as string;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: local sandbox
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
