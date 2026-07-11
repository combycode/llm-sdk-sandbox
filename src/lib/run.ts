import { createLLM, type EngineHandle, type Message, type Tool } from '@combycode/llm-sdk';
import type { MediaItem, OutputFile } from '../types/chat';

export interface StreamCallbacks {
  onText: (delta: string) => void;
  onMedia: (item: MediaItem) => void;
  /** A hosted-tool output file (code-execution artifact) was retrieved. */
  onFile: (file: OutputFile) => void;
  /** A provider-run builtin tool (web_search/code_interpreter) began executing. */
  onToolStart: (tool: string) => void;
  /** A provider-run builtin tool finished, with what it ran (code/output, or the
   *  search query / opened url). */
  onToolEnd: (
    tool: string,
    payload: { code?: string; query?: string; output?: string; url?: string },
  ) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export interface RunParams {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  /** Hosted builtin tools to offer (already gated to the model's capabilities). */
  tools?: Tool[];
  signal?: AbortSignal;
}

/** Stream a chat completion for the given model + history. Text deltas, any inline
 *  media (e.g. Gemini image output), and hosted-tool output files (code-execution
 *  charts/CSVs, fetched via `retrieveFile`) are surfaced via callbacks. */
export async function streamChat(
  model: string,
  messages: Message[],
  engine: EngineHandle,
  params: RunParams,
  cb: StreamCallbacks,
): Promise<void> {
  const llm = createLLM({ model, engine, system: params.system || undefined });
  try {
    let mime = '';
    let kind: MediaItem['kind'] = 'image';
    let b64 = '';
    for await (const ev of llm.stream(messages, {
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      tools: params.tools,
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
        case 'file': {
          // Bound to THIS llm (same model + key) — fetch the bytes as a blob: URL.
          // Some providers (Anthropic's Files API) don't allow browser CORS, so a
          // fetch can fail — surface that per-file instead of failing the whole turn.
          if (params.signal?.aborted) break;
          try {
            const { blob, name, mimeType, size } = await llm.retrieveFile(ev.file);
            cb.onFile({ name: name ?? 'file', mime: mimeType, size, url: URL.createObjectURL(blob) });
          } catch (fileErr) {
            const reason =
              fileErr instanceof TypeError // browser CORS/network failure surfaces as TypeError
                ? "can't download in the browser (provider doesn't allow direct browser access)"
                : fileErr instanceof Error
                  ? fileErr.message
                  : 'download failed';
            cb.onFile({ name: ev.file.name ?? 'file', mime: ev.file.mimeType ?? '', size: 0, url: '', error: reason });
          }
          break;
        }
        case 'builtin_tool_start':
          cb.onToolStart(ev.tool);
          break;
        case 'builtin_tool_end':
          cb.onToolEnd(ev.tool, { code: ev.code, query: ev.query, output: ev.output, url: ev.url });
          break;
        case 'error':
          throw ev.error;
      }
    }
    cb.onDone();
  } catch (e) {
    cb.onError(e instanceof Error ? e : new Error(String(e)));
  } finally {
    llm.destroy();
  }
}
