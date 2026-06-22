import {
  conversationToMarkdown,
  conversationToZip,
  type ContentPart,
  type Message,
} from '@combycode/llm-sdk';
import type { ChatTurn, MediaItem } from '../types/chat';

/** Project the sandbox turns into a full Message[] for export — assistant
 *  generated media is included inline (ungated, unlike the live projection). */
function turnsToMessages(turns: ChatTurn[]): Message[] {
  return turns.map((t) => {
    if (t.role === 'user') return { role: 'user', content: t.apiContent };
    const parts: ContentPart[] = [];
    if (t.text) parts.push({ type: 'text', text: t.text });
    for (const m of t.media) parts.push(mediaItemToPart(m));
    return { role: 'assistant', content: parts.length > 0 ? parts : t.text };
  });
}

function mediaItemToPart(item: MediaItem): ContentPart {
  const m = /^data:(.*?);base64,(.*)$/.exec(item.url);
  const source = { type: 'base64' as const, mimeType: m?.[1] ?? item.mime, data: m?.[2] ?? '' };
  return { type: item.kind, source };
}

/** The full conversation as Markdown (media embedded as data-URL links). */
export function historyMarkdown(turns: ChatTurn[]): string {
  return conversationToMarkdown(turnsToMessages(turns), {
    title: 'llm-sandbox conversation',
    inlineMedia: true,
  });
}

/** The full conversation as a .zip: Markdown + media pulled into `media/` files
 *  (no giant base64 blobs). Returns the archive bytes. */
export function historyZip(turns: ChatTurn[]): Uint8Array {
  return conversationToZip(turnsToMessages(turns), { title: 'llm-sandbox conversation' }).bytes;
}
