import type { QueueSnapshot, TelemetryMetrics } from '@combycode/llm-sdk';
import { formatCost, formatTokens } from '../../lib/cost';

type Inspect = (title: string, data: unknown) => void;

function Stat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <button type="button" className="metric-stat" onClick={onClick}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </button>
  );
}

/** Live metrics — the OTel-metrics numbers + per-queue snapshot. */
export function MetricsPanel({
  metrics,
  queues,
  onInspect,
}: {
  metrics: TelemetryMetrics;
  queues: QueueSnapshot[];
  onInspect: Inspect;
}) {
  const m = metrics;
  return (
    <div className="metrics-panel">
      <div className="metric-grid">
        <Stat label="cost" value={formatCost(m.costUsd)} onClick={() => onInspect('metrics', m)} />
        <Stat label="tokens" value={`${formatTokens(m.inputTokens)}/${formatTokens(m.outputTokens)}`} onClick={() => onInspect('metrics', m)} />
        <Stat label="requests" value={String(m.requests)} onClick={() => onInspect('metrics', m)} />
        <Stat label="completions" value={String(m.completions)} onClick={() => onInspect('metrics', m)} />
        <Stat label="media" value={String(m.mediaGenerated)} onClick={() => onInspect('metrics', m)} />
        <Stat label="in-flight" value={String(m.inFlight)} onClick={() => onInspect('metrics', m)} />
        <Stat label="queued" value={String(m.queueDepth)} onClick={() => onInspect('metrics', m)} />
        <Stat label="retries" value={String(m.retries)} onClick={() => onInspect('metrics', m)} />
        <Stat label="rate-limit" value={String(m.rateLimitHits)} onClick={() => onInspect('metrics', m)} />
        <Stat label="errors" value={String(m.errors)} onClick={() => onInspect('metrics', m)} />
        <Stat
          label="latency"
          value={m.latency.count ? `${Math.round(m.latency.avg)}ms` : '—'}
          onClick={() => onInspect('latency', m.latency)}
        />
      </div>

      {queues.length > 0 && (
        <div className="queues">
          <h4>Queues</h4>
          {queues.map((q) => (
            <button
              type="button"
              key={q.queueName}
              className="queue-row"
              onClick={() => onInspect(`queue ${q.queueName}`, q)}
            >
              <span className="queue-name">{q.queueName}</span>
              <span className="queue-nums">
                <span className="qstat">
                  depth <b className="qval qval-live">{q.depth}</b>
                </span>
                <span className="qsep">·</span>
                <span className="qstat">
                  live <b className="qval qval-live">{q.inFlight}</b>
                </span>
                <span className="qsep">·</span>
                <span className="qstat">
                  done <b className="qval qval-acc">{q.processed}</b>
                </span>
                {q.peakDepth > 1 && (
                  <>
                    <span className="qsep">·</span>
                    <span className="qstat">
                      peak <b className="qval qval-acc">{q.peakDepth}</b>
                    </span>
                  </>
                )}
                {q.rateLimitWaitMs > 0 && (
                  <>
                    <span className="qsep">·</span>
                    <span className="qstat">rl {Math.round(q.rateLimitWaitMs)}ms</span>
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
