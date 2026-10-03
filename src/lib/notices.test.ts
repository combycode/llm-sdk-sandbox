import { describe, expect, it } from 'bun:test';
import { appendNotice } from './notices';

describe('appendNotice', () => {
  it('adds the first notice', () => {
    expect(appendNotice(undefined, 'temperature was not sent')).toEqual([
      'temperature was not sent',
    ]);
  });

  it('does not repeat one a multi-step turn reported again', () => {
    // The reason this is a function and not an inline spread: a tool loop emits
    // the same `request_adjusted` once per step, and three identical lines under
    // one answer reads like three different problems.
    const once = appendNotice(undefined, 'topP was dropped');
    expect(appendNotice(once, 'topP was dropped')).toEqual(['topP was dropped']);
  });

  it('keeps distinct notices, in the order they arrived', () => {
    const a = appendNotice(undefined, 'temperature was not sent');
    expect(appendNotice(a, 'topK was dropped')).toEqual([
      'temperature was not sent',
      'topK was dropped',
    ]);
  });

  it('does not mutate the array it was given', () => {
    const original = ['first'];
    appendNotice(original, 'second');
    expect(original).toEqual(['first']);
  });
});
