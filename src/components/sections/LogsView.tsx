import { useMemo, useState } from 'react';
import type { LogEvent } from '@combycode/llm-sdk';

type Inspect = (title: string, data: unknown) => void;

const LEVELS = ['all', 'debug', 'info', 'warn', 'error'];

/** Leveled log lines captured from the library Logger (the OTel logs signal). */
export function LogsView({ logs, onInspect }: { logs: LogEvent[]; onInspect: Inspect }) {
  const [level, setLevel] = useState('all');

  const shown = useMemo(
    () => (level === 'all' ? logs : logs.filter((l) => l.level === level)),
    [logs, level],
  );

  return (
    <div className="feed">
      <div className="feed-filters">
        {LEVELS.map((lv) => (
          <button
            type="button"
            key={lv}
            className={`chip${level === lv ? ' active' : ''}`}
            onClick={() => setLevel(lv)}
          >
            {lv}
          </button>
        ))}
      </div>
      <div className="feed-list">
        {shown.length === 0 && <div className="feed-empty">No logs yet.</div>}
        {shown
          .slice()
          .reverse()
          .map((l, i) => (
            <button
              type="button"
              // biome-ignore lint/suspicious/noArrayIndexKey: log events have no id
              key={`${l.timestamp}-${i}`}
              className="log-row"
              onClick={() => onInspect(`${l.level} · ${l.kind}`, l)}
            >
              <span className={`level level-${l.level}`}>{l.level}</span>
              <div className="log-main">
                <span className="log-source">{l.source}</span>
                <span className="log-msg">{l.message ?? l.kind}</span>
              </div>
              <span className="feed-trace">{l.ctx?.requestId?.slice(0, 10) ?? '—'}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
