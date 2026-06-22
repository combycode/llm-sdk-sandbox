import { marked } from 'marked';

/** Render assistant text as markdown. BYOK local sandbox — output is not
 *  sanitized; do not reuse this verbatim in a multi-user context. */
export function Markdown({ text }: { text: string }) {
  const html = marked.parse(text, { async: false }) as string;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: local sandbox
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
