import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadBytes } from '../../lib/download';
import { historyZip } from '../../lib/export-history';
import { isMediaModel } from '../../lib/media';
import { findModel } from '../../lib/models';
import { readPreload } from '../../lib/preload';
import { useChat } from '../../state/ChatContext';
import { useEngine } from '../../state/EngineContext';
import type { MediaParams } from '../../types/media';
import { ComposerView } from './ComposerView';

export function PromptComposer() {
  const { send, stop, busy, draft, clearDraft, turns, pendingAttachments, consumeAttachments } =
    useChat();
  const { engine, selectedModel, setSelectedModel, members, guide, endGuide } = useEngine();
  // Seed the prompt from a docs-launched `?ex=` descriptor (prefill, never auto-send).
  const [text, setText] = useState(() => readPreload()?.prompt ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [mediaParams, setMediaParams] = useState<MediaParams>({});
  const [mentionWarning, setMentionWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // @name mentions: once a mention is completed (followed by whitespace), switch
  // the active model to it. Only one model mention is honored.
  useEffect(() => {
    const names = [...text.matchAll(/@([A-Za-z0-9_]+)(?=\s)/g)].map((m) => m[1]);
    const distinct = [
      ...new Set(names.map((n) => members.find((m) => m.name === n)?.model).filter(Boolean)),
    ] as string[];
    if (distinct.length === 0) {
      setMentionWarning(null);
      return;
    }
    setSelectedModel(distinct[0]); // first mention wins
    setMentionWarning(
      distinct.length > 1 ? 'Only one model mention allowed — using the first; others ignored.' : null,
    );
  }, [text, members, setSelectedModel]);

  // Media param specs come straight from the selected model's catalog entry.
  const mediaSpecs = useMemo(() => {
    const info = selectedModel ? findModel(engine, selectedModel) : undefined;
    return info && isMediaModel(info) ? info.mediaParams : undefined;
  }, [engine, selectedModel]);

  // Clear any chosen params when the model changes — they're model-specific.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on model switch
  useEffect(() => {
    setMediaParams({});
  }, [selectedModel]);

  // A stopped request hands its prompt back — refill the composer with it.
  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    setFiles(draft.files);
    clearDraft();
  }, [draft, clearDraft]);

  // "Attach to prompt" from the transcript queues files here — absorb them.
  useEffect(() => {
    if (pendingAttachments.length === 0) return;
    setFiles((prev) => [...prev, ...pendingAttachments]);
    consumeAttachments();
  }, [pendingAttachments, consumeAttachments]);

  const submit = async () => {
    if (busy || (!text.trim() && files.length === 0)) return;
    endGuide(); // first send clears the guided-prefill highlights
    const t = text;
    const f = files;
    setText('');
    setFiles([]);
    await send(t, f, mediaParams);
  };

  const canSend = !busy && !!selectedModel && (text.trim().length > 0 || files.length > 0);
  // Guided prefill: highlight 📎 when the example expects an attachment that
  // isn't there yet, and Send once the turn is ready to fire.
  const guideAttach = guide.active && !!guide.attach && files.length === 0;
  const guideSend = guide.active && canSend;

  return (
    <ComposerView
      text={text}
      onTextChange={setText}
      guideAttach={guideAttach}
      guideSend={guideSend}
      files={files}
      fileInputRef={fileInputRef}
      onPickFiles={() => fileInputRef.current?.click()}
      onFilesChosen={(list) => setFiles((prev) => [...prev, ...Array.from(list)])}
      onRemoveFile={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
      onSubmit={submit}
      onStop={stop}
      onExportHistory={() => downloadBytes('conversation.zip', historyZip(turns), 'application/zip')}
      canExport={turns.length > 0}
      mentionWarning={mentionWarning}
      canSend={canSend}
      busy={busy}
      mediaSpecs={mediaSpecs}
      mediaParams={mediaParams}
      onMediaParamsChange={setMediaParams}
    />
  );
}
