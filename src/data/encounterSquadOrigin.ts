import type { EncounterOrigin } from './originDeckEngine';
import type { SynergySquadSpec } from './synergyEncounterTypes';

/** Curated squad affinity for the run origin deck (CABAL vs VEIL cards). */
export type EncounterSquadOriginTag = 'CABAL' | 'VEIL' | 'ANY';

/** Mixed rosters that may appear on either origin card. */
const ANY_SQUAD_IDS = new Set<string>([
  'CORRUPT_AUTO_DEFENSE',
  'CORRUPT_KINETIC_CASCADE',
]);

const CABAL_ELITE_IDS = new Set<string>([
  'ELITE_WARDEN',
  'ELITE_BREACHER',
  'ELITE_FIXER_NODE',
  'ELITE_COIL_SNIPER',
]);

export function resolveSquadEncounterOriginTag(squad: SynergySquadSpec): EncounterSquadOriginTag {
  if (squad.encounterSquadOrigin) return squad.encounterSquadOrigin;
  if (ANY_SQUAD_IDS.has(squad.id)) return 'ANY';
  if (squad.id.startsWith('CABAL_') || CABAL_ELITE_IDS.has(squad.id)) return 'CABAL';
  return 'VEIL';
}

export function squadMatchesEncounterOrigin(
  squad: SynergySquadSpec,
  origin: EncounterOrigin,
): boolean {
  const tag = resolveSquadEncounterOriginTag(squad);
  return tag === 'ANY' || tag === origin;
}

export function filterSquadsByEncounterOrigin<T extends SynergySquadSpec>(
  squads: readonly T[],
  origin: EncounterOrigin | null | undefined,
): T[] {
  if (origin == null) return [...squads];
  return squads.filter((squad) => squadMatchesEncounterOrigin(squad, origin));
}

export interface SquadPickAttempt {
  /** When undefined, 20% interloper roll is used. */
  interloper?: boolean;
  filterOrigin: boolean;
}

/** Widening fallback: themed → interloper → drop origin filter. */
export const SQUAD_PICK_ATTEMPTS: readonly SquadPickAttempt[] = [
  { filterOrigin: true },
  { interloper: true, filterOrigin: true },
  { filterOrigin: false },
  { interloper: true, filterOrigin: false },
];
