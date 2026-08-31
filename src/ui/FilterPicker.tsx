/** Pick model filters by clicking, because nobody can guess the tag DSL.
 *
 *  The smart field speaks a small query language (`type:chat; vision; cheap`).
 *  It is compact and it is unguessable — the only way to learn it was to read
 *  the library's source, so in practice the field went unused or was typed
 *  wrong, and a wrong tag comes back as "no models matched" rather than as an
 *  error. This shows the vocabulary instead of expecting it to be known.
 *
 *  Two decisions worth stating:
 *
 *  - The TEXT stays the source of truth. Chips edit the same string the field
 *    holds, so a hand-typed `context > 200k` survives clicking, and anything
 *    typed shows up as a lit chip. A parallel structure owned by the picker
 *    would have to be reconciled with the text on every keystroke, and the two
 *    would disagree the moment someone typed something the picker cannot model.
 *
 *  - The facets come from the LIBRARY (`filterFacets(catalog)`), not from a list
 *    in this file. A list here would be a second copy of the parser's
 *    vocabulary, and it would drift silently.
 *
 *  A flag (`vision`, `tools`, `search`, …) is ONE chip that cycles
 *  off → require → exclude, not a `yes`/`no` pair. The first version rendered the
 *  pair and produced ten identical `yes` chips and ten identical `no` chips down
 *  the panel, told apart only by the row label — unreadable, and easy to click
 *  wrong. The alias presets went the same way: every one of them (`cheap`,
 *  `free`, `tiny`, `huge`) expands to a value chip shown two rows below, so they
 *  were the same filter twice with different names. They still work if typed.
 */
import { useMemo, useState } from 'react';
import type { FilterFacet } from '@combycode/llm-sdk';
import { clauseFor, cycleFlag, flagState, hasClause, parseClauses, toggleClause } from '../lib/filter-query';

/** A yes/no flag — one chip that cycles, rather than a pair that repeats. */
const isFlag = (f: FilterFacet): boolean =>
  f.bare && f.values.length === 2 && f.values[0] === 'yes' && f.values[1] === 'no';

export function FilterPicker({
  facets,
  query,
  onQueryChange,
  matchCount,
}: {
  facets: FilterFacet[];
  query: string;
  onQueryChange: (q: string) => void;
  /** How many models the current query selects — the answer to "did that help?". */
  matchCount: number;
}) {
  const [open, setOpen] = useState(false);

  /** Facets grouped in the order the library declares them, so a new category
   *  appears without this file being edited. */
  const groups = useMemo(() => {
    const byCategory = new Map<string, FilterFacet[]>();
    for (const f of facets) {
      // A facet with no values and no bare form can offer nothing to click.
      if (f.values.length === 0 && !f.bare) continue;
      const list = byCategory.get(f.category) ?? [];
      list.push(f);
      byCategory.set(f.category, list);
    }
    return [...byCategory.entries()];
  }, [facets]);

  const active = parseClauses(query);

  return (
    <div className="filter-picker">
      <div className="filter-bar">
        <button
          type="button"
          className={`filter-toggle${open ? ' filter-toggle-on' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? '▾' : '▸'} Filters
          {active.length > 0 && <span className="filter-count">{active.length}</span>}
        </button>

        {/* The composed query, always visible: the picker teaches the syntax by
            showing what each click writes. */}
        <input
          className="smart-query"
          placeholder="type:chat; vision; cheap"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />

        {active.length > 0 && (
          <button type="button" className="filter-clear" onClick={() => onQueryChange('')} title="Clear all filters">
            clear
          </button>
        )}
      </div>

      {open && (
        <div className="filter-panel">
          {groups.map(([category, list]) => (
            <div className="filter-group" key={category}>
              <div className="filter-group-name">{category}</div>
              {/* Flags collapse into one row of name-chips: `vision`, `tools`, … */}
              {list.some(isFlag) && (
                <div className="filter-row">
                  <span className="filter-key">any of</span>
                  <div className="filter-chips">
                    {list.filter(isFlag).map((facet) => {
                      const state = flagState(query, facet.key);
                      return (
                        <button
                          key={facet.key}
                          type="button"
                          className={`filter-chip filter-flag${state === 'on' ? ' filter-chip-on' : ''}${
                            state === 'not' ? ' filter-chip-not' : ''
                          }`}
                          onClick={() => onQueryChange(cycleFlag(query, facet.key))}
                          title={
                            state === 'off'
                              ? `require ${facet.key}`
                              : state === 'on'
                                ? `exclude ${facet.key} (${facet.key}:no)`
                                : 'clear'
                          }
                        >
                          {state === 'not' && <span className="filter-not">no</span>}
                          {facet.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {list.filter((f) => !isFlag(f)).map((facet) => (
                <div className="filter-row" key={facet.key}>
                  <span className="filter-key" title={`${facet.key}:…`}>
                    {facet.label}
                  </span>
                  <div className="filter-chips">
                    {facet.values.map((value) => {
                      const clause = clauseFor(facet.key, value, facet.bare);
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`filter-chip${hasClause(query, clause) ? ' filter-chip-on' : ''}`}
                          onClick={() => onQueryChange(toggleClause(query, clause))}
                          title={clause}
                        >
                          {value}
                        </button>
                      );
                    })}
                    {facet.numeric && (
                      <span className="filter-hint" title="type a comparison in the field">
                        or {facet.key} &gt; N
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="filter-result">
            {matchCount} model{matchCount === 1 ? '' : 's'} match
          </div>
        </div>
      )}
    </div>
  );
}
