import type { MediaParamSpec } from '@combycode/llm-sdk';
import { type RefObject, useEffect, useMemo } from 'react';
import { attMime, attName, attPreviewUrl } from '../../lib/attachments';
import type { ComposerAttachment } from '../../types/chat';
import type { MediaParams } from '../../types/media';
import { FileChip } from '../../ui/FileChip';
import { MediaParamsControl } from '../../ui/MediaParamsControl';

export function ComposerView({
  text,
  onTextChange,
  files,
  fileInputRef,
  onPickFiles,
  onFilesChosen,
  onRemoveFile,
  onSubmit,
  onStop,
  onExportHistory,
  canExport,
  mentionWarning,
  canSend,
  busy,
  mediaSpecs,
  mediaParams,
  onMediaParamsChange,
  videoMode,
  onVideoModeChange,
  showVideoMode = false,
  tools = [],
  onToggleTool,
  guideAttach = false,
  guideSend = false,
}: {
  text: string;
  onTextChange: (v: string) => void;
  files: ComposerAttachment[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onPickFiles: () => void;
  onFilesChosen: (list: FileList) => void;
  onRemoveFile: (index: number) => void;
  onSubmit: () => void;
  onStop: () => void;
  onExportHistory: () => void;
  canExport: boolean;
  mentionWarning: string | null;
  canSend: boolean;
  busy: boolean;
  mediaSpecs?: Record<string, MediaParamSpec>;
  mediaParams: MediaParams;
  onMediaParamsChange: (next: MediaParams) => void;
  /** Video source op when a video is attached: 'edit' (default) or 'extend'. */
  videoMode?: 'edit' | 'extend';
  onVideoModeChange?: (mode: 'edit' | 'extend') => void;
  /** Show the Edit/Extend toggle (a video is attached to a capable video model). */
  showVideoMode?: boolean;
  /** Hosted builtin-tool toggle chips, gated to the selected model's support. */
  tools?: Array<{ id: string; label: string; icon: string; enabled: boolean; supported: boolean }>;
  onToggleTool?: (id: string) => void;
  /** Guided-prefill highlights (docs-launched session). */
  guideAttach?: boolean;
  guideSend?: boolean;
}) {
  // Preview thumbnails for pending image attachments. Local files get an object
  // URL (revoked on change); generated refs reuse their own data:/http URL.
  const previews = useMemo(() => files.map(attPreviewUrl), [files]);
  useEffect(
    () => () => {
      // Only object URLs (blob:) need revoking; data:/http refs are no-ops.
      for (const u of previews) if (u?.startsWith('blob:')) URL.revokeObjectURL(u);
    },
    [previews],
  );

  return (
    <div className="composer">
      {mediaSpecs && (
        <MediaParamsControl specs={mediaSpecs} value={mediaParams} onChange={onMediaParamsChange} />
      )}
      {files.length > 0 && (
        <div className="composer-files">
          {files.map((f, i) => (
            <FileChip
              // biome-ignore lint/suspicious/noArrayIndexKey: pending files have no id
              key={i}
              file={{ name: attName(f), mime: attMime(f), size: 0, previewUrl: previews[i] }}
              onRemove={() => onRemoveFile(i)}
            />
          ))}
        </div>
      )}
      {showVideoMode && (
        <div className="video-mode">
          <span className="video-mode-label">Attached video:</span>
          {(['edit', 'extend'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`video-mode-btn${(videoMode ?? 'edit') === m ? ' video-mode-on' : ''}`}
              onClick={() => onVideoModeChange?.(m)}
              title={
                m === 'edit'
                  ? 'Modify the clip per your prompt (/v1/videos/edits)'
                  : 'Continue the clip from its last frame (/v1/videos/extensions)'
              }
            >
              {m === 'edit' ? 'Edit' : 'Extend'}
            </button>
          ))}
        </div>
      )}
      <textarea
        className="composer-text"
        rows={4}
        placeholder="Type a prompt…  (Ctrl/⌘+Enter to send)"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      {tools.length > 0 && (
        <div className="composer-tools">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tool-chip${t.enabled ? ' tool-chip-on' : ''}`}
              disabled={!t.supported}
              title={
                t.supported
                  ? `${t.enabled ? 'Disable' : 'Enable'} ${t.label} for this model`
                  : `${t.label} is not available for the selected model`
              }
              onClick={() => onToggleTool?.(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="composer-actions">
        <button
          type="button"
          className={`attach-btn${guideAttach ? ' guide-pulse' : ''}`}
          onClick={onPickFiles}
        >
          📎 attach
        </button>
        <button
          type="button"
          className="attach-btn"
          onClick={onExportHistory}
          disabled={!canExport}
          title="Export conversation as a .zip (Markdown + media files)"
        >
          ⭳ history
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) onFilesChosen(e.target.files);
            e.target.value = '';
          }}
        />
        {busy ? (
          <button type="button" className="stop-btn" onClick={onStop}>
            ■ Stop
          </button>
        ) : (
          <button
            type="button"
            className={`send-btn${guideSend ? ' guide-pulse' : ''}`}
            disabled={!canSend}
            onClick={onSubmit}
          >
            Send ▶
          </button>
        )}
      </div>
      {mentionWarning && <div className="composer-warning">⚠ {mentionWarning}</div>}
    </div>
  );
}
