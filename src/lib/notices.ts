/** Adjustments the library reported for a turn, deduped.
 *
 *  Pulled out of the `onWarning` subscription so it can be tested: the rest of
 *  that effect is React wiring, but WHICH notices a turn ends up with is logic,
 *  and a multi-step turn repeats the same adjustment once per step.
 */

/** `notices` with `message` appended, or unchanged if it is already there. */
export function appendNotice(notices: string[] | undefined, message: string): string[] {
  const current = notices ?? [];
  return current.includes(message) ? current : [...current, message];
}
