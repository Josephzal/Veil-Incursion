/**
 * Phase B — targeting helpers + hit-outcome brand resolution for weapon actions.
 */
import type { CombatGridSlotId } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import { aliveUnits, isUnitAlive } from './combatSquadEngine';
import { clampBrandGain } from './aegisWeaponActionResolveEngine';
import type { AegisWeaponCombatState } from './aegisWeaponCombatState';

export function isFrontlineOccupied(squad: EnemyCombatProfile[]): boolean {
  return aliveUnits(squad).some((u) => u.gridSlot?.startsWith('FL'));
}

export function rowOfSlot(slot: CombatGridSlotId | string | undefined): 'FL' | 'BL' | null {
  if (!slot) return null;
  if (slot.startsWith('FL')) return 'FL';
  if (slot.startsWith('BL')) return 'BL';
  return null;
}

/** Melee reach for Dread Horizon: cannot reach backline while frontline is occupied. */
export function canReachUnitWithMeleeRowSweep(
  squad: EnemyCombatProfile[],
  unit: EnemyCombatProfile,
): boolean {
  if (!isUnitAlive(unit)) return false;
  const row = rowOfSlot(unit.gridSlot);
  if (!row) return false;
  if (row === 'FL') return true;
  return !isFrontlineOccupied(squad);
}

/**
 * Given an anchor unit selection, return authored Dread Horizon targets
 * (occupied positions in that row, max 2).
 */
export function resolveDreadHorizonTargets(
  squad: EnemyCombatProfile[],
  anchorUnitId: string,
): EnemyCombatProfile[] {
  const anchor = squad.find((u) => u.unitId === anchorUnitId);
  if (!anchor || !canReachUnitWithMeleeRowSweep(squad, anchor)) return [];
  const row = rowOfSlot(anchor.gridSlot);
  if (!row) return [];
  const inRow = aliveUnits(squad)
    .filter((u) => rowOfSlot(u.gridSlot) === row)
    .sort((a, b) => String(a.gridSlot).localeCompare(String(b.gridSlot)));
  return inRow.slice(0, 2);
}

export function previewDreadHorizonUnitIds(
  squad: EnemyCombatProfile[],
  anchorUnitId: string,
): string[] {
  return resolveDreadHorizonTargets(squad, anchorUnitId)
    .map((u) => u.unitId!)
    .filter(Boolean);
}

/** Standard melee reach — backline blocked by occupied frontline column guard is handled by combatTargeting. */
export function canTargetWithMeleeWeaponAction(
  squad: EnemyCombatProfile[],
  unitId: string,
  opts?: { occult?: boolean },
): boolean {
  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit || !isUnitAlive(unit)) return false;
  if (opts?.occult) return true;
  if (unit.isUntargetable) return false;
  const slot = unit.gridSlot as CombatGridSlotId | undefined;
  if (slot?.startsWith('BL')) {
    const guardSlot = slot === 'BL_0' ? 'FL_0' : 'FL_1';
    const guard = squad.find((u) => u.gridSlot === guardSlot && isUnitAlive(u));
    if (guard) return false;
  }
  return true;
}

export interface AuthoredHitOutcome {
  hit: boolean;
  killed: boolean;
  removedFinalArmor?: boolean;
  enteredFractured?: boolean;
  /** Bonus / rider / riposte — never awards mastery Brands. */
  isBonusHit?: boolean;
}

/** Rupture: at most one Brand from armor-break OR Fracture entry (or both). */
export function resolveRuptureBrandGain(
  currentBrands: number,
  outcome: AuthoredHitOutcome,
): { brandGain: number; reason: string | null } {
  if (!outcome.hit || outcome.isBonusHit) {
    return { brandGain: 0, reason: null };
  }
  const mastery = outcome.removedFinalArmor === true || outcome.enteredFractured === true;
  if (!mastery) return { brandGain: 0, reason: null };
  const gain = clampBrandGain(currentBrands, 1);
  return {
    brandGain: gain,
    reason: gain > 0 ? 'Rupture mastery — 1 Brand.' : 'Brand cap reached.',
  };
}

/** Divergence / Dread Horizon: exactly 1 Brand if both authored contacts hit. */
export function resolveBothHitsBrandGain(
  currentBrands: number,
  authoredHits: readonly AuthoredHitOutcome[],
  label: string,
): { brandGain: number; reason: string | null } {
  const authored = authoredHits.filter((h) => !h.isBonusHit);
  if (authored.length < 2) return { brandGain: 0, reason: null };
  if (!authored.every((h) => h.hit)) return { brandGain: 0, reason: null };
  const gain = clampBrandGain(currentBrands, 1);
  return {
    brandGain: gain,
    reason: gain > 0 ? `${label} — both hits — 1 Brand.` : 'Brand cap reached.',
  };
}

export function applyReserveGain(current: number, gain: number, max = 100): number {
  if (gain <= 0) return current;
  return Math.min(max, current + gain);
}

export function applyApRefund(current: number, refund: number, maxAp: number): number {
  if (refund <= 0) return current;
  return Math.min(maxAp, current + refund);
}

/** Poise / Dreadbound damage reduction before Guard. */
export function applyPercentDamageReduction(damage: number, pct: number): number {
  if (damage <= 0 || pct <= 0) return damage;
  return Math.max(0, Math.floor(damage * (1 - pct / 100)));
}

export function isEligibleDirectEnemyAttack(args: {
  unblockable?: boolean;
  environmental?: boolean;
  damageOverTime?: boolean;
  targetsAegis?: boolean;
  isDamaging?: boolean;
}): boolean {
  if (args.unblockable) return false;
  if (args.environmental) return false;
  if (args.damageOverTime) return false;
  if (args.targetsAegis === false) return false;
  if (args.isDamaging === false) return false;
  return true;
}

export function eclipseEvadeBonusActive(state: AegisWeaponCombatState): boolean {
  return state.eclipseActive;
}

export function poiseActive(state: AegisWeaponCombatState): boolean {
  return state.poiseActive;
}

export function isCommitted(state: AegisWeaponCombatState): boolean {
  return state.committed;
}
