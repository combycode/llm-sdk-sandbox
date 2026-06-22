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
  /** Assistant turns: the model that produced them ("provider/slug"). */
  model?: string;
  pending?: boolean;
  error?: string;
  /** Assistant turns: tokens/cost/time once the response completes. */
  stats?: TurnStats;
}
