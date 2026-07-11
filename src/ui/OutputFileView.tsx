import { downloadUrl } from '../lib/download';
import type { OutputFile } from '../types/chat';

/** Renders a hosted-tool output file (code-execution chart/CSV): image files
 *  preview inline; every file offers a download. */
export function OutputFileView({ file }: { file: OutputFile }) {
  const kb = file.size >= 1024 ? `${Math.round(file.size / 1024)} KB` : `${file.size} B`;
  const download = () => downloadUrl(file.name, file.url);

  if (file.error) {
    return (
      <div className="output-file output-file-err">
        <span className="output-file-name" title={file.name}>
          📄 {file.name}
        </span>
        <span className="output-file-errmsg">⚠ {file.error}</span>
      </div>
    );
  }

  return (
    <div className="output-file">
      {file.mime.startsWith('image/') && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: image opens in a new tab, keyboard users use the download button
        <img
          className="output-file-img"
          src={file.url}
          alt={file.name}
          onClick={() => window.open(file.url, '_blank', 'noopener')}
        />
      )}
      <div className="output-file-bar">
        <span className="output-file-name" title={file.name}>
          {file.name}
        </span>
        <span className="output-file-meta">
          {file.mime} · {kb}
        </span>
        <button type="button" className="output-file-dl" onClick={download} title="Download">
          ⤓
        </button>
      </div>
    </div>
  );
}
