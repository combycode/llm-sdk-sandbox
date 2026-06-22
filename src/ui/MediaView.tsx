import { useState } from 'react';
import { mimeExt } from '../lib/attachments';
import { downloadUrl } from '../lib/download';
import type { MediaItem } from '../types/chat';
import { MediaModal } from './MediaModal';

export function MediaView({ item, onAttach }: { item: MediaItem; onAttach?: () => void }) {
  const [open, setOpen] = useState(false);

  const download = () => downloadUrl(`${item.kind}.${mimeExt(item.mime)}`, item.url);

  const actions = (
    <div className="media-actions">
      {onAttach && (
        <button type="button" className="media-btn" onClick={onAttach} title="Attach to prompt">
          📎
        </button>
      )}
      <button type="button" className="media-btn" onClick={download} title="Download">
        ⤓
      </button>
      {item.kind !== 'audio' && (
        <button type="button" className="media-btn" onClick={() => setOpen(true)} title="Expand">
          ⤢
        </button>
      )}
    </div>
  );

  if (item.kind === 'audio') {
    return (
      <div className="media-frame media-frame-audio">
        {/* biome-ignore lint/a11y/useMediaCaption: generated audio has no captions */}
        <audio className="media-audio" src={item.url} controls />
        {actions}
      </div>
    );
  }

  return (
    <div className="media-frame">
      {item.kind === 'image' ? (
        <img className="media-img" src={item.url} alt="generated" onClick={() => setOpen(true)} />
      ) : (
        // biome-ignore lint/a11y/useMediaCaption: generated video has no captions
        <video className="media-video" src={item.url} controls />
      )}
      {actions}
      {open && <MediaModal item={item} onClose={() => setOpen(false)} />}
    </div>
  );
}
