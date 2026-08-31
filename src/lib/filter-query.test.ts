import { describe, expect, it } from 'bun:test';
import { clauseFor, hasClause, keyOf, parseClauses, toggleClause } from './filter-query';

describe('parseClauses', () => {
  it('splits and trims, dropping empties', () => {
    expect(parseClauses(' type:chat ;; vision ; ')).toEqual(['type:chat', 'vision']);
  });
  it('treats an empty query as no clauses', () => {
    expect(parseClauses('   ')).toEqual([]);
  });
});

describe('keyOf', () => {
  it('reads the key from a key:value clause', () => {
    expect(keyOf('price:free')).toBe('price');
  });
  it('reads a bare flag as its own key', () => {
    expect(keyOf('vision')).toBe('vision');
  });
  it('refuses to key a comparison', () => {
    // `context > 200k` and `context:large` are different questions; treating them
    // as the same key would silently delete a hand-typed comparison.
    expect(keyOf('context > 200k')).toBeNull();
  });
});

describe('toggleClause', () => {
  it('adds a clause to an empty query', () => {
    expect(toggleClause('', 'type:chat')).toBe('type:chat');
  });
  it('removes a clause that is already there', () => {
    expect(toggleClause('type:chat; vision', 'vision')).toBe('type:chat');
  });
  it('replaces another clause with the same key', () => {
    expect(toggleClause('price:free; vision', 'price:low')).toBe('vision; price:low');
  });
  it('leaves a hand-typed comparison alone', () => {
    expect(toggleClause('context > 200k', 'type:chat')).toBe('context > 200k; type:chat');
  });
  it('keeps everything else the user typed', () => {
    const q = 'provider:openai; context > 200k; tools';
    expect(parseClauses(toggleClause(q, 'type:chat'))).toEqual([
      'provider:openai',
      'context > 200k',
      'tools',
      'type:chat',
    ]);
  });
});

describe('clauseFor', () => {
  it('uses the bare form for a yes on a flag key', () => {
    expect(clauseFor('vision', 'yes', true)).toBe('vision');
  });
  it('spells out a no', () => {
    expect(clauseFor('reasoning', 'no', true)).toBe('reasoning:no');
  });
  it('spells out a valued key', () => {
    expect(clauseFor('type', 'chat', false)).toBe('type:chat');
  });
});

describe('hasClause', () => {
  it('matches only an exact clause', () => {
    expect(hasClause('type:chat', 'type:chat')).toBe(true);
    expect(hasClause('type:chat', 'type:code')).toBe(false);
  });
});
