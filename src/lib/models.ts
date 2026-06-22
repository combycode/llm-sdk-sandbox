import { select, selectModels, type EngineHandle, type ModelInfo } from '@combycode/llm-sdk';

/** All catalog models (offline — from the loaded 'defaults' catalog). */
export function listCatalog(engine: EngineHandle): ModelInfo[] {
  return engine.catalog
    .list()
    .slice()
    .sort((a, b) => `${a.provider}/${a.model}`.localeCompare(`${b.provider}/${b.model}`));
}

/** Find a model's catalog entry by its "provider/slug" id. */
export function findModel(engine: EngineHandle, id: string): ModelInfo | undefined {
  const slash = id.indexOf('/');
  if (slash <= 0) return undefined;
  return engine.catalog.get(id.slice(0, slash), id.slice(slash + 1)) ?? undefined;
}

export interface SmartResult {
  best: string | null;
  ranked: ModelInfo[];
}

/** Capability/feature query via the tag DSL (e.g. "type:chat; vision; cheap"). */
export function smartSelect(query: string, engine: EngineHandle): SmartResult {
  if (!query.trim()) return { best: null, ranked: [] };
  try {
    return { best: select(query, { engine }), ranked: selectModels(query, { engine }) };
  } catch {
    // Unknown tag/key in the query — surface as no matches rather than throwing.
    return { best: null, ranked: [] };
  }
}

export function modelId(info: ModelInfo): string {
  return `${info.provider}/${info.model}`;
}
