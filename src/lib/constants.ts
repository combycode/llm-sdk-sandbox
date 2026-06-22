import type { ProviderName } from '@combycode/llm-sdk';
import type { Settings } from '../types/settings';

export const PROVIDERS: ProviderName[] = ['anthropic', 'openai', 'google', 'xai', 'openrouter'];

export const DEFAULT_SETTINGS: Settings = {
  apiKeys: {},
  rememberKeys: false, // session-only by default; opt in to persist
  system: '',
  temperature: null,
  maxTokens: null,
};

/** GitHub repository for the open-source sandbox (shown in the trust block). */
export const SANDBOX_REPO_URL = 'https://github.com/combycode/llm-sdk-sandbox';
