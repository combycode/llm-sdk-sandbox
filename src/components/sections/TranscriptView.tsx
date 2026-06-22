import type { RefObject } from 'react';
import type { ChatTurn } from '../../types/chat';
import { Turn } from './Turn';

export function TranscriptView({
  turns,
  endRef,
  onReset,
}: {
  turns: ChatTurn[];
  endRef: RefObject<HTMLDivElement | null>;
  onReset: () => void;
}) {
  return (
    <div className="transcript-wrap">
      <div className="transcript-bar">
        <span>{turns.length === 0 ? 'New conversation' : `${turns.length} messages`}</span>
        <button type="button" className="new-chat" onClick={onReset} disabled={turns.length === 0}>
          New chat
        </button>
      </div>
      <div className="transcript">
        {turns.length === 0 && (
          <div className="transcript-empty">
            Pick a model and send a prompt. You can switch the model between turns — the same
            conversation continues.
          </div>
        )}
        {turns.map((t) => (
          <Turn key={t.id} turn={t} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
