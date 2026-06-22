# llm-sdk sandbox

A browser SPA for **@combycode/llm-sdk** — chat with any provider, switch models
mid-conversation, attach files, and render media outputs. BYOK (keys stay in
your browser's localStorage).

## Run

```sh
cd sandbox
bun install
bun run dev          # Vite dev server — open the printed http://localhost URL
```

Build the library first if you haven't: `cd ../unified-library-ts && bun run build`.

## Use

1. Open **Settings** → paste a provider key (Anthropic / OpenAI / Google / xAI / OpenRouter).
2. Pick a model:
   - **Browse** — searchable dropdown over the catalog (capability/price hints).
   - **Smart** — a capability query (`type:chat; vision; cheap`) → ranked results, best highlighted.
3. Type a prompt (attach files with 📎), **Send** (or Ctrl/⌘+Enter).
4. **Switch the model between turns** — the same conversation continues. The SDK
   resends history on model-bound providers and keeps it server-side where it can.

Chat, vision, and file inputs work for chat models; image/tts/video models render
generated media inline (in-memory store). Agents get their own tab later.

## Scripts

- `bun run dev` — dev server
- `bun run build` — typecheck + production build to `dist/`
- `bun run typecheck` — `tsc --noEmit`
