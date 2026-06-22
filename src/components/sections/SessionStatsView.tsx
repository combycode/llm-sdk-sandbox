import { formatCost, formatTokens } from '../../lib/cost';
import type { SessionStats } from '../../state/ChatContext';

export function SessionStatsView({ stats }: { stats: SessionStats }) {
  return (
    <div className="session-stats">
      <h4>Session</h4>
      <div className="stat-grid">
        <span>Responses</span>
        <strong>{stats.turns}</strong>
        <span>Input</span>
        <strong>{formatTokens(stats.inputTokens)} tok</strong>
        <span>Output</span>
        <strong>{formatTokens(stats.outputTokens)} tok</strong>
        <span>Cost</span>
        <strong>{formatCost(stats.cost)}</strong>
      </div>
    </div>
  );
}
