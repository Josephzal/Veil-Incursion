/**
 * Single presentation authority for Slumped copy.
 *
 * Both the battlefield nameplate and Enemy Intel read from here so the two
 * surfaces cannot disagree. Timing and eligibility come from the canonical
 * slump fields on the unit snapshot — nothing here schedules or decides them.
 *
 * Run tests: npx tsx --test src/data/combatSlumpedPresentation.test.ts
 */

export interface SlumpedPresentation {
  /** Header state word, replaces the HP readout. */
  stateLabel: string;
  /** Lower-left tactical line, stands in for the suppressed intent. */
  executableLabel: string;
  /** Revival timing derived from canonical slump counters. */
  revivalLabel: string;
  /** Short revival copy for the compact plate cluster. */
  revivalShort: string;
}

export interface SlumpedSource {
  isSlumped?: boolean | null;
  slumpTurnsRemaining?: number | null;
  slumpGraceThisPlayerTurn?: boolean | null;
}

/** True while the canonical Slumped state makes a normal next intent inapplicable. */
export function isSlumpedForPresentation(unit: SlumpedSource): boolean {
  return unit.isSlumped === true;
}

/**
 * Intel and the battlefield must both suppress `NEXT: <intent>` while slumped —
 * the enemy is not scheduled to take that action.
 */
export function shouldSuppressNextIntent(unit: SlumpedSource): boolean {
  return isSlumpedForPresentation(unit);
}

export function resolveSlumpedPresentation(unit: SlumpedSource): SlumpedPresentation | null {
  if (!isSlumpedForPresentation(unit)) return null;

  const turns = unit.slumpTurnsRemaining ?? 0;
  const revivalLabel = unit.slumpGraceThisPlayerTurn === true
    ? 'REVIVES AFTER NEXT FULL TURN'
    : turns <= 1
      ? 'REVIVES IN 1 FULL TURN'
      : `REVIVES IN ${turns} FULL TURNS`;

  return {
    stateLabel: 'SLUMPED',
    executableLabel: 'EXECUTABLE',
    revivalLabel,
    revivalShort: unit.slumpGraceThisPlayerTurn === true
      ? 'REVIVES +1'
      : `REVIVES ${Math.max(1, turns)}T`,
  };
}
