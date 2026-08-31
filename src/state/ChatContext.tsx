import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { transcribe } from '@combycode/llm-sdk';
import type { BuiltinTool, Content, DataSource, Message, Tool } from '@combycode/llm-sdk';
import { bucketError, trackRunFailed, trackRunStarted, trackRunSucceeded } from '../lib/analytics';
import {
  attMime,
  mediaItemToRef,
  prepareAttachment,
  resolveMediaSource,
} from '../lib/attachments';
import { BUILTIN_TOOLS } from '../lib/constants';
import { generateMedia, isMediaModel, isTranscribeModel } from '../lib/media';
import { findModel } from '../lib/models';
import { projectConversation } from '../lib/projection';
import { streamChat } from '../lib/run';
import type { ChatTurn, ComposerAttachment, MediaItem, TurnStats } from '../types/chat';
import type { MediaParams } from '../types/media';
import { useEngine } from './EngineContext';

const EMPTY_STATS: TurnStats = { inputTokens: 0, outputTokens: 0, cost: null, elapsedMs: 0 };
const mergeStats = (t: ChatTurn, patch: Partial<TurnStats>): TurnStats => ({
  ...EMPTY_STATS,
  ...t.stats,
  ...patch,
});

/** Prompt + attachments handed back to the composer when a request is stopped. */
export interface Draft {
  text: string;
  files: ComposerAttachment[];
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
  send: (text: string, files: ComposerAttachment[], mediaParams?: MediaParams) => Promise<void>;
  /** Abort the in-flight request and hand its prompt back via `draft`. */
  stop: () => void;
  reset: () => void;
  /** Set after `stop()` so the composer can refill; cleared via `clearDraft`. */
  draft: Draft | null;
  clearDraft: () => void;
  /** Attachments queued from the transcript ("attach to prompt"); composer drains them. */
  pendingAttachments: ComposerAttachment[];
  /** Reference a generated media item and queue it for the composer (no fetch). */
  attachToPrompt: (item: MediaItem) => void;
  /** Composer calls this once it has absorbed `pendingAttachments`. */
  consumeAttachments: () => void;
}

const Ctx = createContext<ChatContextValue | null>(null);

/** Turn ids must be unique for the LIFE OF THE PAGE, not the life of the module.
 *
 *  This was `t${++counter}` over a module-scope counter, and `updateTurn` writes
 *  to EVERY turn whose id matches — so two turns sharing an id both receive the
 *  same text. Re-evaluating the module resets the counter while the turns already
 *  on screen keep their old ids, which is exactly what a hot reload does: mid-test
 *  editing put one model's answer under another model's question. Users never hit
 *  it (no HMR in a build, and a reload clears the turns), but an id that can
 *  collide is a bug waiting for a second reason to happen. */
const newId = () => crypto.randomUUID();

