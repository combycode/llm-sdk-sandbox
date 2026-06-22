import { DEFAULT_SETTINGS } from './constants';
import type { ChatMember } from '../types/member';
import type { ProviderKeys, Settings } from '../types/settings';

// Non-secret settings live in localStorage. API keys are stored SEPARATELY so
// they default to sessionStorage (cleared on tab close) and only land in
// localStorage when the user opts in via `rememberKeys`. A docs-launched key
// should never silently persist.
const META_KEY = 'llm-sdk-sandbox.settings.v1'; // system / temperature / maxTokens / rememberKeys
const KEYS_KEY = 'llm-sdk-sandbox.keys.v1'; // apiKeys (session OR local)
const MEMBERS_KEY = 'llm-sdk-sandbox.members.v1';

type Meta = Omit<Settings, 'apiKeys'>;

function readJson<T>(store: Storage, key: string): T | null {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function loadSettings(): Settings {
  const meta = readJson<Partial<Meta>>(localStorage, META_KEY) ?? {};
  // Keys may be in either store: if remembered they're in localStorage, else
  // sessionStorage. Read whichever holds them (local wins if both somehow set).
  const apiKeys =
    readJson<ProviderKeys>(localStorage, KEYS_KEY) ??
    readJson<ProviderKeys>(sessionStorage, KEYS_KEY) ??
    {};
  return { ...DEFAULT_SETTINGS, ...meta, apiKeys };
}

export function saveSettings(settings: Settings): void {
  const { apiKeys, ...meta } = settings;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* storage unavailable — keep in-memory only */
  }
  // Route keys to the chosen store and clear the other so no stale copy lingers.
  const target = settings.rememberKeys ? localStorage : sessionStorage;
  const other = settings.rememberKeys ? sessionStorage : localStorage;
  try {
    other.removeItem(KEYS_KEY);
    const hasAny = Object.values(apiKeys).some(Boolean);
    if (hasAny) target.setItem(KEYS_KEY, JSON.stringify(apiKeys));
    else target.removeItem(KEYS_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function loadMembers(): ChatMember[] {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY);
    return raw ? (JSON.parse(raw) as ChatMember[]) : [];
  } catch {
    return [];
  }
}

export function saveMembers(members: ChatMember[]): void {
  try {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
  } catch {
    /* storage unavailable */
  }
}
