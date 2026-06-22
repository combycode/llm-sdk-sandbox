import { useMemo, useState } from 'react';
import type { TelemetryEvent } from '@combycode/llm-sdk';

type Inspect = (title: string, data: unknown) => void;

const CATEGORIES = ['all', 'network', 'llm', 'cost', 'media', 'context', 'error', 'other'];

/** Live hook-event stream. Click a row to inspect the full ctx JSON. */
export function EventsView({
  events,
  onInspect,
}: {
  events: TelemetryEvent[];
  onInspect: Inspect;
}) {
  const [filter, setFilter] = useState('all');

  const shown = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.category === filter)),
    [events, filter],
  );

  return (
    <div className="feed">
      <div className="feed-filters">
        {CATEGORIES.map((c) => (
          <button
            type="button"
            key={c}
            className={`chip${filter === c ? ' active' : ''}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="feed-list">
        {shown.length === 0 && <div className="feed-empty">No events yet — send a message.</div>}
        {shown
          .slice()
          .reverse()
          .map((e) => (
            <button
              type="button"
              key={e.seq}
              className="feed-row"
              onClick={() => onInspect(e.name, e.ctx)}
            >
              <span className={`dot dot-${e.category}`} />
              <span className="feed-name">{e.name}</span>
              <span className="feed-summary">{summarize(e)}</span>
              <span className="feed-trace">{e.traceId ? shortTrace(e.traceId) : '—'}</span>
            </button>
          ))}
      </div>
    </div>
  );
}

const shortTrace = (t: string) => t.split(':').pop()?.slice(0, 10) ?? t;

/** A terse one-liner per event for the feed row. */
function summarize(e: TelemetryEvent): string {
  const c = e.ctx as Record<string, unknown>;
  switch (e.name) {
    case 'onRequestStart':
      return `${c.method} ${String(c.url ?? '').replace(/^https?:\/\//, '').slice(0, 28)}`;
    case 'onRequestComplete':
      return `${c.status} · ${Math.round((c.latencyMs as number) ?? 0)}ms`;
    case 'onCompletion': {
      const u = (c.response as { usage?: { inputTokens?: number; outputTokens?: number } })?.usage;
      return `${c.model} ${u?.inputTokens ?? 0}→${u?.outputTokens ?? 0} tok`;
    }
    case 'onCostEntry': {
      const cost = (c.entry as { cost?: { total?: number; source?: string } })?.cost;
      return `$${(cost?.total ?? 0).toFixed(6)} ${cost?.source ?? ''}`;
    }
    case 'onMediaGenerated':
      return `${c.mediaType} x${c.count}`;
    case 'onStreamChunk':
      return `chunk #${c.chunkIndex}`;
    case 'onRetry':
      return `attempt ${c.attempt} (${c.reason})`;
    case 'onEnqueue':
      return `${c.queueName} q=${c.queueLength}`;
    default:
      return String(c?.provider ?? c?.model ?? '');
  }
}
