import type { MediaParamSpec } from '@combycode/llm-sdk';
import type { RefObject } from 'react';
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
  guideAttach = false,
  guideSend = false,
}: {
  text: string;
  onTextChange: (v: string) => void;
  files: File[];
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
  /** Guided-prefill highlights (docs-launched session). */
  guideAttach?: boolean;
  guideSend?: boolean;
}) {
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
              file={{ name: f.name, mime: f.type, size: f.size }}
              onRemove={() => onRemoveFile(i)}
            />
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
