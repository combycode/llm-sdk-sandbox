import type { MediaParamSpec } from '@combycode/llm-sdk';
import type { MediaParams } from '../types/media';

/** Renders one control per param the model declares in its catalog
 *  `mediaParams` spec — enum specs become a <select>, numeric ranges become a
 *  number input. Nothing is hardcoded; the model is the source of truth. */
export function MediaParamsControl({
  specs,
  value,
  onChange,
}: {
  specs: Record<string, MediaParamSpec>;
  value: MediaParams;
  onChange: (next: MediaParams) => void;
}) {
  const entries = Object.entries(specs);
  if (entries.length === 0) return null;

  const setParam = (key: string, v: string | number | undefined) => {
    const next = { ...value };
    if (v === undefined || v === '') delete next[key];
    else next[key] = v;
    onChange(next);
  };

  return (
    <div className="media-params">
      {entries.map(([key, spec]) => (
        <label key={key} className="media-param">
          <span>{key}</span>
          {spec.values ? (
            <select
              value={String(value[key] ?? '')}
              onChange={(e) => setParam(key, e.target.value)}
            >
              <option value="">{spec.default != null ? `auto (${spec.default})` : 'auto'}</option>
              {spec.values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={spec.min}
              max={spec.max}
              step="any"
              placeholder={spec.default != null ? String(spec.default) : ''}
              value={value[key] ?? ''}
              onChange={(e) => setParam(key, e.target.value === '' ? undefined : Number(e.target.value))}
            />
          )}
        </label>
      ))}
    </div>
  );
}
