import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Content, Message } from '@combycode/llm-sdk';
import { bucketError, trackRunFailed, trackRunStarted, trackRunSucceeded } from '../lib/analytics';
import { mediaItemToFile, prepareAttachment } from '../lib/attachments';
import { generateMedia, isMediaModel } from '../lib/media';
import { findModel } from '../lib/models';
import { projectConversation } from '../lib/projection';
import { streamChat } from '../lib/run';
import type { ChatTurn, MediaItem, TurnStats } from '../types/chat';
import type { MediaParams } from '../types/media';
import { useEngine } from './EngineContext';

const EMPTY_STATS: TurnStats = { inputTokens: 0, outputTokens: 0, cost: null, elapsedMs: 0 };
const mergeStats = (t: ChatTurn, patch: Partial<TurnStats>): TurnStats => ({
  ...EMPTY_STATS,
  ...t.stats,
  ...patch,
});

/** Prompt + files handed back to the composer when a request is stopped. */
export interface Draft {
  text: string;
  files: File[];
}

export interface SessionStats {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  turns: number;
}

interface ChatContextValue {
  turns: ChatTurn[];
  busy: boolean;
  sessionStats: SessionStats;
  send: (text: string, files: File[], mediaParams?: MediaParams) => Promise<void>;
  /** Abort the in-flight request and hand its prompt back via `draft`. */
  stop: () => void;
  reset: () => void;
  /** Set after `stop()` so the composer can refill; cleared via `clearDraft`. */
  draft: Draft | null;
  clearDraft: () => void;
  /** Files queued from the transcript ("attach to prompt"); composer drains them. */
  pendingAttachments: File[];
  /** Reconstruct a File from a generated media item and queue it for the composer. */
  attachToPrompt: (item: MediaItem) => Promise<void>;
  /** Composer calls this once it has absorbed `pendingAttachments`. */
  consumeAttachments: () => void;
}

const Ctx = createContext<ChatContextValue | null>(null);

let counter = 0;
const newId = () => `t${++counter}`;

