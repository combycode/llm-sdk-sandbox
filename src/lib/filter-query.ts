/** The tag query as a set of clauses, so a picker and the text field can both
 *  edit it without one clobbering the other.
 *
 *  The library's DSL is a `;`-separated list of clauses. That is the whole
 *  grammar the picker needs to speak: toggling a chip adds or removes one
 *  clause, and everything else the user typed survives untouched. Keeping the
 *  TEXT as the single source of truth — rather than a parallel structure the
 *  chips own — is what lets someone type `context > 200k` by hand and still
 *  click chips afterwards.
 */

/** Split a query into its clauses, dropping empties and surrounding space. */
export function parseClauses(query: string): string[] {
  return query
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean);
}

export function formatClauses(clauses: string[]): string {
  return clauses.join('; ');
}

/** Two clauses are "the same filter" when they set the same key, whatever value
 *  they carry — so picking `price:low` after `price:free` replaces it rather
 *  than adding a second, contradictory price clause.
 *
 *  Comparison operators are deliberately NOT treated as the same key: `context >
 *  200k` and `context:large` are different questions, and someone who typed the
 *  first did not ask for it to vanish when they click the second. */
export function keyOf(clause: string): string | null {
  const colon = clause.indexOf(':');
  if (colon > 0) return clause.slice(0, colon).trim();
  if (/[<>]/.test(clause)) return null;
  return clause.trim() || null;
}

export function hasClause(query: string, clause: string): boolean {
  return parseClauses(query).some((c) => c === clause);
}

/** Add the clause, or remove it if it is already there. Any other clause setting
 *  the same key is replaced. */
export function toggleClause(query: string, clause: string): string {
  const clauses = parseClauses(query);
  if (clauses.includes(clause)) {
    return formatClauses(clauses.filter((c) => c !== clause));
  }
  const key = keyOf(clause);
  const kept = key === null ? clauses : clauses.filter((c) => keyOf(c) !== key);
  return formatClauses([...kept, clause]);
}

/** The clause a facet value becomes. A `yes` on a flag key is the bare form the
 *  parser already expands (`vision` === `vision:yes`), which keeps the composed
 *  query readable. */
export function clauseFor(key: string, value: string, bare: boolean): string {
  if (bare && value === 'yes') return key;
  return `${key}:${value}`;
}

/** A flag is off, required (`vision`), or excluded (`vision:no`). */
export type FlagState = 'off' | 'on' | 'not';

export function flagState(query: string, key: string): FlagState {
  const clauses = parseClauses(query);
  if (clauses.includes(key)) return 'on';
  if (clauses.includes(`${key}:no`)) return 'not';
  return 'off';
}

/** One chip, three meanings: off → require → exclude → off.
 *
 *  A `yes`/`no` pair per flag put ten identical `yes` chips and ten identical
 *  `no` chips down the panel, distinguishable only by the row label. Cycling one
 *  chip says the same thing in a third of the space, and the chip itself carries
 *  which of the three it currently means. */
export function cycleFlag(query: string, key: string): string {
  switch (flagState(query, key)) {
    case 'off':
      return toggleClause(query, key);
    case 'on':
      return toggleClause(toggleClause(query, key), `${key}:no`);
    default:
      return toggleClause(query, `${key}:no`);
  }
}
