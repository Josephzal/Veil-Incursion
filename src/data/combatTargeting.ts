import type { AegisAbilityId } from '../types/aegisCombat';
import type { CombatGridSlotId } from '../types/combatGrid';
import { BACKLINE_SLOTS } from '../types/combatGrid';
import { aliveUnits, isUnitAlive, unitAtSlot } from './combatSquadEngine';
import type { EnemyCombatProfile } from '../types/run';
import {
  aegisWeaponActionTargetMode,
  isAegisWeaponActionCatalogId,
} from './aegisWeaponActionCatalog';
import {
  canReachUnitWithMeleeRowSweep,
  canTargetWithMeleeWeaponAction,
} from './aegisWeaponActionRuntime';

export type AbilityTargetMode =
  | 'NONE'
  | 'SINGLE'
  | 'ALL'
  | 'DUAL'
  | 'ROW'
  /** Hex Contact Front — confirm with 1 target (4+0) or 2 distinct (2+2). */
  | 'ONE_OR_TWO'
  /** Hex Fatal Funnel — select one column/lane (front+back pair). */
  | 'COLUMN';

const ABILITY_TARGET_MODE: Partial<Record<AegisAbilityId, AbilityTargetMode>> = {
  STRIKE: 'SINGLE',
  VEIL_PIERCER: 'SINGLE',
  RUIN: 'ALL',
  GRAVE_BIND: 'SINGLE',
  NAIL_TO_GRID: 'SINGLE',
  CRIMSON_PACT: 'NONE',
  WRAITH_PARRY: 'NONE',
  ASHEN_MANTLE: 'NONE',
  SHADOW_STEP: 'SINGLE',
  DEMONS_LUNG: 'NONE',
  EVISCERATE: 'SINGLE',
  DEVASTATE: 'SINGLE',
  RUNEBOUND_CARAPACE: 'NONE',
  FINAL_MERCY: 'SINGLE',
  REAVE: 'SINGLE',
};

/** Column-pair line of sight: back-top guarded by front-top, back-bottom by front-bottom. */
const COLUMN_GUARD: Partial<Record<CombatGridSlotId, CombatGridSlotId>> = {
  BL_0: 'FL_0',
  BL_1: 'FL_1',
};

export function abilityTargetMode(
  abilityId: AegisAbilityId | string,
  opts?: { doomfallReleaseAvailable?: boolean },
): AbilityTargetMode {
  if (isAegisWeaponActionCatalogId(abilityId)) {
    return aegisWeaponActionTargetMode(abilityId, opts);
  }
  return ABILITY_TARGET_MODE[abilityId as AegisAbilityId] ?? 'SINGLE';
}

export function abilityRequiresTarget(
  abilityId: AegisAbilityId | string,
  opts?: { doomfallReleaseAvailable?: boolean },
): boolean {
  const mode = abilityTargetMode(abilityId, opts);
  return mode === 'SINGLE'
    || mode === 'DUAL'
    || mode === 'ROW'
    || mode === 'ONE_OR_TWO'
    || mode === 'COLUMN';
}

function isOccultAbility(abilityId: AegisAbilityId): boolean {
  return abilityId === 'VEIL_PIERCER';
}

function isHookAbility(abilityId: AegisAbilityId): boolean {
  return abilityId === 'GRAVE_BIND';
}

export function columnGuardSlot(backSlot: CombatGridSlotId): CombatGridSlotId | null {
  return COLUMN_GUARD[backSlot] ?? null;
}

export function isColumnBlocked(
  squad: EnemyCombatProfile[],
  backSlot: CombatGridSlotId,
): boolean {
  const guardSlot = columnGuardSlot(backSlot);
  if (!guardSlot) return false;
  return unitAtSlot(squad, guardSlot) != null;
}

export function isUnitColumnBlocked(
  squad: EnemyCombatProfile[],
  unit: EnemyCombatProfile,
): boolean {
  const slot = unit.gridSlot as CombatGridSlotId | undefined;
  if (!slot || !slot.startsWith('BL')) return false;
  return isColumnBlocked(squad, slot);
}

export interface TargetEligibilityOpts {
  doomfallReleaseAvailable?: boolean;
  /**
   * Gravemark False Position (Stage E.1): while Unmoored, a hostile counts as both frontline
   * and backline for target-eligibility gates only (e.g. the Grave Bind hook). Real lane still
   * governs cover, damage modifiers, committed patterns, position order, and intent — this
   * predicate must never be consulted outside eligibility checks.
   */
  isUnitUnmoored?: (unitId: string) => boolean;
}

