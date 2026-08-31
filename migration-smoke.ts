/** Upgrade smoke for the sandbox's OWN runtime paths.
 *
 *  typecheck, unit tests and a green build all pass without executing a single library
 *  call: they prove the types line up and the bundle compiles, not that a conversation
 *  still works. This drives the app's real entry point — `streamChat` from src/lib/run.ts,
 *  the function every message in the UI goes through — against a stubbed wire, so no
 *  server, no port and no API key are involved.
 *
 *  What it checks is the shape of the SSE contract the app depends on: text deltas
 *  arriving in order, inline media reassembled from start/chunk/end, and the callbacks
 *  firing in the sequence the UI assumes. Those are the things a major upgrade could
 *  break silently while everything still compiles.
 *
 *  Kept current with each library upgrade. Last run against 3.2.1, installed from the
 *  npm registry.
 *
 *  It used to install from a locally packed tarball, and that is how the sandbox spent
 *  three releases on an SDK no commit recorded: `package.json` read
 *  `file:./.pack/llm-sdk.tgz`, so the version vanished from git while the history's last
 *  word on the subject stayed "move to 2.2.2". Read the log, believe the sandbox is on
 *  2.x; read node_modules, find 3.1.0. Depending on the published package puts the
 *  version back where it can be seen.
 *
 *  3.0.0 moves four things the sandbox actually touches, and each has a check below:
 *  the catalog is loaded by DEFAULT (so cost is priced without asking), `hooks.onAny`
 *  hands over one discriminated union instead of `(name, ctx)`, helper surfaces send
 *  the provider's model id rather than our slug, and an explicit `provider` now wins
 *  over a `vendor/` prefix in the model id.
 *
 *  Refreshing it after a library release is one step now, because a published version is
 *  immutable and bun's cache key can therefore be trusted:
 *
 *      bun update @combycode/llm-sdk && bun run migration-smoke.ts
 *
 *  Run: bun run migration-smoke.ts
 */
import { createEngine, createLLM } from '@combycode/llm-sdk';
import { readFileSync } from 'node:fs';
import { streamChat } from './src/lib/run';
import type { MediaItem } from './src/types/chat';

/** The version actually INSTALLED, read from the package on disk.
 *
 *  This was a hardcoded '2.1.0' string, so the smoke cheerfully reported the wrong
 *  version against a 2.2.0 install — a number nobody had checked, printed next to
 *  results that had. Reading it makes the mismatch impossible, and asserting on it turns
 *  a decorative field into the check that catches a forgotten bump. */
const libraryVersion = (
  JSON.parse(
    readFileSync(new URL('./node_modules/@combycode/llm-sdk/package.json', import.meta.url), 'utf8'),
  ) as { version: string }
).version;

/** The major.minor this sandbox is written against; patch is free to float.
 *  Bumped with each upgrade, which is the point: the guard catches the case where
 *  the dependency moved and this file did not. */
const EXPECTED_MINOR = '3.2';

const fail = (m: string) => {
  console.error(`FAIL: ${m}`);
  process.exitCode = 1;
};

/** WHICH build is under test, said out loud rather than assumed.
 *
 *  A `file:` spec is the working tree — what you want while smoking an upgrade
 *  that is not released yet. A registry spec is the published package, which is
 *  the right target once it IS released and the wrong one before, because it
 *  reports on the last release no matter what the working tree says.
 *
 *  Neither is an error, so neither fails here. What WOULD be an error is not
 *  knowing which one ran, so the answer is printed with the results, and the
 *  version guard below stays hard either way. */
const declaredDep = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>;
  }
).dependencies?.['@combycode/llm-sdk'];
const source = declaredDep?.startsWith('file:') ? 'working tree (packed)' : `registry ${declaredDep}`;

