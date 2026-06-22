import { describe, expect, it } from 'bun:test';
import type { ChatMember } from '../types/member';
import { familyName, suggestMemberName, versionDigits } from './member-name';

describe('familyName / versionDigits', () => {
  it('strips vendor + version', () => {
    expect(familyName('claude-opus-4.8')).toBe('opus');
    expect(familyName('gpt-5.5')).toBe('gpt');
    expect(familyName('grok-4')).toBe('grok');
  });
  it('version digits', () => {
    expect(versionDigits('anthropic/claude-opus-4.8')).toBe('48');
    expect(versionDigits('openai/gpt-5.5')).toBe('55');
  });
});

describe('suggestMemberName', () => {
  const m = (model: string, name: string): ChatMember => ({ model, name });

  it('first model of a family → bare family name', () => {
    expect(suggestMemberName('anthropic/claude-opus-4.6', [])).toBe('opus');
  });

  it('different version of a saved family → family+version', () => {
    // example A: opus-4.6 saved as "opus", add openrouter opus-4.8 → opus48
    const existing = [m('anthropic/claude-opus-4.6', 'opus')];
    expect(suggestMemberName('openrouter/claude-opus-4.8', existing)).toBe('opus48');
  });

  it('same family+version from another provider → provider prefix', () => {
    // example B: anthropic 4.8 = "opus", 4.6 = "opus46", openrouter 4.8 → or_opus48
    const existing = [
      m('anthropic/claude-opus-4.8', 'opus'),
      m('anthropic/claude-opus-4.6', 'opus46'),
    ];
    expect(suggestMemberName('openrouter/claude-opus-4.8', existing)).toBe('or_opus48');
  });

  it('sequence matches the spec (B)', () => {
    const list: ChatMember[] = [];
    const add = (model: string) => {
      const name = suggestMemberName(model, list);
      list.push({ model, name });
      return name;
    };
    expect(add('anthropic/claude-opus-4.8')).toBe('opus');
    expect(add('anthropic/claude-opus-4.6')).toBe('opus46');
    expect(add('openrouter/claude-opus-4.8')).toBe('or_opus48');
  });
});