export function canTargetWithAbility(
  squad: EnemyCombatProfile[],
  abilityId: AegisAbilityId | string,
  unitId: string,
  opts?: TargetEligibilityOpts,
): boolean {
  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit || !isUnitAlive(unit)) return false;

  const mode = abilityTargetMode(abilityId, opts);
  if (mode === 'NONE' || mode === 'ALL') return false;

  if (isAegisWeaponActionCatalogId(abilityId)) {
    if (mode === 'ROW') {
      return canReachUnitWithMeleeRowSweep(squad, unit);
    }
    return canTargetWithMeleeWeaponAction(squad, unitId);
  }

  if (isHookAbility(abilityId as AegisAbilityId)) {
    if (unit.gridSlot?.startsWith('BL') === true) return true;
    return opts?.isUnitUnmoored?.(unitId) === true;
  }

  if (isOccultAbility(abilityId as AegisAbilityId)) return true;

  if (unit.isUntargetable) return false;

  const slot = unit.gridSlot as CombatGridSlotId | undefined;
  if (slot?.startsWith('BL') && isColumnBlocked(squad, slot)) return false;
  return true;
}

export function isUnitBlockedForAbility(
  squad: EnemyCombatProfile[],
  abilityId: AegisAbilityId,
  unitId: string,
): boolean {
  const unit = squad.find((u) => u.unitId === unitId);
  if (!unit || !isUnitAlive(unit)) return false;
  if (isHookAbility(abilityId)) return false;
  if (isOccultAbility(abilityId)) return false;
  const slot = unit.gridSlot as CombatGridSlotId | undefined;
  if (!slot?.startsWith('BL')) return false;
  return isColumnBlocked(squad, slot);
}

export function isUnitHookValid(
  abilityId: AegisAbilityId | null,
  unit: EnemyCombatProfile,
  isUnitUnmoored?: (unitId: string) => boolean,
): boolean {
  if (!abilityId || !isHookAbility(abilityId)) return false;
  if (!isUnitAlive(unit)) return false;
  if (unit.gridSlot?.startsWith('BL') === true) return true;
  return unit.unitId ? isUnitUnmoored?.(unit.unitId) === true : false;
}

export function validTargetsForAbility(
  squad: EnemyCombatProfile[],
  abilityId: AegisAbilityId | string,
  opts?: TargetEligibilityOpts,
): EnemyCombatProfile[] {
  const mode = abilityTargetMode(abilityId, opts);
  if (mode === 'ALL') return aliveUnits(squad);
  if (mode === 'NONE') return [];
  return aliveUnits(squad).filter((u) =>
    canTargetWithAbility(squad, abilityId, u.unitId!, opts));
}

export function resolveUnitAtGridSlot(
  squad: EnemyCombatProfile[],
  slot: CombatGridSlotId,
): EnemyCombatProfile | undefined {
  return unitAtSlot(squad, slot);
}

export function findLivingWarden(squad: EnemyCombatProfile[]): EnemyCombatProfile | null {
  return aliveUnits(squad).find(
    (u) => u.rosterId === 'warden' && u.gridSlot?.startsWith('FL'),
  ) ?? null;
}

/** Hard redirect — backline single-target kinetic attacks hit a living frontline Warden. */
export function resolveWardenInterceptTarget(
  squad: EnemyCombatProfile[],
  abilityId: AegisAbilityId,
  unitId: string,
): string {
  const mode = abilityTargetMode(abilityId);
  const unit = squad.find((u) => u.unitId === unitId);
  const warden = findLivingWarden(squad);
  if (!warden?.unitId) return unitId;

  if (mode === 'ALL') {
    if (warden.wardenInterceptsAoE && unit?.gridSlot?.startsWith('BL')) {
      return warden.unitId;
    }
    return unitId;
  }

  if (mode !== 'SINGLE') return unitId;
  if (isHookAbility(abilityId) || isOccultAbility(abilityId)) return unitId;

  if (!unit?.gridSlot?.startsWith('BL')) return unitId;

  return warden.unitId;
}

export function isBacklineSlot(slot: CombatGridSlotId): boolean {
  return BACKLINE_SLOTS.includes(slot);
}
