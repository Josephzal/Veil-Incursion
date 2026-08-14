import type { NineStrainRuntimeState, UniversalBoonDefinition } from '../../types/nineStrain';
import { applyAcquire } from './ownership';
import { cloneNineStrainRuntimeState } from './persistence';

/**
 * Developer / test direct grant. Live acquisition routing stays off in B.1.
 * Requires an already-active NINE_STRAIN run mode.
 */
export function directGrantUniversalBoon(
  state: NineStrainRuntimeState,
  definitions: Map<string, UniversalBoonDefinition>,
  definitionId: string,
  extra: { premiumVerdictSource?: boolean; combatDepth?: number; equippedWeaponFamilyId?: string } = {},
): NineStrainRuntimeState {
  if (state.boonSystemMode !== 'NINE_STRAIN') {
    return cloneNineStrainRuntimeState(state);
  }
  const result = applyAcquire(state, definitions, definitionId, {
    allowTestOffers: false,
    premiumVerdictSource: extra.premiumVerdictSource,
    combatDepth: extra.combatDepth,
    equippedWeaponFamilyId: extra.equippedWeaponFamilyId,
  });
  return result.eligible ? result.after : cloneNineStrainRuntimeState(state);
}
