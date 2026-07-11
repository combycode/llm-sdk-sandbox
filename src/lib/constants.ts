import type { ProviderName } from '@combycode/llm-sdk';
import type { Settings } from '../types/settings';

export const PROVIDERS: ProviderName[] = ['anthropic', 'openai', 'google', 'xai', 'openrouter'];

export const DEFAULT_SETTINGS: Settings = {
  apiKeys: {},
  rememberKeys: false, // session-only by default; opt in to persist
  system: '',
  temperature: null,
  maxTokens: null,
  enabledTools: { webSearch: false, codeInterpreter: false },
};

/** Unified builtin-tool ids the sandbox can offer, with UI labels. Gated per model
 *  against the catalog `capabilities.builtinTools`. */
export const BUILTIN_TOOLS = [
  { id: 'web_search', setting: 'webSearch', label: 'Web search', icon: '🔎' },
  { id: 'code_interpreter', setting: 'codeInterpreter', label: 'Code interpreter', icon: '⚙️' },
] as const;

/** GitHub repository for the open-source sandbox (shown in the trust block). */
export const SANDBOX_REPO_URL = 'https://github.com/combycode/llm-sdk-sandbox';
