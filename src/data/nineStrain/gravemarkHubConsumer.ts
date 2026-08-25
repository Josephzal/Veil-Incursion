/**
 * Live Hub consumer for Gravemark Stage E.1 movement effects.
 * Mutates the authoritative live squad grid exactly once per queued effect, reusing the
 * existing atomic move/swap primitives (`unitPlacedAtSlot`, `swapUnitGridSlots`) — no second
 * grid model. Callers must have already drained the queue via the bridge's consume-once
 * `consumeGravemarkPendingMovement()` so a given effect can never be replayed.
 */
import type { GravemarkPendingMovementEffect } from '../../types/gravemark';
import type { EnemyCombatProfile } from '../../types/run';
import { swapUnitGridSlots } from '../combatLifecycleEngine';
import { getUnitById, unitPlacedAtSlot } from '../combatSquadEngine';

export interface GravemarkMovementApplyResult {
  squad: EnemyCombatProfile[];
  /** Effects that actually mutated the grid (trigger unit still present in the live squad). */
  applied: GravemarkPendingMovementEffect[];
  /** Effects skipped because the trigger unit was no longer present (dead/removed since queuing). */
  skipped: GravemarkPendingMovementEffect[];
}

/**
 * Applies queued Gravemark MOVE/SWAP effects to the live squad in stable creation order.
 * Pure function — the Hub is responsible for writing the returned squad back via its own
 * setSquad/syncSquad path exactly once.
 */
export function applyGravemarkMovementToSquad(
  squad: readonly EnemyCombatProfile[],
  effects: readonly GravemarkPendingMovementEffect[],
): GravemarkMovementApplyResult {
  let next = squad.slice();
  const applied: GravemarkPendingMovementEffect[] = [];
  const skipped: GravemarkPendingMovementEffect[] = [];
  const ordered = effects.slice().sort((a, b) => a.createdOrder - b.createdOrder);

  for (const effect of ordered) {
    const trigger = getUnitById(next, effect.triggerUnitId);
    if (!trigger?.unitId) {
      skipped.push(effect);
      continue;
    }
    if (effect.kind === 'SWAP' && effect.passengerUnitId) {
      const passenger = getUnitById(next, effect.passengerUnitId);
      if (!passenger?.unitId) {
        // Passenger no longer present: degrade to a plain move for the trigger unit.
        next = next.map((unit) => (unit.unitId === trigger.unitId ? unitPlacedAtSlot(unit, effect.toSlot) : unit));
        applied.push(effect);
        continue;
      }
      next = swapUnitGridSlots(next as EnemyCombatProfile[], trigger.unitId, passenger.unitId);
      applied.push(effect);
      continue;
    }
    next = next.map((unit) => (unit.unitId === trigger.unitId ? unitPlacedAtSlot(unit, effect.toSlot) : unit));
    applied.push(effect);
  }

  return { squad: next, applied, skipped };
}
