import { formatCost, formatElapsed, formatTokens } from '../../lib/cost';
import { useChat } from '../../state/ChatContext';
import type { ChatTurn } from '../../types/chat';
import { FileChip } from '../../ui/FileChip';
import { Markdown } from '../../ui/Markdown';
import { MediaView } from '../../ui/MediaView';
import { OutputFileView } from '../../ui/OutputFileView';
import { Spinner } from '../../ui/Spinner';

/** Display for a builtin tool: icon, done label, and the present-progressive
 *  shown while it runs. */
const TOOL_UI: Record<string, { icon: string; label: string; running: string }> = {
  web_search: { icon: '🔎', label: 'web search', running: 'Searching the web…' },
  code_interpreter: { icon: '⚙️', label: 'code interpreter', running: 'Running code…' },
};

export function Turn({ turn }: { turn: ChatTurn }) {
  const { attachToPrompt } = useChat();
  const empty = !turn.text && turn.media.length === 0 && turn.outputs.length === 0;
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

      {turn.toolActivity && turn.toolActivity.length > 0 && (
        <div className="turn-tools">
          {turn.toolActivity.map((a, i) => {
            const ui = TOOL_UI[a.tool] ?? { icon: '🔧', label: a.tool, running: `${a.tool}…` };
            if (a.running) {
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: tool activity is positional
                <span key={i} className="turn-tool-running">
                  <Spinner /> {ui.running}
                </span>
              );
            }
            // Code execution expands (code + output); web search shows its query or
            // opened URL inline in a chip.
            if (!a.code && !a.output) {
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: tool activity is positional
                <span key={i} className="turn-tool-chip">
                  {ui.icon} {ui.label}
                  {a.query && <span className="turn-tool-q">{a.query}</span>}
                  {a.url && (
                    <a
                      className="turn-tool-url"
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {a.url}
                    </a>
                  )}
                </span>
              );
            }
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: tool activity is positional
              <details key={i} className="turn-tool-details">
                <summary className="turn-tool-summary">
                  <span className="turn-tool-name">
                    {ui.icon} {ui.label}
                  </span>
                  {a.query && <span className="turn-tool-q">{a.query}</span>}
                </summary>
                {a.code && (
                  <div className="turn-tool-block">
                    <div className="turn-tool-cap">code</div>
                    <pre className="turn-tool-pre">{a.code}</pre>
                  </div>
                )}
                {a.output && (
                  <div className="turn-tool-block">
                    <div className="turn-tool-cap">output</div>
                    <pre className="turn-tool-pre">{a.output}</pre>
                  </div>
                )}
              </details>
            );
          })}
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

      {turn.outputs.map((f, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: outputs are positional
        <OutputFileView key={i} file={f} />
      ))}

      {turn.pending && empty && (
        <div className="turn-pending">
          <Spinner />{' '}
          {turn.mediaProgress != null
            ? `generating video… ${Math.round(turn.mediaProgress)}%`
            : 'thinking…'}
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
