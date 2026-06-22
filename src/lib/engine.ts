import { createEngine, type EngineHandle } from '@combycode/llm-sdk';
import type { Settings } from '../types/settings';

/** Build an app-owned engine (catalog + BYOK keys). registerAsDefault:false so
 *  the app fully controls the instance and can rebuild it on settings change
 *  without tripping the "second createEngine() throws" rule. */
export function buildEngine(settings: Settings): EngineHandle {
  return createEngine({
    registerAsDefault: false,
    catalog: 'defaults',
    apiKeys: settings.apiKeys,
  });
}
