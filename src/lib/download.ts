/** Trigger a browser download of in-memory text/JSON. */
export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

/** Trigger a browser download of raw bytes (e.g. a generated .zip). */
export function downloadBytes(filename: string, bytes: Uint8Array, mime = 'application/octet-stream'): void {
  // Copy into a concrete ArrayBuffer — a Uint8Array<ArrayBufferLike> (which may
  // be SharedArrayBuffer-backed) isn't a valid BlobPart under strict DOM types.
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  downloadBlob(filename, new Blob([ab], { type: mime }));
}

/** Download a URL that's already a Blob/data/object URL (e.g. generated media). */
export function downloadUrl(filename: string, url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
