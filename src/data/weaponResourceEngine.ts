import type { ResourceQuantity } from '../types/resourceItem';
import type { WeaponResourceCost } from '../types/weapon';
import { getStashCount } from './resourceStashEngine';

export function canAffordCost(
  stash: ResourceQuantity,
  costs: readonly WeaponResourceCost[],
): boolean {
  return costs.every((cost) => getStashCount(stash, cost.resourceId) >= cost.quantity);
}

export function deductCostFromStash(
  stash: ResourceQuantity,
  costs: readonly WeaponResourceCost[],
): ResourceQuantity | null {
  if (!canAffordCost(stash, costs)) return null;
  const next = { ...stash };
  costs.forEach((cost) => {
    next[cost.resourceId] = (next[cost.resourceId] ?? 0) - cost.quantity;
  });
  return next;
}

export function formatWeaponCostLine(costs: readonly WeaponResourceCost[]): string {
  if (costs.length === 0) return 'UNLOCKED';
  return costs
    .map((cost) => `${cost.resourceId.replace(/-/g, ' ').toUpperCase()} ×${cost.quantity}`)
    .join(' // ');
}

export function countMissingCost(
  stash: ResourceQuantity,
  costs: readonly WeaponResourceCost[],
): { missingTotal: number; parts: string[] } {
  let missingTotal = 0;
  const parts: string[] = [];
  costs.forEach((cost) => {
    const owned = getStashCount(stash, cost.resourceId);
    if (owned < cost.quantity) {
      const gap = cost.quantity - owned;
      missingTotal += gap;
      parts.push(`${cost.resourceId.replace(/-/g, ' ')} ×${gap}`);
    }
  });
  return { missingTotal, parts };
}