export function ChatProvider({ children }: { children: ReactNode }) {
  const { engine, selectedModel, settings } = useEngine();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const turnsRef = useRef<ChatTurn[]>([]);
  turnsRef.current = turns;

  // In-flight request bookkeeping for the stop button.
  const abortRef = useRef<AbortController | null>(null);
  const inflightRef = useRef<{ userId: string; assistantId: string; draft: Draft } | null>(null);

  const updateTurn = (id: string, fn: (t: ChatTurn) => ChatTurn) =>
    setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

  const reset = () => setTurns([]);
  const clearDraft = () => setDraft(null);

  const attachToPrompt = async (item: MediaItem) => {
    const file = await mediaItemToFile(item);
    setPendingAttachments((prev) => [...prev, file]);
  };
  const consumeAttachments = () => setPendingAttachments([]);

  const sessionStats = useMemo<SessionStats>(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let cost = 0;
    let counted = 0;
    for (const t of turns) {
      if (!t.stats) continue;
      inputTokens += t.stats.inputTokens;
      outputTokens += t.stats.outputTokens;
      if (t.stats.cost != null) cost += t.stats.cost;
      counted++;
    }
    return { inputTokens, outputTokens, cost, turns: counted };
  }, [turns]);

  // The LIBRARY computes every cost (engine.cost). Subscribe to its ledger and
  // route each entry's cost + tokens to the in-flight assistant turn. The
  // sandbox never computes cost itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: updateTurn is stable
  useEffect(() => {
    const unsub = engine.hooks.on('onCostEntry', ({ entry }) => {
      const inflight = inflightRef.current;
      if (!inflight) return;
      const cost = entry.cost.source === 'unknown' ? null : entry.cost.total;
      updateTurn(inflight.assistantId, (t) =>
        t.role === 'assistant'
          ? {
              ...t,
              stats: mergeStats(t, {
                inputTokens: entry.tokens.input,
                outputTokens: entry.tokens.output,
                cost,
              }),
            }
          : t,
      );
    });
    return unsub;
  }, [engine]);

  const stop = () => {
    const inflight = inflightRef.current;
    abortRef.current?.abort();
    if (inflight) {
      // Drop the in-flight pair and hand the prompt back to the composer.
      setTurns((ts) => ts.filter((t) => t.id !== inflight.userId && t.id !== inflight.assistantId));
      setDraft(inflight.draft);
    }
    inflightRef.current = null;
    abortRef.current = null;
    setBusy(false);
  };

  const send = async (text: string, files: File[], mediaParams: MediaParams = {}) => {
    if (busy || !selectedModel) return;

    // Safe analytics: provider + model only, never prompt/response/key.
    const model = selectedModel;
    const slash = model.indexOf('/');
    const provider = slash > 0 ? model.slice(0, slash) : 'unknown';
    trackRunStarted(provider, model);

    const prepared = await Promise.all(files.map(prepareAttachment));
    const parts = [
      ...prepared.map((p) => p.part),
      ...(text ? [{ type: 'text' as const, text }] : []),
    ];
    const apiContent: Content = parts.length === 1 && parts[0].type === 'text' ? text : parts;

    const userTurn: ChatTurn = {
      id: newId(),
      role: 'user',
      apiContent,
      text,
      media: [],
      files: prepared.map((p) => p.file),
    };
    const assistantTurn: ChatTurn = {
      id: newId(),
      role: 'assistant',
      apiContent: '',
      text: '',
      media: [],
      files: [],
      model: selectedModel,
      pending: true,
    };
    setTurns((t) => [...t, userTurn, assistantTurn]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    inflightRef.current = {
      userId: userTurn.id,
      assistantId: assistantTurn.id,
      draft: { text, files },
    };

    const info = findModel(engine, selectedModel);
    // Single message builder: identity for same-model text; replays prior
    // generated media (capability-gated) and attributes other models' turns.
    const history: Message[] = projectConversation(
      [...turnsRef.current, userTurn],
      selectedModel,
      info,
    );
    const startedAt = performance.now();
    // Cost + tokens arrive via the onCostEntry subscription; finalize only
    // records timing + the rendered content.
    const finalize = (patch: (t: ChatTurn) => Partial<ChatTurn>) => {
      updateTurn(assistantTurn.id, (t) => ({
        ...t,
        pending: false,
        stats: mergeStats(t, { elapsedMs: performance.now() - startedAt }),
        ...patch(t),
      }));
    };

    try {
      if (info && isMediaModel(info)) {
        // An attached image is the source for image-edit / image-to-video.
        const sourceImage = files.find((f) => f.type.startsWith('image/'));
        const item = await generateMedia(selectedModel, info, text, engine, mediaParams, sourceImage);
        if (controller.signal.aborted) return;
        finalize(() => ({ media: [item] }));
        trackRunSucceeded(provider, model);
      } else {
        await streamChat(
          selectedModel,
          history,
          engine,
          {
            system: settings.system,
            temperature: settings.temperature ?? undefined,
            maxTokens: settings.maxTokens ?? undefined,
            signal: controller.signal,
          },
          {
            onText: (delta) =>
              updateTurn(assistantTurn.id, (t) => ({ ...t, text: t.text + delta })),
            onMedia: (item) =>
              updateTurn(assistantTurn.id, (t) => ({ ...t, media: [...t.media, item] })),
            onDone: () => {
              if (!controller.signal.aborted) {
                finalize((t) => ({ apiContent: t.text }));
                trackRunSucceeded(provider, model);
              }
            },
            onError: (err) => {
              if (!controller.signal.aborted) {
                finalize(() => ({ error: err.message }));
                trackRunFailed(provider, model, bucketError(err));
              }
            },
          },
        );
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        finalize(() => ({ error: e instanceof Error ? e.message : String(e) }));
        trackRunFailed(provider, model, bucketError(e));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        inflightRef.current = null;
        setBusy(false);
      }
    }
  };

  return (
    <Ctx.Provider
      value={{
        turns,
        busy,
        sessionStats,
        send,
        stop,
        reset,
        draft,
        clearDraft,
        pendingAttachments,
        attachToPrompt,
        consumeAttachments,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useChat(): ChatContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChat must be used within <ChatProvider>');
  return v;
}
