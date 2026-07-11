import type { ProviderName } from '@combycode/llm-sdk';
import type { Settings } from '../../types/settings';

const toNum = (v: string): number | null => (v.trim() === '' ? null : Number(v));

export function SettingsPanel({
  settings,
  providers,
  onChange,
  guideProvider = null,
}: {
  settings: Settings;
  providers: ProviderName[];
  onChange: (next: Settings) => void;
  /** Provider whose key a guided launch needs — highlight that input. */
  guideProvider?: ProviderName | null;
}) {
  const setKey = (p: ProviderName, v: string) =>
    onChange({ ...settings, apiKeys: { ...settings.apiKeys, [p]: v || undefined } });

  return (
    <div className="settings">
      <h4>API keys (BYOK)</h4>
      {/* These are `type="text"` (NOT password) so the browser password manager
          ignores them entirely — no "save password?" prompt, no saved-credential
          suggestions dropdown (Chrome ignores autoComplete=off on password fields).
          The value is masked purely visually via CSS `-webkit-text-security` on
          `.key-input`. The non-credential name + password-manager opt-out data-attrs
          are belt-and-suspenders. We persist the key ourselves (session by default). */}
      <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        {providers.map((p) => (
          <label key={p} className="field">
            <span>{p}</span>
            <input
              type="text"
              name={`field-${p}-x`}
              autoComplete="off"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
              data-form-type="other"
              spellCheck={false}
              className={`key-input${guideProvider === p ? ' guide-pulse' : ''}`}
              placeholder={`${p} key`}
              value={settings.apiKeys[p] ?? ''}
              onChange={(e) => setKey(p, e.target.value)}
            />
          </label>
        ))}
      </form>

      <label className="field-check">
        <input
          type="checkbox"
          checked={settings.rememberKeys}
          onChange={(e) => onChange({ ...settings, rememberKeys: e.target.checked })}
        />
        <span>Remember keys on this device</span>
      </label>
      <p className="hint">
        Keys default to this tab only (sessionStorage). Tick the box to persist
        them in this browser (localStorage). Either way they go only to the
        provider you call — never to our servers.
      </p>

      <h4>Defaults</h4>
      <label className="field">
        <span>system</span>
        <textarea
          rows={2}
          value={settings.system}
          onChange={(e) => onChange({ ...settings, system: e.target.value })}
        />
      </label>
      <label className="field">
        <span>temperature</span>
        <input
          type="number"
          step="0.1"
          value={settings.temperature ?? ''}
          onChange={(e) => onChange({ ...settings, temperature: toNum(e.target.value) })}
        />
      </label>
      <label className="field">
        <span>max tokens</span>
        <input
          type="number"
          value={settings.maxTokens ?? ''}
          onChange={(e) => onChange({ ...settings, maxTokens: toNum(e.target.value) })}
        />
      </label>
    </div>
  );
}
