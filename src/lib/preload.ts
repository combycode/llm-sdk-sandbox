/**
 * preload.ts — read a docs-launched example descriptor from the URL.
 *
 * The docs site links to `…/?ex=<base64url(JSON)>` where the JSON is a compact
 * chat descriptor:  { m: model, p?: prompt, s?: system, a?: attach-kind }.
 *
 * We PREFILL the chat (model + system + prompt) and, for recognition examples,
 * record which attachment the example expects so the UI can highlight 📎.
 * Nothing is auto-sent — the user pulls the trigger.
 *
 * Parsed once and cached; safe to call from multiple components / state inits.
 */

export type AttachKind = 'image' | 'pdf' | 'audio';

export interface Preload {
  model?: string;
  prompt?: string;
  system?: string;
  attach?: AttachKind;
}

let cached: Preload | null | undefined;

/** base64url → UTF-8 string (handles missing padding and URL-safe alphabet). */
function decodeB64Url(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Parse the `?ex=` descriptor once. Returns null when absent or malformed. */
export function readPreload(): Preload | null {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    if (typeof location === 'undefined') return cached;
    const ex = new URLSearchParams(location.search).get('ex');
    if (!ex) return cached;
    const obj = JSON.parse(decodeB64Url(ex)) as Record<string, unknown>;
    if (typeof obj !== 'object' || obj === null) return cached;
    const p: Preload = {};
    if (typeof obj.m === 'string') p.model = obj.m;
    if (typeof obj.p === 'string') p.prompt = obj.p;
    if (typeof obj.s === 'string') p.system = obj.s;
    if (obj.a === 'image' || obj.a === 'pdf' || obj.a === 'audio') p.attach = obj.a;
    cached = p;
  } catch {
    cached = null; // malformed arg — ignore, open the sandbox blank
  }
  return cached;
}

/** Human label for the attachment a recognition example expects. */
export function attachLabel(kind: AttachKind): string {
  return kind === 'image' ? 'an image' : kind === 'pdf' ? 'a PDF' : 'an audio file';
}
