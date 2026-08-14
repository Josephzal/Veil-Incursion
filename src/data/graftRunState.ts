import type { ClassType } from '../types/game';
import type { UniversalGraftId } from '../types/universalGraft';
import {
  normalizeAegisGraftMap,
  normalizeEnvoyGraftMap,
  normalizeHexShotGraftMap,
  normalizeUniversalGraftOffers,
} from './universalGraftRegistry';

export interface StoredGraftIncursionFields {
  activeClass?: ClassType | null;
  abilityGrafts?: unknown;
  hexShotAbilityGrafts?: unknown;
  envoyAbilityGrafts?: unknown;
  sanctuaryGraftOffers?: unknown;
  encounterUltimateDisabled?: unknown;
}

export interface NormalizedGraftIncursionFields {
  abilityGrafts: Record<string, UniversalGraftId>;
  hexShotAbilityGrafts: Record<string, UniversalGraftId>;
  envoyAbilityGrafts: Record<string, UniversalGraftId>;
  sanctuaryGraftOffers: UniversalGraftId[] | null;
  encounterUltimateDisabled: false;
}

/**
 * Canonical stored-input boundary for run-scoped action upgrades.
 * Invalid legacy/unknown IDs are dropped and offers survive only as an exact,
 * unique three-card set for the active class.
 */
export function normalizeGraftIncursionFields(
  input: StoredGraftIncursionFields,
): NormalizedGraftIncursionFields {
  const classId = input.activeClass ?? 'AEGIS';
  const offers = normalizeUniversalGraftOffers(classId, input.sanctuaryGraftOffers);
  return {
    abilityGrafts: normalizeAegisGraftMap(input.abilityGrafts) ?? {},
    hexShotAbilityGrafts: normalizeHexShotGraftMap(input.hexShotAbilityGrafts) ?? {},
    envoyAbilityGrafts: normalizeEnvoyGraftMap(input.envoyAbilityGrafts) ?? {},
    sanctuaryGraftOffers: offers?.length === 3 ? offers : null,
    encounterUltimateDisabled: false,
  };
}

export function hydrateGraftIncursionFields<T extends StoredGraftIncursionFields>(
  incursion: T,
): T & NormalizedGraftIncursionFields {
  return {
    ...incursion,
    ...normalizeGraftIncursionFields(incursion),
  };
}
