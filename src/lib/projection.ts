import type { Content, ContentPart, Message, ModelInfo } from '@combycode/llm-sdk';
import type { ChatTurn, MediaItem } from '../types/chat';

/** Input modality each media content-part requires from the target model. */
const PART_MODALITY: Record<string, string> = {
  image: 'image',
  audio: 'audio',
  video: 'video',
  document: 'pdf',
};

/** Drop user-attached media the target model can't accept (keep it only when its
 *  inputModalities include that part's type), replacing it with a short note so
 *  the surrounding text stays coherent. Text-only / fully-supported content is
 *  returned unchanged (identity). */
function gateUserContent(content: Content, info: ModelInfo | undefined): Content {
  if (typeof content === 'string') return content;
  const accepts = (mod: string): boolean => info?.inputModalities?.includes(mod) ?? false;
  return content.map((part) => {
    const need = PART_MODALITY[part.type];
    if (need && !accepts(need)) {
      return { type: 'text', text: `[${part.type} attachment omitted — model has no ${part.type} input]` };
    }
    return part;
  });
}

export interface ProjectionOptions {
  /** Label for another model's turns when shown to the target. Defaults to the
   *  model slug, e.g. `[claude-opus-4.8]`. */
  attribution?: (modelId: string) => string;
}

const defaultAttribution = (modelId: string): string => `[${modelId.split('/').pop()}]`;

/** Project the canonical conversation (turns) into the API message list for a
 *  specific target model. This is the SINGLE place messages are built.
 *
 *  Rules (each a no-op for the common case, so plain/same-model chats are
 *  byte-identical to before):
 *   - Plain text, same model → identity (`{role, content}` per turn).
 *   - An assistant turn produced by ANOTHER model → presented as attributed
 *     USER context (`[model]: …`) so the target doesn't mistake it for its own
 *     output. Its media rides along (gated by capability).
 *   - An assistant turn's own generated image → replayed as a synthetic USER
 *     message (assistant messages can't carry images on most providers), only
 *     when the target accepts image input.
 *
 *  Projecting the append-only timeline deterministically means each model's
 *  prefix is stable across sends → prompt-cache friendly. */
export function projectConversation(
  turns: ChatTurn[],
  targetModelId: string | null,
  targetInfo: ModelInfo | undefined,
  options: ProjectionOptions = {},
): Message[] {
  const acceptsImage = targetInfo?.inputModalities?.includes('image') ?? false;
  const label = options.attribution ?? defaultAttribution;
  const out: Message[] = [];

  for (const t of turns) {
    if (t.role === 'user') {
      out.push({ role: 'user', content: gateUserContent(t.apiContent, targetInfo) });
      continue;
    }

    // Assistant turn.
    const text =
      typeof t.apiContent === 'string' && t.apiContent
        ? t.apiContent
        : t.text || (t.media.length > 0 ? '(generated media)' : '');
    const images = acceptsImage ? t.media.filter((m) => m.kind === 'image') : [];
    const fromOther = !!t.model && !!targetModelId && t.model !== targetModelId;

    if (fromOther) {
      // Another model's output → attributed user context for the target.
      const prefix = `${label(t.model as string)}: ${text}`;
      if (images.length === 0) {
        out.push({ role: 'user', content: prefix });
      } else {
        out.push({
          role: 'user',
          content: [{ type: 'text', text: prefix }, ...images.map(mediaItemToImagePart)],
        });
      }
      continue;
    }

    // The target's own (or unattributed) turn.
    out.push({ role: 'assistant', content: text });
    if (images.length > 0) {
      out.push({
        role: 'user',
        content: [
          { type: 'text', text: '[Image generated in the previous turn]' },
          ...images.map(mediaItemToImagePart),
        ],
      });
    }
  }

  return out;
}

/** MediaItem data-URL → an image input content part for replay. */
function mediaItemToImagePart(item: MediaItem): ContentPart {
  const m = /^data:(.*?);base64,(.*)$/.exec(item.url);
  const mimeType = m?.[1] ?? item.mime;
  const data = m?.[2] ?? '';
  return { type: 'image', source: { type: 'base64', mimeType, data } };
}
