import { useEffect, useRef } from 'react';
import { useChat } from '../../state/ChatContext';
import { TranscriptView } from './TranscriptView';

export function ChatTranscript() {
  const { turns, reset } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  return <TranscriptView turns={turns} endRef={endRef} onReset={reset} />;
}
