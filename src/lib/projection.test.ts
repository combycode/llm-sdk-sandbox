import { describe, expect, it } from 'bun:test';
import type { ModelInfo } from '@combycode/llm-sdk';
import type { ChatTurn } from '../types/chat';
import { projectConversation } from './projection';

function turn(t: Partial<ChatTurn> & Pick<ChatTurn, 'role'>): ChatTurn {
  return { id: 'x', apiContent: '', text: '', media: [], files: [], ...t };
}

const visionModel = { inputModalities: ['text', 'image'] } as ModelInfo;
const textModel = { inputModalities: ['text'] } as ModelInfo;
const IMG = { kind: 'image' as const, mime: 'image/png', url: 'data:image/png;base64,aGk=' };

const A = 'anthropic/claude-opus-4.8';
const B = 'openai/gpt-5.5';

describe('projectConversation — plain / same-model', () => {
  it('is identity for a plain text conversation with the same model', () => {
    const turns = [
      turn({ role: 'user', apiContent: 'hi' }),
      turn({ role: 'assistant', apiContent: 'hello', text: 'hello', model: A }),
    ];
    expect(projectConversation(turns, A, textModel)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
  });

  it('preserves user-attached content when the model accepts it (verbatim)', () => {
    const parts = [
      { type: 'text' as const, text: 'what is this' },
      { type: 'image' as const, source: { type: 'base64' as const, mimeType: 'image/png', data: 'QQ==' } },
    ];
    const turns = [turn({ role: 'user', apiContent: parts })];
    expect(projectConversation(turns, A, visionModel)).toEqual([{ role: 'user', content: parts }]);
  });
});

describe('projectConversation — user-attached media gating on model switch', () => {
  const imgParts = [
    { type: 'text' as const, text: "what's in this?" },
    { type: 'image' as const, source: { type: 'base64' as const, mimeType: 'image/png', data: 'QQ==' } },
  ];

  it('drops an attached image (with a note) for a model without image input', () => {
    const turns = [turn({ role: 'user', apiContent: imgParts })];
    expect(projectConversation(turns, B, textModel)).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: "what's in this?" },
          { type: 'text', text: '[image attachment omitted — model has no image input]' },
        ],
      },
    ]);
  });

  it('keeps the attached image for an image-capable model', () => {
    const turns = [turn({ role: 'user', apiContent: imgParts })];
    expect(projectConversation(turns, B, visionModel)).toEqual([{ role: 'user', content: imgParts }]);
  });

  it('gates a document by pdf input', () => {
    const docParts = [
      { type: 'text' as const, text: 'summarize' },
      { type: 'document' as const, source: { type: 'base64' as const, mimeType: 'application/pdf', data: 'QQ==' } },
    ];
    const pdfModel = { inputModalities: ['text', 'pdf'] } as ModelInfo;
    // pdf-capable → kept
    expect(projectConversation([turn({ role: 'user', apiContent: docParts })], B, pdfModel)).toEqual([
      { role: 'user', content: docParts },
    ]);
    // not pdf-capable → noted
    expect(projectConversation([turn({ role: 'user', apiContent: docParts })], B, textModel)).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'summarize' },
          { type: 'text', text: '[document attachment omitted — model has no document input]' },
        ],
      },
    ]);
  });

  it('leaves plain string user content untouched (identity)', () => {
    expect(projectConversation([turn({ role: 'user', apiContent: 'hello' })], B, textModel)).toEqual([
      { role: 'user', content: 'hello' },
    ]);
  });
});

describe('projectConversation — generated media replay', () => {
  it('replays a generated image as a synthetic user message for image-capable models', () => {
    const turns = [
      turn({ role: 'user', apiContent: 'draw a cat' }),
      turn({ role: 'assistant', apiContent: '', media: [IMG], model: A }),
    ];
    expect(projectConversation(turns, A, visionModel)).toEqual([
      { role: 'user', content: 'draw a cat' },
      { role: 'assistant', content: '(generated media)' },
      {
        role: 'user',
        content: [
          { type: 'text', text: '[Image generated in the previous turn]' },
          { type: 'image', source: { type: 'base64', mimeType: 'image/png', data: 'aGk=' } },
        ],
      },
    ]);
  });

  it('does NOT replay the image to a model without image input', () => {
    const turns = [
      turn({ role: 'user', apiContent: 'draw a cat' }),
      turn({ role: 'assistant', apiContent: '', media: [IMG], model: A }),
    ];
    expect(projectConversation(turns, A, textModel)).toEqual([
      { role: 'user', content: 'draw a cat' },
      { role: 'assistant', content: '(generated media)' },
    ]);
  });
});

describe('projectConversation — cross-model attribution', () => {
  it("attributes another model's text turn as user context", () => {
    const turns = [
      turn({ role: 'user', apiContent: 'hi' }),
      turn({ role: 'assistant', apiContent: 'I am A', text: 'I am A', model: A }),
      turn({ role: 'user', apiContent: 'now you, B' }),
    ];
    // Target is B → A's turn becomes attributed user context.
    expect(projectConversation(turns, B, textModel)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'user', content: '[claude-opus-4.8]: I am A' },
      { role: 'user', content: 'now you, B' },
    ]);
  });

  it("folds another model's generated image into the attributed message (image-capable)", () => {
    const turns = [
      turn({ role: 'assistant', apiContent: '', media: [IMG], model: A }),
    ];
    expect(projectConversation(turns, B, visionModel)).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: '[claude-opus-4.8]: (generated media)' },
          { type: 'image', source: { type: 'base64', mimeType: 'image/png', data: 'aGk=' } },
        ],
      },
    ]);
  });

  it("the target's OWN turns stay assistant (no attribution)", () => {
    const turns = [
      turn({ role: 'assistant', apiContent: 'mine', text: 'mine', model: B }),
      turn({ role: 'assistant', apiContent: 'theirs', text: 'theirs', model: A }),
    ];
    expect(projectConversation(turns, B, textModel)).toEqual([
      { role: 'assistant', content: 'mine' },
      { role: 'user', content: '[claude-opus-4.8]: theirs' },
    ]);
  });

  it('custom attribution formatter is honored', () => {
    const turns = [turn({ role: 'assistant', apiContent: 'x', text: 'x', model: A })];
    const msgs = projectConversation(turns, B, textModel, {
      attribution: (id) => `<${id.split('/')[0]}>`,
    });
    expect(msgs).toEqual([{ role: 'user', content: '<anthropic>: x' }]);
  });
});
