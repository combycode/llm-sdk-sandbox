import { useEffect, useMemo, useState } from 'react';
import { filterFacets, listModelsLive, type ModelInfo } from '@combycode/llm-sdk';
import { trackModelSelected } from '../../lib/analytics';
import { PROVIDERS } from '../../lib/constants';
import { listCatalog, modelId, smartSelect } from '../../lib/models';
import { useEngine } from '../../state/EngineContext';
import { ModelSelector } from './ModelSelector';

export function ModelSelectorSection() {
  const { engine, settings, selectedModel, setSelectedModel, members, addMember } = useEngine();
  const [mode, setMode] = useState<'browse' | 'smart'>('browse');
  const [query, setQuery] = useState('');
  const [live, setLive] = useState<ModelInfo[]>([]);
  const [loadingLive, setLoadingLive] = useState(false);
  //: Providers whose live list REJECTED. Kept because `allSettled` discards the
  //: reason, and a silent discard is how an Anthropic CORS failure looked like
  //: "Anthropic has no live models" for days instead of like an error.
  const [liveFailed, setLiveFailed] = useState<string[]>([]);

  // Providers we have a key for — these get their live (account-actual) model
  // list merged in. Keyed by name so editing a key value doesn't re-fetch.
  const keyedProviders = PROVIDERS.filter((p) => !!settings.apiKeys[p]);
  const keyedKey = keyedProviders.join(',');

  useEffect(() => {
    if (keyedProviders.length === 0) {
      setLive([]);
      setLiveFailed([]);
      return;
    }
    let cancelled = false;
    setLoadingLive(true);
    Promise.allSettled(keyedProviders.map((p) => listModelsLive({ provider: p, engine })))
      .then((results) => {
        if (cancelled) return;
        setLive(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])));

        // One provider failing must not lose the others -- that is why this is
        // allSettled -- but it must not vanish either. The name reaches the
        // status line and the reason reaches the console.
        const failed: string[] = [];
        results.forEach((r, i) => {
          if (r.status !== 'rejected') return;
          failed.push(keyedProviders[i]);
          console.warn(`live model list failed for ${keyedProviders[i]}:`, r.reason);
        });
        setLiveFailed(failed);
      })
      .finally(() => {
        if (!cancelled) setLoadingLive(false);
      });
    return () => {
      cancelled = true;
    };
    // keyedProviders is derived from keyedKey; intentional deps.
  }, [keyedKey, engine]);

  const browseOptions = useMemo(() => {
    // The full static catalog is the only source of models shown. The live
    // call is used solely to mark availability (dimming), never to add models.
    const map = new Map<string, ModelInfo>();
    for (const m of listCatalog(engine)) map.set(modelId(m), m);

    // Per-provider set of identifiers the key can actually call (from live).
    const liveIds = new Map<string, Set<string>>();
    for (const m of live) {
      const set = liveIds.get(m.provider) ?? new Set<string>();
      set.add(m.model);
      if (m.providerModelName) set.add(m.providerModelName);
      for (const a of m.aliases ?? []) set.add(a);
      liveIds.set(m.provider, set);
    }
    const availableFor = (m: ModelInfo): boolean => {
      if (!settings.apiKeys[m.provider as keyof typeof settings.apiKeys]) return true; // no key → unknown
      const ids = liveIds.get(m.provider);
      if (!ids) return true; // live unavailable/failed → don't dim
      return (
        ids.has(m.model) ||
        (m.providerModelName ? ids.has(m.providerModelName) : false) ||
        (m.aliases ?? []).some((a) => ids.has(a))
      );
    };

    return [...map.values()]
      .sort((a, b) => modelId(a).localeCompare(modelId(b)))
      .map((m) => ({
        value: modelId(m),
        label: modelId(m),
        available: availableFor(m),
        hint: [m.type, m.pricing.inputPerMTok != null ? `$${m.pricing.inputPerMTok}/M in` : null]
          .filter(Boolean)
          .join(' · '),
      }));
  }, [engine, live, settings.apiKeys]);

  const smart = useMemo(() => smartSelect(query, engine), [query, engine]);

  // The pickable vocabulary comes from the library, with OUR catalog so the open
  // sets (type, provider, status, tier) are the ones actually in this build.
  const facets = useMemo(() => {
    const base = filterFacets(engine.catalog);
    // Order the open sets by how many models actually have each value. The
    // library sorts alphabetically, which put `audio-chat`, `base` and
    // `computer-use` above `chat` and pushed the type most people want off the
    // top of an 18-value row.
    const rank = (pick: (m: ModelInfo) => string | undefined) => {
      const n = new Map<string, number>();
      for (const m of engine.catalog.list()) {
        const v = pick(m);
        if (v) n.set(v, (n.get(v) ?? 0) + 1);
      }
      return (a: string, b: string) => (n.get(b) ?? 0) - (n.get(a) ?? 0) || a.localeCompare(b);
    };
    for (const f of base) {
      if (f.key === 'type') f.values = [...f.values].sort(rank((m) => m.type));
      if (f.key === 'provider') f.values = [...f.values].sort(rank((m) => m.provider));
    }
    return base;
  }, [engine]);

  const isMember = !!selectedModel && members.some((m) => m.model === selectedModel);

  // User-initiated model pick → safe analytics event (provider + model only).
  const onSelect = (id: string | null) => {
    setSelectedModel(id);
    if (id) {
      const slash = id.indexOf('/');
      trackModelSelected(slash > 0 ? id.slice(0, slash) : 'unknown', id);
    }
  };

  return (
    <ModelSelector
      mode={mode}
      onModeChange={setMode}
      selected={selectedModel}
      onSelect={onSelect}
      browseOptions={browseOptions}
      query={query}
      onQueryChange={setQuery}
      facets={facets}
      smartBest={smart.best}
      smartRanked={smart.ranked.map(modelId)}
      status={
        loadingLive
          ? 'loading live models…'
          : liveFailed.length > 0
            ? `${browseOptions.length} models — live check failed for ${liveFailed.join(', ')}`
            : `${browseOptions.length} models`
      }
      canAddMember={!!selectedModel && !isMember}
      onAddMember={() => selectedModel && addMember(selectedModel)}
    />
  );
}
