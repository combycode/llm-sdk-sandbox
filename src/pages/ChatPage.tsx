import { ChatTranscript } from '../components/sections/ChatTranscript';
import { ContactsSection } from '../components/sections/ContactsSection';
import { ModelSelectorSection } from '../components/sections/ModelSelectorSection';
import { PromptComposer } from '../components/sections/PromptComposer';
import { SessionStatsSection } from '../components/sections/SessionStatsSection';
import { SettingsSection } from '../components/sections/SettingsSection';
import { TrustBlock } from '../components/sections/TrustBlock';
import { ChatProvider } from '../state/ChatContext';

export function ChatPage() {
  return (
    <ChatProvider>
      <div className="chat-layout">
        <aside className="left">
          <SettingsSection />
          <ModelSelectorSection />
          <ContactsSection />
          <SessionStatsSection />
          <TrustBlock />
        </aside>
        <section className="right">
          <ChatTranscript />
          <PromptComposer />
        </section>
      </div>
    </ChatProvider>
  );
}
