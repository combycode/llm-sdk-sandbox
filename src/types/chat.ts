import type { Content } from '@combycode/llm-sdk';

export interface MediaItem {
  kind: 'image' | 'audio' | 'video';
  /** data: or blob: URL ready to drop into <img>/<audio>/<video>. */
  url: string;
  mime: string;
}

export interface AttachedFile {
  name: string;
  mime: string;
  size: number;
  /** Set for images so the composer can show a thumbnail. */
  previewUrl?: string;
}

/** A file a hosted tool produced (e.g. a code-execution chart/CSV), fetched via
 *  `retrieveFile` into a blob: URL ready to preview or download. */
export interface OutputFile {
  name: string;
  mime: string;
  size: number;
  /** blob: URL of the retrieved bytes. Revoked on reset. Empty when `error` is set. */
  url: string;
  /** Set when the bytes couldn't be retrieved in the browser (e.g. Anthropic's Files
   *  API doesn't allow CORS) — the file is shown as unavailable rather than crashing. */
  error?: string;
}

/** A hosted (provider-run) builtin tool the model invoked this turn — driven by the
 *  library's `builtin_tool_start`/`builtin_tool_end` stream events. `running` powers
 *  the live "Searching…/Running code…" indicator; once done it reads as "what ran". */
export interface ToolActivity {
  /** Unified tool id: 'web_search' | 'code_interpreter'. */
  tool: string;
  running: boolean;
  /** What the tool ran, revealed when the badge is expanded (set on completion). */
  code?: string;
  output?: string;
  query?: string;
  /** web_search: the URL the model opened/read (open_page/find), instead of a query. */
  url?: string;
}

/** Per-message metering, shown under assistant turns and summed per session. */
export interface TurnStats {
  inputTokens: number;
  outputTokens: number;
  /** USD from catalog pricing. null = unknown (e.g. token-priced media with no
   *  captured usage) — shown as "—" rather than a misleading $0. */
  cost: number | null;
  /** Wall-clock time from send to completion. */
  elapsedMs: number;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  /** Exact content sent to the model when this turn is replayed as history. */
  apiContent: Content;
  /** Display text (markdown for assistant turns). */
  text: string;
  media: MediaItem[];
  files: AttachedFile[];
  /** Assistant turns: files produced by hosted tools (code-execution artifacts). */
  outputs: OutputFile[];
  /** Assistant turns: hosted builtin-tool activity (running → done), from the
   *  library's builtin_tool_start/end stream events. */
  toolActivity?: ToolActivity[];
  /** Assistant turns: the model that produced them ("provider/slug"). */
  model?: string;
  pending?: boolean;
  error?: string;
  /** Assistant turns: tokens/cost/time once the response completes. */
  stats?: TurnStats;
}
