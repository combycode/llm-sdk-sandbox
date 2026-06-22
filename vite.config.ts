import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The published browser bundle keeps `tiktoken` (optional, wasm) as a dynamic
// import. The sandbox never counts tokens, so alias it to an empty stub rather
// than pulling in the wasm.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      tiktoken: fileURLToPath(new URL('./src/lib/tiktoken-stub.ts', import.meta.url)),
    },
  },
});