export function ChatProvider({ children }: { children: ReactNode }) {
  const { engine, selectedModel, settings } = useEngine();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ComposerAttachment[]>([]);
  const turnsRef = useRef<ChatTurn[]>([]);
  turnsRef.current = turns;

  // In-flight request bookkeeping for the stop button.
  const abortRef = useRef<AbortController | null>(null);
  const inflightRef = useRef<{ userId: string; assistantId: string; draft: Draft } | null>(null);

  const updateTurn = (id: string, fn: (t: ChatTurn) => ChatTurn) =>
    setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));

  const reset = () => {
    // Free retrieved-file blob URLs before dropping the turns that hold them.
    for (const t of turnsRef.current) for (const o of t.outputs) URL.revokeObjectURL(o.url);
    setTurns([]);
  };
  const clearDraft = () => setDraft(null);

  // Pure UI: queue a reference to the generated item — no network. The bytes (if
  // the eventual target model needs them) are resolved at send time.
  const attachToPrompt = (item: MediaItem) => {
    setPendingAttachments((prev) => [...prev, mediaItemToRef(item)]);
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

  // Async video (extend/edit/generate) reports progress each poll — route it to
  // the in-flight assistant turn so the UI can show a bar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: updateTurn is stable
  useEffect(() => {
    const unsub = engine.hooks.on('onMediaProgress', ({ progress }) => {
      const inflight = inflightRef.current;
      if (!inflight || progress == null) return;
      updateTurn(inflight.assistantId, (t) =>
        t.role === 'assistant' ? { ...t, mediaProgress: progress } : t,
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

  const send = async (text: string, files: ComposerAttachment[], mediaParams: MediaParams = {}) => {
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
      outputs: [],
    };
    const assistantTurn: ChatTurn = {
      id: newId(),
      role: 'assistant',
      apiContent: '',
      text: '',
      media: [],
      files: [],
      outputs: [],
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
      if (info && isTranscribeModel(info)) {
        // Speech-to-text has its own endpoint; the chat path rejects these models
        // outright ("not supported with the Responses API") -- an error about our
        // routing wearing the shape of a fact about the model. It needs audio to
        // read, so say that plainly rather than sending a doomed request.
        const audioAtt = files.find((f) => attMime(f).startsWith('audio/'));
        if (!audioAtt) {
          throw new Error(`${selectedModel} transcribes audio - attach an audio file and send again.`);
        }
        const ds = await resolveMediaSource(audioAtt, provider);
        if (ds.type !== 'base64') {
          throw new Error('The attached audio could not be read as bytes in the browser.');
        }
        const bytes = Uint8Array.from(atob(ds.data), (c) => c.charCodeAt(0));
        const res = await transcribe({
          model: selectedModel,
          apiKey: engine.apiKeys[provider as keyof typeof engine.apiKeys],
          audio: { data: bytes, mimeType: attMime(audioAtt) },
          engine,
        });
        if (controller.signal.aborted) return;
        finalize(() => ({ text: res.text }));
        return;
      }

      if (info && isMediaModel(info)) {
        // Attached image → image-edit / image-to-video; attached video → extend.
        // Resolve the source HERE (send time) per the target provider: xAI takes
        // a URL, others need bytes (throws a clear error if it can't get them).
        const imgAtt = files.find((f) => attMime(f).startsWith('image/'));
        const vidAtt = files.find((f) => attMime(f).startsWith('video/'));
        const srcAtt = imgAtt ?? vidAtt;
        // A video source needs a model that accepts extend/edit (catalog flag).
        if (srcAtt && srcAtt === vidAtt && info.capabilities.videoExtension !== true) {
          throw new Error(
            `${selectedModel} can't extend or edit video — it only generates. ` +
              `Switch to a model that supports it (e.g. xai/grok-imagine-video).`,
          );
        }
        const source: { sourceImage?: DataSource; sourceVideo?: DataSource } = {};
        if (srcAtt) {
          const ds = await resolveMediaSource(srcAtt, provider);
          if (srcAtt === vidAtt) source.sourceVideo = ds;
          else source.sourceImage = ds;
        }
        const item = await generateMedia(selectedModel, info, text, engine, mediaParams, source);
        if (controller.signal.aborted) return;
        finalize(() => ({ media: [item] }));
        trackRunSucceeded(provider, model);
      } else {
        // Offer only the hosted tools the user enabled AND the model supports
        // (gated against the catalog's builtinTools — no hardcoded map).
        const supported = info?.capabilities.builtinTools ?? [];
        const tools: Tool[] = BUILTIN_TOOLS.filter(
          (t) => settings.enabledTools[t.setting] && supported.includes(t.id),
        ).map((t) => ({ type: t.id }) as BuiltinTool);

        await streamChat(
          selectedModel,
          history,
          engine,
          {
            system: settings.system,
            temperature: settings.temperature ?? undefined,
            maxTokens: settings.maxTokens ?? undefined,
            tools: tools.length ? tools : undefined,
            signal: controller.signal,
          },
          {
            onText: (delta) =>
              updateTurn(assistantTurn.id, (t) => ({ ...t, text: t.text + delta })),
            onMedia: (item) =>
              updateTurn(assistantTurn.id, (t) => ({ ...t, media: [...t.media, item] })),
            onFile: (file) =>
              updateTurn(assistantTurn.id, (t) => ({ ...t, outputs: [...t.outputs, file] })),
            onToolStart: (tool) =>
              updateTurn(assistantTurn.id, (t) => ({
                ...t,
                toolActivity: [...(t.toolActivity ?? []), { tool, running: true }],
              })),
            onToolEnd: (tool, payload) =>
              updateTurn(assistantTurn.id, (t) => {
                const act = [...(t.toolActivity ?? [])];
                const i = act.findIndex((a) => a.tool === tool && a.running);
                if (i >= 0) act[i] = { ...act[i], running: false, ...payload };
                return { ...t, toolActivity: act };
              }),
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
