import { useEffect } from 'react';

/** Full-screen JSON inspector — closes on backdrop / ✕ / Escape. */
export function JsonModal({
  title,
  data,
  onClose,
}: {
  title: string;
  data: unknown;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop-click to close
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled above
    <div className="json-modal" onClick={onClose}>
      <div className="json-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="json-modal-head">
          <span>{title}</span>
          <button type="button" className="json-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <pre className="json-modal-body">{safeStringify(data)}</pre>
      </div>
    </div>
  );
}

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data, replacer, 2);
  } catch {
    return String(data);
  }
}

/** Tame huge base64 blobs / circular refs in event payloads. */
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && value.length > 512) return `${value.slice(0, 512)}… (${value.length} chars)`;
  return value;
}
