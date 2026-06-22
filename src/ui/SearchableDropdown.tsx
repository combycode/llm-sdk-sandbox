import { useMemo, useState } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
  /** false = not callable with the current key (shown dimmed). */
  available?: boolean;
}

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="dropdown">
      <button type="button" className="dropdown-toggle" onClick={() => setOpen((o) => !o)}>
        <span>{selected ? selected.label : (placeholder ?? 'Select…')}</span>
        <span className="chevron">▾</span>
      </button>
      {open && (
        <div className="dropdown-menu">
          <input
            className="dropdown-search"
            placeholder="search…"
            value={query}
            // biome-ignore lint/a11y/noAutofocus: focus the search on open
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="dropdown-list">
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className={`dropdown-item${o.value === value ? ' selected' : ''}${o.available === false ? ' dimmed' : ''}`}
                  title={o.available === false ? 'not available for your key' : undefined}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className="dropdown-item-label">{o.label}</span>
                  {o.hint && <span className="dropdown-hint">{o.hint}</span>}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="dropdown-empty">no matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
