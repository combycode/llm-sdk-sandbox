import { useEffect } from 'react';
import type { MediaItem } from '../types/chat';

/** Full-viewport overlay showing an image/video at max size. Closes on the
 *  backdrop, the ✕ button, or Escape. */
export function MediaModal({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop-click to close
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled globally above
    <div className="media-modal" onClick={onClose}>
      <button type="button" className="media-modal-close" onClick={onClose}>
        ✕
      </button>
      {item.kind === 'image' ? (
        <img
          className="media-modal-content"
          src={item.url}
          alt="generated"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        // biome-ignore lint/a11y/useMediaCaption: generated media has no captions
        <video
          className="media-modal-content"
          src={item.url}
          controls
          autoPlay
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
