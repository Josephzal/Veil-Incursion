import type { ActiveIncursionState } from '../types/game';
import type { WeaponFamilyId, WeaponRuntimeState } from '../types/weapon';
import { createDefaultWeaponProgression, resolveWeaponState } from './weaponProgressionEngine';
import { getStarterWeaponForClass, getWeaponFamily, isWeaponFamilyId } from './weaponRegistry';
import { normalizeWeaponFamilyId } from './weaponFamilyIdNormalize';

export function createDefaultWeaponRuntime(): WeaponRuntimeState {
  return {
    riftEdgeTempoArmed: false,
    claymoreBreakCashoutUsed: false,
    magazineEmptiedThisCombat: false,
  };
}

export function resetWeaponRuntime(_runtime?: WeaponRuntimeState): WeaponRuntimeState {
  return createDefaultWeaponRuntime();
}

export function resolveClassCompatibleWeaponFamily(
  classId: import('../types/game').ClassType,
  familyId?: WeaponFamilyId | string | null,
): WeaponFamilyId {
  const normalized = familyId ? normalizeWeaponFamilyId(familyId) : null;
  if (normalized && isWeaponFamilyId(normalized)
    && getWeaponFamily(normalized).classId === classId) {
    return normalized;
  }
  return getStarterWeaponForClass(classId);
}

export function hydrateWeaponIncursionFields<
  T extends Partial<Pick<ActiveIncursionState, 'activeWeaponFamilyId' | 'weaponRuntime'> & {
    activeWeaponTier?: unknown;
  }>,
>(
  incursion: T,
  classId: import('../types/game').ClassType,
): T & Pick<ActiveIncursionState, 'activeWeaponFamilyId' | 'weaponRuntime'> {
  const familyId = resolveClassCompatibleWeaponFamily(classId, incursion.activeWeaponFamilyId);
  const { activeWeaponTier: _retiredTier, ...rest } = incursion as T & {
    activeWeaponTier?: unknown;
  };
  return {
    ...rest,
    activeWeaponFamilyId: familyId,
    weaponRuntime: incursion.weaponRuntime
      ? {
        riftEdgeTempoArmed: Boolean(incursion.weaponRuntime.riftEdgeTempoArmed),
        claymoreBreakCashoutUsed: Boolean(incursion.weaponRuntime.claymoreBreakCashoutUsed),
        magazineEmptiedThisCombat: Boolean(incursion.weaponRuntime.magazineEmptiedThisCombat),
      }
      : createDefaultWeaponRuntime(),
  } as T & Pick<ActiveIncursionState, 'activeWeaponFamilyId' | 'weaponRuntime'>;
}

export function snapshotWeaponForRun(
  classId: import('../types/game').ClassType,
  progression = createDefaultWeaponProgression(),
): Pick<ActiveIncursionState, 'activeWeaponFamilyId' | 'weaponRuntime'> {
  const equipped = progression.equippedWeaponByClass[classId]
    ?? getStarterWeaponForClass(classId);
  const familyId = resolveClassCompatibleWeaponFamily(classId, equipped);
  return {
    activeWeaponFamilyId: familyId,
    weaponRuntime: createDefaultWeaponRuntime(),
  };
}

export function resolveActiveWeaponState(incursion: ActiveIncursionState) {
  const familyId = resolveClassCompatibleWeaponFamily(
    incursion.activeClass ?? 'AEGIS',
    incursion.activeWeaponFamilyId,
  );
  return resolveWeaponState(familyId);
}

export function weaponFamilyDisplayName(familyId: WeaponFamilyId): string {
  return resolveWeaponState(familyId).displayName;
}
