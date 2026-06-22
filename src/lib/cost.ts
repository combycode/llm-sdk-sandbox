/** Presentation-only formatting for the cost/usage the LIBRARY computes
 *  (`engine.cost`). No cost math lives here — the SDK is the single source of
 *  truth; the sandbox only reads and formats it. */

/** "$0.0021" / "$1.40" / "<$0.0001" — compact USD for tiny sandbox amounts. */
export function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/** "1,234" — thousands-separated integer. */
export function formatTokens(n: number): string {
  return n.toLocaleString('en-US');
}

/** "820ms" / "1.8s" / "1m 04s". */
export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
