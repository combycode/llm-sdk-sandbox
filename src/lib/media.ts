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

/** Already-resolved media source(s) for the request. The caller (send) picks
 *  URL-vs-bytes per the target provider; here we just forward. */
export interface MediaSource {
  sourceImage?: DataSource;
  sourceVideo?: DataSource;
}

const MEDIA_TYPES = new Set(['image', 'video', 'tts', 'audio']);

/** A model whose job is to PRODUCE media (image/tts/video), not chat. */
export function isMediaModel(info: ModelInfo | undefined): boolean {
  if (!info) return false;
  return info.mediaOnly === true || MEDIA_TYPES.has(info.type ?? '');
}

/** A model whose job is to READ audio — speech-to-text.
 *
 *  Not a media model (it produces text, not media) and not a chat model either:
 *  it has its own endpoint. It used to fall through to the chat path, so picking
 *  one and pressing send produced "The requested model 'gpt-transcribe' is not
 *  supported with the Responses API" — an error about our routing, dressed up as
 *  a fact about the model. */
export function isTranscribeModel(info: ModelInfo | undefined): boolean {
  return info?.type === 'stt';
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
  source: MediaSource = {},
): Promise<MediaItem> {
  const store = new MemoryMediaStore();
  // Poll async video a bit faster than the 5s library default so the progress
  // number + completion feel responsive (xAI's own progress is coarse).
  const media = createMediaOutput({ model, engine, store, config: { pollIntervalMs: 2000 } });
  const kind = mediaKind(info);
  const { sourceImage, sourceVideo } = source;

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
            sourceVideo,
            // A source video runs `edit` (default) or `extend` — chosen in the UI
            // via params.videoMode; never hardcoded. No source video = generate.
            params: {
              ...(params as VideoGenRequest['params']),
              ...(sourceVideo
                ? { videoMode: ((params.videoMode as 'edit' | 'extend') || 'edit') }
                : {}),
            },
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

  // Async video (xAI) lives on a cross-origin bucket the browser can't byte-fetch
  // (CORS), so the library hands back `sourceUrl` with empty bytes — play it
  // directly (`<video src>` needs no CORS). Otherwise render the inline bytes.
  const url =
    loaded.data.length === 0 && loaded.meta.sourceUrl
      ? loaded.meta.sourceUrl
      : `data:${mime};base64,${bytesToBase64(loaded.data)}`;

  return { kind: itemKind, mime, url };
}
