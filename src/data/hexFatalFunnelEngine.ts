/**
 * Hex Black Door Fatal Funnel — column/lane allocation (W.4).
 */
import type { CombatGridSlotId } from '../types/combatGrid';
import { columnSlotsFor, isCombatGridSlotId } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import { isUnitAlive } from './combatSquadEngine';

export const FATAL_FUNNEL_AP_COST = 2;
export const FATAL_FUNNEL_STAMINA_COST = 12;
export const FATAL_FUNNEL_AMMO_COST = 1;
export const FATAL_FUNNEL_PRIMARY_DAMAGE = 16;
export const FATAL_FUNNEL_REAR_DAMAGE = 11;

export interface FatalFunnelLaneHit {
  unitId: string;
  gridSlot: CombatGridSlotId;
  authoredDamage: number;
  isPrimary: boolean;
  isBackline: boolean;
}

export interface FatalFunnelLanePlan {
  columnSlots: readonly CombatGridSlotId[];
  hits: FatalFunnelLaneHit[];
  primaryTargetId: string;
}

/**
 * Resolve a column from an anchor unit. Never spills laterally.
 * Front occupied → primary 16 + optional rear 11.
 * Rear-only → primary 16 on backline (caller applies ×0.75 falloff).
 */
export function resolveFatalFunnelLane(
  squad: readonly EnemyCombatProfile[],
  anchorUnitId: string | null | undefined,
): FatalFunnelLanePlan | null {
  if (!anchorUnitId) return null;
  const anchor = squad.find((u) => u.unitId === anchorUnitId && isUnitAlive(u));
  if (!anchor?.gridSlot || !isCombatGridSlotId(anchor.gridSlot)) return null;

  const columnSlots = columnSlotsFor(anchor.gridSlot);
  const flSlot = columnSlots.find((s) => s.startsWith('FL'))!;
  const blSlot = columnSlots.find((s) => s.startsWith('BL'))!;

  const flUnit = squad.find((u) => u.gridSlot === flSlot && isUnitAlive(u) && u.unitId);
  const blUnit = squad.find((u) => u.gridSlot === blSlot && isUnitAlive(u) && u.unitId);

  if (!flUnit && !blUnit) return null;

  const hits: FatalFunnelLaneHit[] = [];
  if (flUnit?.unitId) {
    hits.push({
      unitId: flUnit.unitId,
      gridSlot: flSlot,
      authoredDamage: FATAL_FUNNEL_PRIMARY_DAMAGE,
      isPrimary: true,
      isBackline: false,
    });
    if (blUnit?.unitId) {
      hits.push({
        unitId: blUnit.unitId,
        gridSlot: blSlot,
        authoredDamage: FATAL_FUNNEL_REAR_DAMAGE,
        isPrimary: false,
        isBackline: true,
      });
    }
  } else if (blUnit?.unitId) {
    hits.push({
      unitId: blUnit.unitId,
      gridSlot: blSlot,
      authoredDamage: FATAL_FUNNEL_PRIMARY_DAMAGE,
      isPrimary: true,
      isBackline: true,
    });
  }

  if (hits.length === 0) return null;
  return {
    columnSlots,
    hits,
    primaryTargetId: hits[0]!.unitId,
  };
}

/** Living unit IDs in the same column as the anchor (for preview highlight). */
export function previewFatalFunnelUnitIds(
  squad: readonly EnemyCombatProfile[],
  anchorUnitId: string | null | undefined,
): string[] {
  const plan = resolveFatalFunnelLane(squad, anchorUnitId);
  if (!plan) return [];
  return plan.hits.map((h) => h.unitId);
}
