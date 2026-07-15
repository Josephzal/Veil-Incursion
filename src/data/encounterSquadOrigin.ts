import type { EncounterOrigin } from '../types/encounterSpawn';
import type { SynergySquadSpec } from './synergyEncounterTypes';
import { getEnemyOrigin } from './enemyDefinitions';

/** Curated squad affinity for procedural origin roll (RIVAL_MERC vs VEIL). */
export type EncounterSquadOriginTag = 'RIVAL_MERC' | 'VEIL' | 'ANY';

export function resolveSquadEncounterOriginTag(squad: SynergySquadSpec): EncounterSquadOriginTag {
  if (squad.encounterSquadOrigin) return squad.encounterSquadOrigin;
  const origins = new Set(
    squad.roster
      .map((unit) => getEnemyOrigin(unit.type))
      .filter((origin): origin is EncounterOrigin => origin != null),
  );
  if (origins.size === 0) return 'VEIL';
  if (origins.size > 1) return 'ANY';
  return origins.values().next().value ?? 'VEIL';
}

export function squadMatchesEncounterOrigin(
  squad: SynergySquadSpec,
  origin: EncounterOrigin,
): boolean {
  const origins = new Set(
    squad.roster
      .map((unit) => getEnemyOrigin(unit.type))
      .filter((unitOrigin): unitOrigin is EncounterOrigin => unitOrigin != null),
  );
  if (origins.size === 0) return origin === 'VEIL';
  if (origins.size > 1) return false;
  return origins.has(origin);
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
