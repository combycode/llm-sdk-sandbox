import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Logger,
  TelemetryAdapter,
  type LogEvent,
  type QueueSnapshot,
  type Span,
  type TelemetryEvent,
  type TelemetryMetrics,
} from '@combycode/llm-sdk';
import { useEngine } from './EngineContext';

export interface TelemetryView {
  metrics: TelemetryMetrics;
  events: TelemetryEvent[];
  spans: Span[];
  logs: LogEvent[];
  queues: QueueSnapshot[];
  sessionId: string;
  /** Trimmed JSON debug bundle (resource/metrics/spans/events) for download. */
  serialize: () => string;
}

const EMPTY_METRICS: TelemetryMetrics = {
  requests: 0,
  errors: 0,
  retries: 0,
  rateLimitHits: 0,
  completions: 0,
  mediaGenerated: 0,
  costUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  inFlight: 0,
  queueDepth: 0,
  latency: { count: 0, min: 0, max: 0, avg: 0 },
};

const Ctx = createContext<TelemetryView | null>(null);

/** Owns the library's TelemetryAdapter + a capturing Logger sink for this
 *  engine, and re-renders consumers (throttled) as events flow. The library is
 *  the single source of truth — this only reads it. */
export function TelemetryProvider({ children }: { children: ReactNode }) {
  const { engine } = useEngine();
  const ref = useRef<{ adapter: TelemetryAdapter; logs: LogEvent[] } | null>(null);
  const [, setVersion] = useState(0);

  useEffect(() => {
    const logs: LogEvent[] = [];
    const logger = new Logger({
      sinks: [
        {
          log(e: LogEvent) {
            logs.push(e);
            if (logs.length > 1000) logs.shift();
          },
        },
      ],
      minLevel: 'debug',
    }).attach(engine.hooks);

    const adapter = new TelemetryAdapter(engine.hooks, {
      resource: { serviceName: 'llm-sandbox', serviceInstanceId: engine.sessionId },
    });
    ref.current = { adapter, logs };

    // Coalesce the firehose into a steady re-render.
    let dirty = true;
    const unsub = engine.hooks.onAny(() => {
      dirty = true;
    });
    const id = setInterval(() => {
      if (dirty) {
        dirty = false;
        setVersion((v) => v + 1);
      }
    }, 400);

    return () => {
      clearInterval(id);
      unsub();
      adapter.destroy();
      logger.detach();
      ref.current = null;
    };
  }, [engine]);

  const t = ref.current;
  const view: TelemetryView = t
    ? {
        metrics: t.adapter.metrics,
        events: t.adapter.events,
        spans: t.adapter.spans,
        logs: t.logs,
        queues: engine.network.snapshot(),
        sessionId: engine.sessionId,
        serialize: () => t.adapter.serialize(),
      }
    : {
        metrics: EMPTY_METRICS,
        events: [],
        spans: [],
        logs: [],
        queues: [],
        sessionId: engine.sessionId,
        serialize: () => '{}',
      };

  return <Ctx.Provider value={view}>{children}</Ctx.Provider>;
}

export function useTelemetry(): TelemetryView {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTelemetry must be used within <TelemetryProvider>');
  return v;
}
