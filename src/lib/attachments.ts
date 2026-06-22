import { bytesToBase64, type ContentPart } from '@combycode/llm-sdk';
import type { AttachedFile, MediaItem } from '../types/chat';

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

/** Reconstruct a browser File from a generated media item (data:/blob: URL), so
 *  it can be fed back into the composer as a source image for the next request. */
export async function mediaItemToFile(item: MediaItem): Promise<File> {
  const blob = await (await fetch(item.url)).blob();
  const mime = item.mime || blob.type || 'application/octet-stream';
  attachSeq += 1;
  return new File([blob], `${item.kind}-${attachSeq}.${mimeExt(mime)}`, { type: mime });
}

export interface PreparedAttachment {
  part: ContentPart;
  file: AttachedFile;
}

/** Turn a browser File into a library content part (+ display metadata). */
export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const data = bytesToBase64(bytes);
  const mimeType = file.type || 'application/octet-stream';
  const source = { type: 'base64' as const, mimeType, data };

  let part: ContentPart;
  if (mimeType.startsWith('image/')) part = { type: 'image', source };
  else if (mimeType.startsWith('audio/')) part = { type: 'audio', source };
  else if (mimeType.startsWith('video/')) part = { type: 'video', source };
  else part = { type: 'document', source };

  const previewUrl = mimeType.startsWith('image/') ? `data:${mimeType};base64,${data}` : undefined;
  return { part, file: { name: file.name, mime: mimeType, size: file.size, previewUrl } };
}
