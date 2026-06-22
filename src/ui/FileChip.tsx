import type { AttachedFile } from '../types/chat';

export function FileChip({ file, onRemove }: { file: AttachedFile; onRemove?: () => void }) {
  return (
    <span className="file-chip">
      {file.previewUrl && <img src={file.previewUrl} alt="" className="file-chip-thumb" />}
      <span className="file-chip-name">{file.name}</span>
      {onRemove && (
        <button type="button" className="file-chip-x" onClick={onRemove} aria-label="remove">
          ×
        </button>
      )}
    </span>
  );
}
