// Stub for the optional `tiktoken` dependency. The sandbox never reaches the
// library's lazy `import('tiktoken')` (no exact token counting), so this empty
// module satisfies the bundler without pulling in the wasm.
export default {};
