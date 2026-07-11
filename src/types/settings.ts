import type { ProviderName } from '@combycode/llm-sdk';

export type ProviderKeys = Partial<Record<ProviderName, string>>;

export interface Settings {
  /** BYOK keys per provider. Stored in sessionStorage by default; promoted to
   *  localStorage only when `rememberKeys` is on (see keystore.ts). */
  apiKeys: ProviderKeys;
  /** Persist keys to localStorage across browser sessions (opt-in). When false,
   *  keys live in sessionStorage and are cleared when the tab closes. */
  rememberKeys: boolean;
  /** Default system prompt applied to every turn. */
  system: string;
  temperature: number | null;
  maxTokens: number | null;
  /** Hosted server tools to offer the model, when the selected model supports them
   *  (gated against the catalog's `builtinTools`). */
  enabledTools: EnabledTools;
}

export interface EnabledTools {
  webSearch: boolean;
  codeInterpreter: boolean;
}
