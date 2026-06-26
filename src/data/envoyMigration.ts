import type { EnvoyAbilityId } from '../types/operativeClass';

/** Legacy save ids → canonical ability ids. */
const LEGACY_ENVOY_ABILITY_IDS: Record<string, EnvoyAbilityId> = {
  SPATIAL_COLLAPSE: 'NECROTIC_BLOOM',
  GRAVITY_WELL: 'PARALYTIC_MIASMA',
};

export function migrateEnvoyAbilityId(id: string): EnvoyAbilityId {
  return (LEGACY_ENVOY_ABILITY_IDS[id] ?? id) as EnvoyAbilityId;
}

export function migrateEnvoyAbilityList(ids: readonly string[]): EnvoyAbilityId[] {
  return ids.map((id) => migrateEnvoyAbilityId(id));
}
