import { createLLM, type EngineHandle, type Message } from '@combycode/llm-sdk';
import type { MediaItem } from '../types/chat';

export interface StreamCallbacks {
  onText: (delta: string) => void;
  onMedia: (item: MediaItem) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export interface RunParams {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/** Stream a chat completion for the given model + history. Text deltas and any
 *  inline media (e.g. Gemini image output) are surfaced via callbacks. */
export async function streamChat(
  model: string,
  messages: Message[],
  engine: EngineHandle,
  params: RunParams,
  cb: StreamCallbacks,
): Promise<void> {
  try {
    const llm = createLLM({ model, engine, system: params.system || undefined });
    let mime = '';
    let kind: MediaItem['kind'] = 'image';
    let b64 = '';
    for await (const ev of llm.stream(messages, {
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      signal: params.signal,
    })) {
      switch (ev.type) {
        case 'text':
          cb.onText(ev.text);
          break;
        case 'media_start': {
          mime = ev.mimeType;
          const m = String(ev.mediaType);
          kind = m.includes('audio') ? 'audio' : m.includes('video') ? 'video' : 'image';
          b64 = '';
          break;
        }
        case 'media_chunk':
          b64 += ev.data;
          break;
        case 'media_end':
          if (b64) cb.onMedia({ kind, mime, url: `data:${mime};base64,${b64}` });
          break;
        case 'error':
          throw ev.error;
      }
    }
    cb.onDone();
  } catch (e) {
    cb.onError(e instanceof Error ? e : new Error(String(e)));
  }
}