/** A minimal Anthropic SSE stream: two text deltas, then a clean stop. */
const TEXT_STREAM = [
  'event: message_start\ndata: {"type":"message_start","message":{"id":"m","type":"message","role":"assistant","model":"claude","content":[],"usage":{"input_tokens":5,"output_tokens":0}}}\n\n',
  'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
  'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":", world"}}\n\n',
  'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
  'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":3}}\n\n',
  'event: message_stop\ndata: {"type":"message_stop"}\n\n',
].join('');

const sseFetch = (body: string): typeof globalThis.fetch =>
  (async () =>
    new Response(new TextEncoder().encode(body), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })) as unknown as typeof globalThis.fetch;

const engine = createEngine({
  catalog: 'defaults',
  apiKeys: { anthropic: 'stub-key' },
  fetch: sseFetch(TEXT_STREAM),
});

// ── the path every message in the UI takes ──────────────────────────────────
const text: string[] = [];
const media: MediaItem[] = [];
const order: string[] = [];
let done = false;
let error: Error | null = null;

await streamChat(
  'anthropic/claude-haiku-4.5',
  [{ role: 'user', content: 'hi' }],
  engine,
  { maxTokens: 64 },
  {
    onText: (d) => {
      text.push(d);
      order.push('text');
    },
    onMedia: (m) => {
      media.push(m);
      order.push('media');
    },
    onFile: () => order.push('file'),
    onToolStart: () => order.push('toolStart'),
    onToolEnd: () => order.push('toolEnd'),
    onDone: () => {
      done = true;
      order.push('done');
    },
    onError: (e) => {
      error = e;
    },
  },
);

if (error) fail(`streamChat reported an error: ${(error as Error).message}`);
if (text.join('') !== 'Hello, world') fail(`text deltas did not reassemble: ${JSON.stringify(text)}`);
if (!done) fail('onDone never fired — the UI would spin forever');
if (order[order.length - 1] !== 'done') fail(`onDone must be last, got ${order.join(' > ')}`);

// ── the app also depends on the engine surfaces it wires at startup ─────────
if (typeof engine.cost.total !== 'function') fail('engine.cost.total is gone — the cost panel would break');
if (typeof engine.hooks.on !== 'function') fail('engine.hooks.on is gone — telemetry and logs would break');

// Catches a forgotten dependency bump: the version printed below must be one this file
// was actually written against, not whatever happens to be installed.
if (!libraryVersion.startsWith(`${EXPECTED_MINOR}.`)) {
  fail(`installed @combycode/llm-sdk is ${libraryVersion}, expected ${EXPECTED_MINOR}.x — bump the dependency or this file`);
}

const costs = engine.cost.total();
const hasUnpriced = 'unpriced' in costs;

// ── 3.0.0: the catalog is loaded by DEFAULT, so a run is priced ─────────────
// This engine passes `catalog: 'defaults'` explicitly, which still works. The change
// that matters is what happens WITHOUT it: cost used to fall back to an unpriced
// entry unless the caller opted in, and nothing said so.
if (costs.unpriced > 0) {
  fail(`a catalogued model was still unpriced: ${costs.unpricedModels.join(', ')}`);
}

// `registerAsDefault: false` because the first engine already claimed the default
// slot — the library refuses a silent second registration, which is the right call.
const defaultEngine = createEngine({
  registerAsDefault: false,
  apiKeys: { anthropic: 'stub-key' },
  fetch: sseFetch(TEXT_STREAM),
});
if (defaultEngine.catalog.list().length === 0) {
  fail('createEngine() with no catalog option must load the bundled catalogs in 3.0.0');
}

// ── 3.0.0: the whole event stream is one union ─────────────────────────────
// The sandbox subscribes per-event today, which is unchanged. This checks the
// surface it would use for a log or a metrics tap, because that is the shape that
// broke: the handler takes ONE argument now.
const seen: string[] = [];
const untap = defaultEngine.hooks.onAny((event) => {
  seen.push(event.type);
  // Narrowing, not casting: `event.ctx` is typed by `event.type`.
  if (event.type === 'onWarning' && !event.ctx.code) fail('a warning arrived with no code');
});
defaultEngine.hooks.emitSync('onWarning', { source: 'engine', code: 'smoke', message: 'x' });
untap();
if (seen[0] !== 'onWarning') fail(`onAny must deliver { type, ctx }; got ${JSON.stringify(seen)}`);

