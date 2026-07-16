import { bytesToBase64, type ContentPart, type DataSource } from '@combycode/llm-sdk';
import type { AttachedFile, ComposerAttachment, MediaItem } from '../types/chat';

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/** mime → file extension for a saved/attached media item. */
export function mimeExt(mime: string): string {
  const key = mime.toLowerCase().split(';')[0].trim();
  if (MIME_EXT[key]) return MIME_EXT[key];
  const sub = key.includes('/') ? key.slice(key.indexOf('/') + 1) : key;
  return sub.replace(/[^a-z0-9]/g, '') || 'bin';
}

let attachSeq = 0;

/** Reference a generated media item for re-attachment — a pure UI action, NO
 *  network. The bytes (if the target model needs them) are resolved later, at
 *  send time, by `resolveMediaSource`. */
export function mediaItemToRef(item: MediaItem): ComposerAttachment {
  attachSeq += 1;
  return {
    kind: 'ref',
    url: item.url,
    mime: item.mime,
    media: item.kind,
    name: `${item.kind}-${attachSeq}.${mimeExt(item.mime)}`,
  };
}

export function attMime(att: ComposerAttachment): string {
  return att.kind === 'file' ? att.file.type || 'application/octet-stream' : att.mime;
}
export function attName(att: ComposerAttachment): string {
  return att.kind === 'file' ? att.file.name : att.name;
}
export function attSize(att: ComposerAttachment): number {
  return att.kind === 'file' ? att.file.size : 0;
}
/** URL for a composer chip thumbnail (image only): local file → object URL,
 *  generated ref → its own URL. Caller revokes object URLs it created. */
export function attPreviewUrl(att: ComposerAttachment): string | undefined {
  if (!attMime(att).startsWith('image/')) return undefined;
  return att.kind === 'file' ? URL.createObjectURL(att.file) : att.url;
}

/** Providers whose media-SOURCE inputs accept a plain URL (their server fetches
 *  it), so we can hand over a remote URL without downloading bytes in-browser. */
const URI_SOURCE_PROVIDERS = new Set(['xai']);
export function providerAcceptsUriSource(provider: string): boolean {
  return URI_SOURCE_PROVIDERS.has(provider);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'a remote host';
  }
}

/** Resolve an attachment to a DataSource for a media SOURCE input (image-edit,
 *  image-to-video, video extend/edit), routed by the target provider:
 *   - local file          → base64 (bytes in hand)
 *   - ref + provider URL-ok → { type:'url' } (no download; provider fetches it)
 *   - ref + needs bytes     → fetch (only same-origin data:/blob:), else throw. */
export async function resolveMediaSource(
  att: ComposerAttachment,
  provider: string,
): Promise<DataSource> {
  if (att.kind === 'file') {
    const bytes = new Uint8Array(await att.file.arrayBuffer());
    return { type: 'base64', mimeType: attMime(att), data: bytesToBase64(bytes) };
  }
  if (providerAcceptsUriSource(provider)) {
    return { type: 'url', url: att.url };
  }
  if (att.url.startsWith('data:') || att.url.startsWith('blob:')) {
    const bytes = new Uint8Array(await (await fetch(att.url)).arrayBuffer());
    return { type: 'base64', mimeType: att.mime, data: bytesToBase64(bytes) };
  }
  throw new Error(
    `The selected model needs the file's bytes, but the attached ${att.media} is only ` +
      `available as a cross-origin URL (${hostOf(att.url)}) the browser can't read. ` +
      `Extend/edit it with an xAI model (e.g. grok-imagine-video), or upload the file directly.`,
  );
}

export interface PreparedAttachment {
  part: ContentPart;
  file: AttachedFile;
}

/** Turn a composer attachment into a library content part (+ display metadata)
 *  for the CHAT path. Local files embed their bytes; refs pass their URL as the
 *  source (fetching bytes only for same-origin data:/blob:). */
export async function prepareAttachment(att: ComposerAttachment): Promise<PreparedAttachment> {
  const mimeType = attMime(att);
  let source: DataSource;
  let previewUrl: string | undefined;

  if (att.kind === 'file') {
    const data = bytesToBase64(new Uint8Array(await att.file.arrayBuffer()));
    source = { type: 'base64', mimeType, data };
    previewUrl = mimeType.startsWith('image/') ? `data:${mimeType};base64,${data}` : undefined;
  } else if (att.url.startsWith('data:') || att.url.startsWith('blob:')) {
    const data = bytesToBase64(new Uint8Array(await (await fetch(att.url)).arrayBuffer()));
    source = { type: 'base64', mimeType, data };
    previewUrl = att.media === 'image' ? att.url : undefined;
  } else {
    source = { type: 'url', url: att.url };
    previewUrl = att.media === 'image' ? att.url : undefined;
  }

  let part: ContentPart;
  if (mimeType.startsWith('image/')) part = { type: 'image', source };
  else if (mimeType.startsWith('audio/')) part = { type: 'audio', source };
  else if (mimeType.startsWith('video/')) part = { type: 'video', source };
  else part = { type: 'document', source };

  return { part, file: { name: attName(att), mime: mimeType, size: attSize(att), previewUrl } };
}
