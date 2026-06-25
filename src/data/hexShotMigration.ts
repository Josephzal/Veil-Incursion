import type { HexShotAbilityId } from '../types/operativeClass';
import type { HexShotGraftId } from '../types/classGraft';

/** Legacy save ids → canonical ability ids. */
const LEGACY_HEX_SHOT_ABILITY_IDS: Record<string, HexShotAbilityId> = {
  BRIMSTONE_PAYLOAD: 'BLEEDING_PAYLOAD',
};

export function migrateHexShotAbilityId(id: string): HexShotAbilityId {
  return (LEGACY_HEX_SHOT_ABILITY_IDS[id] ?? id) as HexShotAbilityId;
}

export function migrateHexShotAbilityList(ids: readonly string[]): HexShotAbilityId[] {
  return ids.map((id) => migrateHexShotAbilityId(id));
}

/** Resolve graft bindings after ability id renames (e.g. saved incursion maps). */
export function resolveHexShotAbilityGraftId(
  grafts: Partial<Record<string, HexShotGraftId>>,
  abilityId: HexShotAbilityId,
): HexShotGraftId | undefined {
  const resolved = migrateHexShotAbilityId(abilityId);
  if (grafts[resolved]) return grafts[resolved];
  if (resolved === 'BLEEDING_PAYLOAD' && grafts.BRIMSTONE_PAYLOAD) {
    return grafts.BRIMSTONE_PAYLOAD;
  }
  return undefined;
}