// ── 3.0.0: an explicit provider beats a vendor prefix in the model id ──────
// Checked through the PUBLIC path — where the request is addressed — because that
// is what went wrong: an explicit `provider: 'openrouter'` lost to the `openai/`
// prefix and the OpenRouter key was sent to api.openai.com. `resolveModel` itself
// is internal, and asserting on an import that may not exist is a check that
// cannot fail.
let routedTo = '';
const routeSpy = (async (url: unknown) => {
  routedTo = String(url);
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
}) as unknown as typeof globalThis.fetch;

const orEngine = createEngine({ registerAsDefault: false, fetch: routeSpy });
const orClient = createLLM({
  engine: orEngine,
  provider: 'openrouter',
  model: 'openai/gpt-5.4-nano',
  apiKey: 'sk-or-v1-stub',
});
await orClient.complete('hi', { maxTokens: 4 }).catch(() => undefined);
if (!routedTo.includes('openrouter.ai')) {
  fail(`an openrouter client must call openrouter.ai, went to: ${routedTo || '(nowhere)'}`);
}
await orEngine.destroy();

// —— media: the start/chunk/end reassembly the gallery depends on ———————
// The header above has claimed this was covered since 1.x. It was not: TEXT_STREAM
// carries no media, so `onMedia` was wired, counted, and never once called — the
// reported `media: 0` looked like a fact about the stream rather than a hole in the
// test. A Gemini inline image is the shape the sandbox actually renders.
const MEDIA_STREAM =
  'data: {"candidates":[{"content":{"role":"model","parts":[{"inlineData":{"mimeType":"image/png","data":"iVBORw0KGgoAAAANSUhEUg=="}}]}}],"usageMetadata":{"promptTokenCount":4,"candidatesTokenCount":1}}\n\n';

const mediaEngine = createEngine({
  registerAsDefault: false,
  apiKeys: { google: 'stub-key' },
  fetch: sseFetch(MEDIA_STREAM),
});

const gotMedia: MediaItem[] = [];
await streamChat(
  'google/gemini-2.5-flash-image',
  [{ role: 'user', content: 'draw' }],
  mediaEngine,
  { maxTokens: 64 },
  {
    onText: () => {},
    onMedia: (m) => gotMedia.push(m),
    onFile: () => {},
    onToolStart: () => {},
    onToolEnd: () => {},
    onDone: () => {},
    onError: (e) => fail(`the media stream errored: ${e.message}`),
  },
);

if (gotMedia.length !== 1) fail(`expected exactly one media item, got ${gotMedia.length}`);
if (gotMedia[0]?.kind !== 'image') fail(`media kind should be image, got ${gotMedia[0]?.kind}`);
if (gotMedia[0]?.mime !== 'image/png') fail(`media mime should be image/png, got ${gotMedia[0]?.mime}`);
// The bytes matter: a media_end that fires with an empty buffer renders a broken <img>.
if (gotMedia[0]?.url !== 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==') {
  fail(`media did not reassemble into a data URL: ${gotMedia[0]?.url.slice(0, 48)}`);
}
await mediaEngine.destroy();

await defaultEngine.destroy();

console.log(
  JSON.stringify({
    libraryVersion,
    source,
    text: text.join(''),
    deltas: text.length,
    media: media.length,
    mediaReassembled: gotMedia.length,
    callbackOrder: order.join(' > '),
    costSummaryHasUnpriced: hasUnpriced,
    unpriced: costs.unpriced,
    catalogLoadedByDefault: true,
    onAnyDeliveredUnion: seen[0] === 'onWarning',
    openrouterRoutedTo: new URL(routedTo).host,
  }),
);
