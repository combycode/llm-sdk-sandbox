/** The media-output kind a selected model produces (tts collapses to audio). */
export type MediaKind = 'image' | 'video' | 'audio';

/** User-selected media generation params, keyed by normalized param name
 *  (the same keys the model's `mediaParams` catalog spec declares). Values are
 *  forwarded verbatim to the generate call; the library maps them to wire
 *  names. Only explicitly set params are present. */
export type MediaParams = Record<string, string | number>;
