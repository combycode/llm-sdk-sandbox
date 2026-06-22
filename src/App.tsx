import { useState } from 'react';
import { ObservabilitySidebar } from './components/sections/ObservabilitySidebar';
import { Tabs } from './components/Tabs';
import { AgentsPage } from './pages/AgentsPage';
import { ChatPage } from './pages/ChatPage';
import { EngineProvider } from './state/EngineContext';
import { TelemetryProvider } from './state/TelemetryContext';

export function App() {
  const [tab, setTab] = useState('chat');
  const [showObs, setShowObs] = useState(false);

  return (
    <EngineProvider>
      <TelemetryProvider>
        <header className="app-header">
          <a
            className="brand"
            href="https://llm-sdk.combycode.com"
            aria-label="ORXA LLM-SDK home"
          >
            <span className="brand-ring">
              <img src="/ORXA_Logo_Round.svg" alt="ORXA" width={22} height={22} />
            </span>
            <span className="brand-name">
              ORXA <span className="brand-sub">LLM-SDK</span>
              <span className="brand-badge">: Sandbox</span>
            </span>
          </a>
          <Tabs active={tab} onChange={setTab} />
          <button
            type="button"
            className={`obs-toggle${showObs ? ' active' : ''}`}
            onClick={() => setShowObs((v) => !v)}
          >
            ☰ Telemetry
          </button>
        </header>
        <div className="app-body">
          <main className="app-main">{tab === 'chat' ? <ChatPage /> : <AgentsPage />}</main>
          {showObs && <ObservabilitySidebar onClose={() => setShowObs(false)} />}
        </div>
      </TelemetryProvider>
    </EngineProvider>
  );
}
