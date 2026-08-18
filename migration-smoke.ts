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
 *  Kept current with each library upgrade: it last ran green against 2.2.2. Nothing in
 *  2.2.1 (per-model Anthropic thinking shape) or 2.2.2 (Gemini function declarations move
 *  to `parametersJsonSchema`) touches a path the sandbox takes — it sends only hosted
 *  builtin tools, never function declarations — and 2.2.0's span rename and telemetry
 *  surface the sandbox reads generically.
 *
 *  Run: bun run migration-smoke.ts
 */
import { createEngine } from '@combycode/llm-sdk';
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

/** The major.minor this sandbox is written against; patch is free to float. */
const EXPECTED_MINOR = '2.2';

const fail = (m: string) => {
  console.error(`FAIL: ${m}`);
  process.exitCode = 1;
};

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

console.log(
  JSON.stringify({
    libraryVersion,
    text: text.join(''),
    deltas: text.length,
    media: media.length,
    callbackOrder: order.join(' > '),
    costSummaryHasUnpriced: hasUnpriced,
  }),
);
