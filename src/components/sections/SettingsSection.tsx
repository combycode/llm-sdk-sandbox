import type { ProviderName } from '@combycode/llm-sdk';
import { PROVIDERS } from '../../lib/constants';
import { useEngine } from '../../state/EngineContext';
import { Collapsible } from '../../ui/Collapsible';
import { SettingsPanel } from './SettingsPanel';

/** Provider segment of a "provider/model" id (null when unset/malformed). */
function providerOf(model: string | null): ProviderName | null {
  if (!model) return null;
  const slash = model.indexOf('/');
  const p = slash > 0 ? model.slice(0, slash) : '';
  return (PROVIDERS as string[]).includes(p) ? (p as ProviderName) : null;
}

export function SettingsSection() {
  const { settings, updateSettings, selectedModel, guide } = useEngine();
  const hasKeys = Object.values(settings.apiKeys).some(Boolean);

  // During a guided launch, if the selected model's provider has no key yet,
  // highlight that field and force Settings open so the guide is visible.
  const needProvider = providerOf(selectedModel);
  const guideProvider =
    guide.active && needProvider && !settings.apiKeys[needProvider] ? needProvider : null;

  return (
    <Collapsible title="Settings" defaultOpen={!hasKeys || !!guideProvider}>
      <SettingsPanel
        settings={settings}
        providers={PROVIDERS}
        onChange={updateSettings}
        guideProvider={guideProvider}
      />
    </Collapsible>
  );
}
