import { useChat } from '../../state/ChatContext';
import { SessionStatsView } from './SessionStatsView';

export function SessionStatsSection() {
  const { sessionStats } = useChat();
  if (sessionStats.turns === 0) return null;
  return <SessionStatsView stats={sessionStats} />;
}
