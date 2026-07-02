import { rollCombatResourceDrops } from './combatRewardEngine';
import type { ResourceItemId } from '../types/resourceItem';

/** Roll a resource harvest pool capped at standard (non-elite) combat salvage yield. */
export function rollProceduralResourcePool(depth: number, seed: string): ResourceItemId[] {
  return rollCombatResourceDrops({
    depth,
    seed,
    isElite: false,
    isGatekeeper: false,
    slainEnemies: [],
  });
}
