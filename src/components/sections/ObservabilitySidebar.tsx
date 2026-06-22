import { useState } from 'react';
import { downloadText } from '../../lib/download';
import { useTelemetry } from '../../state/TelemetryContext';
import { JsonModal } from '../../ui/JsonModal';
import { EventsView } from './EventsView';
import { LogsView } from './LogsView';
import { MetricsPanel } from './MetricsPanel';

/** Right observability sidebar: live Metrics section + Events/Logs tabs. Every
 *  row opens its JSON. Reads the library telemetry only — no logic of its own. */
export function ObservabilitySidebar({ onClose }: { onClose: () => void }) {
  const { metrics, events, logs, queues, sessionId, serialize } = useTelemetry();
  const [tab, setTab] = useState<'events' | 'logs'>('events');
  const [modal, setModal] = useState<{ title: string; data: unknown } | null>(null);
  const inspect = (title: string, data: unknown) => setModal({ title, data });

  const exportSession = () =>
    downloadText(`telemetry-${sessionId}.json`, serialize(), 'application/json');

  return (
    <aside className="obs-sidebar">
      <div className="obs-head">
        <strong>Telemetry</strong>
        <code className="obs-session" title="sessionId">
          {sessionId}
        </code>
        <button type="button" className="obs-export" onClick={exportSession} title="Export session JSON">
          ⭳ export
        </button>
        <button type="button" className="obs-close" onClick={onClose} title="Hide">
          ✕
        </button>
      </div>

      <MetricsPanel metrics={metrics} queues={queues} onInspect={inspect} />

      <div className="obs-tabs">
        <button
          type="button"
          className={`obs-tab${tab === 'events' ? ' active' : ''}`}
          onClick={() => setTab('events')}
        >
          Events ({events.length})
        </button>
        <button
          type="button"
          className={`obs-tab${tab === 'logs' ? ' active' : ''}`}
          onClick={() => setTab('logs')}
        >
          Logs ({logs.length})
        </button>
      </div>

      {tab === 'events' ? (
        <EventsView events={events} onInspect={inspect} />
      ) : (
        <LogsView logs={logs} onInspect={inspect} />
      )}

      {modal && <JsonModal title={modal.title} data={modal.data} onClose={() => setModal(null)} />}
    </aside>
  );
}
