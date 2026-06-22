import { formatCost, formatElapsed, formatTokens } from '../../lib/cost';
import { useChat } from '../../state/ChatContext';
import type { ChatTurn } from '../../types/chat';
import { FileChip } from '../../ui/FileChip';
import { Markdown } from '../../ui/Markdown';
import { MediaView } from '../../ui/MediaView';
import { Spinner } from '../../ui/Spinner';

export function Turn({ turn }: { turn: ChatTurn }) {
  const { attachToPrompt } = useChat();
  const empty = !turn.text && turn.media.length === 0;
  return (
    <div className={`turn turn-${turn.role}`}>
      <div className="turn-head">
        <span className="turn-role">{turn.role}</span>
        {turn.model && <span className="turn-model">{turn.model}</span>}
      </div>

      {turn.files.length > 0 && (
        <div className="turn-files">
          {turn.files.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: files are positional
            <FileChip key={i} file={f} />
          ))}
        </div>
      )}

      {turn.text &&
        (turn.role === 'assistant' ? (
          <Markdown text={turn.text} />
        ) : (
          <div className="turn-text">{turn.text}</div>
        ))}

      {turn.media.map((m, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: media are positional
        <MediaView key={i} item={m} onAttach={() => attachToPrompt(m)} />
      ))}

      {turn.pending && empty && (
        <div className="turn-pending">
          <Spinner /> thinking…
        </div>
      )}
      {turn.error && <div className="turn-error">⚠ {turn.error}</div>}

      {turn.stats && (
        <div className="turn-stats">
          {(turn.stats.inputTokens > 0 || turn.stats.outputTokens > 0) &&
            `${formatTokens(turn.stats.inputTokens)} in · ${formatTokens(turn.stats.outputTokens)} out · `}
          {turn.stats.cost != null && turn.stats.cost > 0 && `${formatCost(turn.stats.cost)} · `}
          {formatElapsed(turn.stats.elapsedMs)}
        </div>
      )}
    </div>
  );
}
