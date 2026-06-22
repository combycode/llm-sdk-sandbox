import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { EngineHandle } from '@combycode/llm-sdk';
import { buildEngine } from '../lib/engine';
import { loadMembers, loadSettings, saveMembers, saveSettings } from '../lib/keystore';
import { suggestMemberName } from '../lib/member-name';
import { type AttachKind, readPreload } from '../lib/preload';
import type { ChatMember } from '../types/member';
import type { Settings } from '../types/settings';

/** Guided-prefill state for a docs-launched session: which inputs to highlight
 *  as a "fill this, then Send" guide. Cleared on the first send. */
export interface Guide {
  active: boolean;
  /** Attachment the launched example expects (recognition demos), else null. */
  attach: AttachKind | null;
}

interface EngineContextValue {
  settings: Settings;
  updateSettings: (next: Settings) => void;
  engine: EngineHandle;
  selectedModel: string | null;
  setSelectedModel: (id: string | null) => void;
  /** Saved @-mention chat members (persisted). */
  members: ChatMember[];
  addMember: (model: string) => void;
  renameMember: (model: string, name: string) => void;
  removeMember: (model: string) => void;
  /** Guided prefill (set when launched from a docs "Try in Sandbox" link). */
  guide: Guide;
  /** Dismiss the guide highlights (called on first send / explicit dismiss). */
  endGuide: () => void;
}

const Ctx = createContext<EngineContextValue | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  // Seed from a docs-launched `?ex=` descriptor (model + system) on first paint.
  // The seeded system lives in state only — it is not persisted unless the user
  // later edits Settings, so a launch never clobbers their saved defaults.
  const preload = readPreload();
  const [settings, setSettings] = useState<Settings>(() => {
    const base = loadSettings();
    return preload?.system ? { ...base, system: preload.system } : base;
  });
  const [selectedModel, setSelectedModel] = useState<string | null>(() => preload?.model ?? null);
  const [members, setMembers] = useState<ChatMember[]>(() => loadMembers());
  const [guideActive, setGuideActive] = useState<boolean>(() => !!preload);

  // One app-owned engine, rebuilt whenever settings change.
  const engine = useMemo(() => buildEngine(settings), [settings]);

  const updateSettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };

  const persistMembers = (next: ChatMember[]) => {
    setMembers(next);
    saveMembers(next);
  };
  const addMember = (model: string) => {
    if (members.some((m) => m.model === model)) return;
    persistMembers([...members, { model, name: suggestMemberName(model, members) }]);
  };
  const renameMember = (model: string, name: string) =>
    persistMembers(members.map((m) => (m.model === model ? { ...m, name } : m)));
  const removeMember = (model: string) =>
    persistMembers(members.filter((m) => m.model !== model));

  return (
    <Ctx.Provider
      value={{
        settings,
        updateSettings,
        engine,
        selectedModel,
        setSelectedModel,
        members,
        addMember,
        renameMember,
        removeMember,
        guide: { active: guideActive, attach: preload?.attach ?? null },
        endGuide: () => setGuideActive(false),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useEngine(): EngineContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEngine must be used within <EngineProvider>');
  return v;
}
