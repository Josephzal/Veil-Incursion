import type { AegisAbilityId, AbilityUnlockCost, AegisTechniqueId } from '../types/aegisCombat';
import { ALL_AEGIS_TECHNIQUES } from '../types/aegisCombat';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import { getStashCount } from './resourceStashEngine';
import { AEGIS_ABILITY_CATALOG, getAbilityDefinition } from './aegisAbilities';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import { listAegisTechniques } from './aegisTechniqueCatalog';

/**
 * Phase A: technique unlock economy removed — all twelve techniques are available.
 * Legacy always-unlocked strike kept for combat compatibility references only.
 */
export const ALWAYS_UNLOCKED_ABILITIES: readonly AegisAbilityId[] = [
  'STRIKE',
  ...ALL_AEGIS_TECHNIQUES,
];

/** @deprecated Unlock economy removed — equals full technique pool. */
export const STARTER_UNLOCKED_ABILITIES: readonly AegisAbilityId[] = [
  ...ALL_AEGIS_TECHNIQUES,
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
  _unlocked: readonly AegisAbilityId[],
  abilityId: AegisAbilityId | AegisTechniqueId,
): boolean {
  // Phase A — no technique unlock gate.
  if ((ALL_AEGIS_TECHNIQUES as readonly string[]).includes(abilityId)) return true;
  if (abilityId === 'STRIKE' || abilityId === 'WRAITH_PARRY') return true;
  return true;
}

export function normalizeUnlockedAegisAbilities(
  _stored: readonly AegisAbilityId[] | undefined,
  _loadout: readonly string[],
): AegisAbilityId[] {
  return [...ALWAYS_UNLOCKED_ABILITIES];
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

/** Assignable techniques — all twelve; no unlock economy. */
export function getAssignableAbilities(): AegisTechniqueId[] {
  return [...listAegisTechniques()];
}

/** True when catalog still has a combat definition (including legacy). */
export function isLegacyCombatCatalogId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(AEGIS_ABILITY_CATALOG, id);
}
