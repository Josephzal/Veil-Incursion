import type { AegisAbilityId, AbilityUnlockCost } from '../types/aegisCombat';
import { DEFAULT_AEGIS_LOADOUT } from '../types/aegisCombat';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import { getStashCount } from './resourceStashEngine';
import { AEGIS_ABILITY_CATALOG, getAbilityDefinition } from './aegisAbilities';
import { RESOURCE_REGISTRY } from './resourceRegistry';

/** Always available without an unlock transaction. */
export const ALWAYS_UNLOCKED_ABILITIES: readonly AegisAbilityId[] = ['STRIKE'];

/** Seeded on new accounts so the default combat loadout is valid. */
export const STARTER_UNLOCKED_ABILITIES: readonly AegisAbilityId[] = [
  ...DEFAULT_AEGIS_LOADOUT,
];

export function isUnlockCostEmpty(cost: AbilityUnlockCost): boolean {
  return Object.keys(cost).length === 0;
}

export function canAffordAbilityUnlock(
  stash: ResourceQuantity,
  cost: AbilityUnlockCost,
): boolean {
  return Object.entries(cost).every(([resourceId, quantity]) => {
    if (!quantity || quantity <= 0) return true;
    return getStashCount(stash, resourceId as ResourceItemId) >= quantity;
  });
}

export function deductAbilityUnlockCost(
  stash: ResourceQuantity,
  cost: AbilityUnlockCost,
): ResourceQuantity | null {
  if (!canAffordAbilityUnlock(stash, cost)) return null;
  if (isUnlockCostEmpty(cost)) return stash;

  const next = { ...stash };
  for (const [resourceId, quantity] of Object.entries(cost)) {
    if (!quantity || quantity <= 0) continue;
    const id = resourceId as ResourceItemId;
    const remaining = getStashCount(next, id) - quantity;
    if (remaining <= 0) {
      delete next[id];
    } else {
      next[id] = remaining;
    }
  }
  return next;
}

export function isAbilityUnlocked(
  unlocked: readonly AegisAbilityId[],
  abilityId: AegisAbilityId,
): boolean {
  if ((ALWAYS_UNLOCKED_ABILITIES as readonly string[]).includes(abilityId)) return true;
  return unlocked.includes(abilityId);
}

export function normalizeUnlockedAegisAbilities(
  stored: readonly AegisAbilityId[] | undefined,
  loadout: readonly AegisAbilityId[],
): AegisAbilityId[] {
  const set = new Set<AegisAbilityId>([
    ...ALWAYS_UNLOCKED_ABILITIES,
    ...STARTER_UNLOCKED_ABILITIES,
  ]);
  stored?.forEach((id) => set.add(id));
  loadout.forEach((id) => {
    if (id !== 'EVISCERATE') set.add(id);
  });
  return [...set];
}

export function formatAbilityUnlockCost(cost: AbilityUnlockCost): string {
  const entries = Object.entries(cost).filter(([, qty]) => qty != null && qty > 0);
  if (entries.length === 0) return 'DEFAULT';
  return entries
    .map(([id, qty]) => {
      const name = RESOURCE_REGISTRY[id as keyof typeof RESOURCE_REGISTRY]?.name ?? id;
      return `${qty}× ${name}`;
    })
    .join(' // ');
}

export function formatAbilityTags(abilityId: AegisAbilityId): string {
  return getAbilityDefinition(abilityId).tags.join(' · ');
}

export function abilityHasTag(
  abilityId: AegisAbilityId,
  tag: import('../types/aegisCombat').AbilityTag,
): boolean {
  return getAbilityDefinition(abilityId).tags.includes(tag);
}

export function getAssignableAbilities(): AegisAbilityId[] {
  return (Object.keys(AEGIS_ABILITY_CATALOG) as AegisAbilityId[]).filter(
    (id) => id !== 'EVISCERATE' && id !== 'WRAITH_PARRY',
  );
}
