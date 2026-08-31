import type { FilterFacet } from '@combycode/llm-sdk';
import { FilterPicker } from '../../ui/FilterPicker';
import { SearchableDropdown, type DropdownOption } from '../../ui/SearchableDropdown';

export function ModelSelector({
  mode,
  onModeChange,
  selected,
  onSelect,
  browseOptions,
  query,
  onQueryChange,
  facets,
  smartBest,
  smartRanked,
  status,
  canAddMember,
  onAddMember,
}: {
  mode: 'browse' | 'smart';
  onModeChange: (m: 'browse' | 'smart') => void;
  selected: string | null;
  onSelect: (id: string) => void;
  browseOptions: DropdownOption[];
  query: string;
  onQueryChange: (q: string) => void;
  /** The filter vocabulary, from the library — never a list written here. */
  facets: FilterFacet[];
  smartBest: string | null;
  smartRanked: string[];
  status: string;
  canAddMember: boolean;
  onAddMember: () => void;
}) {
  return (
    <div className="model-selector">
      <div className="row">
        <strong>Model</strong>
        <div className="mode-toggle">
          <button
            type="button"
            className={mode === 'browse' ? 'active' : ''}
            onClick={() => onModeChange('browse')}
          >
            Browse
          </button>
          <button
            type="button"
            className={mode === 'smart' ? 'active' : ''}
            onClick={() => onModeChange('smart')}
          >
            Smart
          </button>
        </div>
      </div>

      {mode === 'browse' ? (
        <SearchableDropdown
          options={browseOptions}
          value={selected}
          onChange={onSelect}
          placeholder="search models…"
        />
      ) : (
        <div className="smart">
          <FilterPicker
            facets={facets}
            query={query}
            onQueryChange={onQueryChange}
            matchCount={smartRanked.length}
          />
          {smartRanked.length > 0 && (
            <ul className="smart-list">
              {smartRanked.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className={`smart-item${id === selected ? ' selected' : ''}${id === smartBest ? ' best' : ''}`}
                    onClick={() => onSelect(id)}
                  >
                    {id}
                    {id === smartBest && <span className="best-tag">best</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="selected-model">
        <span>{status}</span>
        {selected && (
          <span>
            {' · using '}
            <code>{selected}</code>
          </span>
        )}
      </div>

      <button
        type="button"
        className="add-member-btn"
        disabled={!canAddMember}
        onClick={onAddMember}
        title="Add this model to your chat members (@-mention)"
      >
        ＋ save as chat member
      </button>
    </div>
  );
}
