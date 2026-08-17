/** 1.7 -> 2.1 migration smoke for the sandbox's OWN runtime paths.
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
 *  Run: bun run migration-smoke.ts
 */
import { createEngine } from '@combycode/llm-sdk';
import { streamChat } from './src/lib/run';
import type { MediaItem } from './src/types/chat';

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

// A 2.1.0 addition the app does not use yet, checked so the panel can adopt it knowingly.
const costs = engine.cost.total();
const hasUnpriced = 'unpriced' in costs;

console.log(
  JSON.stringify({
    libraryVersion: '2.1.0',
    text: text.join(''),
    deltas: text.length,
    media: media.length,
    callbackOrder: order.join(' > '),
    costSummaryHasUnpriced: hasUnpriced,
  }),
);
