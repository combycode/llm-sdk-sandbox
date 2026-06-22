import {
  bytesToBase64,
  createMediaOutput,
  MemoryMediaStore,
  type AudioGenRequest,
  type DataSource,
  type EngineHandle,
  type ImageGenRequest,
  type ModelInfo,
  type VideoGenRequest,
} from '@combycode/llm-sdk';
import type { MediaItem } from '../types/chat';
import type { MediaKind, MediaParams } from '../types/media';

/** A browser File → base64 DataSource for source-image (edit / image-to-video). */
async function fileToDataSource(file: File): Promise<DataSource> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { type: 'base64', mimeType: file.type || 'image/png', data: bytesToBase64(bytes) };
}

const MEDIA_TYPES = new Set(['image', 'video', 'tts', 'audio']);

/** A model whose job is to PRODUCE media (image/tts/video), not chat. */
export function isMediaModel(info: ModelInfo | undefined): boolean {
  if (!info) return false;
  return info.mediaOnly === true || MEDIA_TYPES.has(info.type ?? '');
}

/** The output kind a media model produces, for choosing param controls. */
export function mediaKind(info: ModelInfo | undefined): MediaKind {
  const t = info?.type ?? 'image';
  if (t === 'video') return 'video';
  if (t === 'tts' || t === 'audio') return 'audio';
  return 'image';
}

/** Generate media from a prompt and return a ready-to-render data URL. The
 *  `params` record is keyed by normalized param names (from the model's
 *  catalog `mediaParams` spec) and forwarded verbatim — the library maps each
 *  key to the provider's wire param. */
export async function generateMedia(
  model: string,
  info: ModelInfo,
  prompt: string,
  engine: EngineHandle,
  params: MediaParams = {},
  sourceFile?: File,
): Promise<MediaItem> {
  const store = new MemoryMediaStore();
  const media = createMediaOutput({ model, engine, store });
  const kind = mediaKind(info);
  // An attached image becomes the source for image-edit / image-to-video.
  const sourceImage = sourceFile ? await fileToDataSource(sourceFile) : undefined;

  const result =
    kind === 'image'
      ? sourceImage
        ? (
            await media.editImage({
              prompt,
              sourceImage,
              params: params as ImageGenRequest['params'],
            })
          )[0]
        : (await media.generateImage({ prompt, params: params as ImageGenRequest['params'] }))[0]
      : kind === 'video'
        ? await media.generateVideo({
            prompt,
            sourceImage,
            params: params as VideoGenRequest['params'],
          })
        : await media.generateAudio({
            input: prompt,
            params: params as AudioGenRequest['params'],
          });

  if (!result) throw new Error('media generation returned no result');
  const loaded = await store.load(result.id);
  if (!loaded) throw new Error('generated media missing from store');

  // The library already normalizes provider quirks (e.g. Google TTS's raw L16
  // PCM is WAV-wrapped inside the SDK), so the bytes + mime are ready to render.
  const mime = result.mimeType;
  const itemKind: MediaItem['kind'] = mime.startsWith('image/')
    ? 'image'
    : mime.startsWith('video/')
      ? 'video'
      : 'audio';

  return { kind: itemKind, mime, url: `data:${mime};base64,${bytesToBase64(loaded.data)}` };
}
