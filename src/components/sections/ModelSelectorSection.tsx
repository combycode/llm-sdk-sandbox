import { useEffect, useMemo, useState } from 'react';
import { listModelsLive, type ModelInfo } from '@combycode/llm-sdk';
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

  // Providers we have a key for — these get their live (account-actual) model
  // list merged in. Keyed by name so editing a key value doesn't re-fetch.
  const keyedProviders = PROVIDERS.filter((p) => !!settings.apiKeys[p]);
  const keyedKey = keyedProviders.join(',');

  useEffect(() => {
    if (keyedProviders.length === 0) {
      setLive([]);
      return;
    }
    let cancelled = false;
    setLoadingLive(true);
    Promise.allSettled(keyedProviders.map((p) => listModelsLive({ provider: p, engine })))
      .then((results) => {
        if (!cancelled) setLive(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])));
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
      smartBest={smart.best}
      smartRanked={smart.ranked.map(modelId)}
      status={loadingLive ? 'loading live models…' : `${browseOptions.length} models`}
      canAddMember={!!selectedModel && !isMember}
      onAddMember={() => selectedModel && addMember(selectedModel)}
    />
  );
}
