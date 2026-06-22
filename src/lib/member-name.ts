import type { ChatMember } from '../types/member';

/** Vendor tokens dropped from the family name (e.g. "claude-opus" → "opus"). */
const VENDOR_DROP = new Set(['claude']);

const PROVIDER_PREFIX: Record<string, string> = {
  openrouter: 'or',
  anthropic: 'an',
  openai: 'oa',
  google: 'gg',
  xai: 'xai',
};

function splitModelId(id: string): [provider: string, slug: string] {
  const i = id.indexOf('/');
  return i < 0 ? ['', id] : [id.slice(0, i), id.slice(i + 1)];
}

/** Short family handle: drop provider/vendor words + version numbers.
 *  "claude-opus-4.8" → "opus", "gpt-5.5" → "gpt", "grok-4" → "grok". */
export function familyName(slug: string): string {
  const tokens = slug.split(/[-_/]/).filter(Boolean);
  const kept = tokens.filter((t) => !/\d/.test(t) && !VENDOR_DROP.has(t.toLowerCase()));
  const name = (kept.length > 0 ? kept : tokens)
    .filter((t) => !VENDOR_DROP.has(t.toLowerCase()))
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return name || tokens[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'model';
}

/** Version digits of a model id ("…-4.8" → "48", "…-2.5-flash" → "25"). */
export function versionDigits(modelId: string): string {
  const slug = modelId.split('/').pop() ?? modelId;
  const groups = slug.match(/\d+(?:[._]\d+)*/g);
  if (!groups) return '';
  return groups[groups.length - 1].replace(/[^0-9]/g, '');
}

function providerPrefix(provider: string): string {
  return PROVIDER_PREFIX[provider] ?? provider.slice(0, 2);
}

/** Suggest the shortest @-handle unique among existing members:
 *  family → family+version → providerPrefix_family+version. The provider prefix
 *  is used when the same family+version already exists from another provider. */
export function suggestMemberName(modelId: string, existing: ChatMember[]): string {
  const [provider, slug] = splitModelId(modelId);
  const base = familyName(slug);
  const ver = versionDigits(modelId);
  const names = new Set(existing.map((m) => m.name));

  // Does an already-saved member point at the same family+version on a DIFFERENT
  // provider? Then version alone is ambiguous → go straight to the prefixed form.
  const crossProviderDup = existing.some((m) => {
    const [p, s] = splitModelId(m.model);
    return p !== provider && familyName(s) === base && versionDigits(m.model) === ver;
  });

  const candidates = [
    base,
    !crossProviderDup && ver ? `${base}${ver}` : null,
    `${providerPrefix(provider)}_${base}${ver}`,
  ];
  for (const c of candidates) if (c && !names.has(c)) return c;

  // Last resort: numeric suffix.
  const root = `${providerPrefix(provider)}_${base}${ver}`;
  let i = 2;
  while (names.has(`${root}${i}`)) i++;
  return `${root}${i}`;
}
