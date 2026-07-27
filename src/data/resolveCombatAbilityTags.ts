import { AEGIS_ABILITY_CATALOG } from './aegisAbilities';
import { HEX_SHOT_ABILITY_CATALOG } from './hexShotAbilities';
import { ENVOY_ABILITY_CATALOG } from './envoyAbilities';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { EnvoyAbilityId, HexShotAbilityId } from '../types/operativeClass';

/** Resolve combat tags for an ability id across Aegis / Hex / Envoy catalogs. */
export function resolveCombatAbilityTags(
  abilityId: string | undefined | null,
): readonly string[] {
  if (!abilityId) return [];
  const aegis = AEGIS_ABILITY_CATALOG[abilityId as AegisAbilityId];
  if (aegis) return aegis.tags;
  const hex = HEX_SHOT_ABILITY_CATALOG[abilityId as HexShotAbilityId];
  if (hex) return hex.tags;
  const envoy = ENVOY_ABILITY_CATALOG[abilityId as EnvoyAbilityId];
  if (envoy) return envoy.tags;
  return [];
}
