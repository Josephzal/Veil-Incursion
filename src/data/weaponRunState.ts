import type { ActiveIncursionState } from '../types/game';
import type { WeaponFamilyId, WeaponRuntimeState, WeaponTierNumber } from '../types/weapon';
import { createDefaultWeaponProgression, resolveWeaponState } from './weaponProgressionEngine';
import { getStarterWeaponForClass, getWeaponFamily, isWeaponFamilyId } from './weaponRegistry';

export function createDefaultWeaponRuntime(): WeaponRuntimeState {
  return {
    firstMeleeHitUsed: false,
    firstFractureUsed: false,
    firstReloadUsed: false,
    firstOccultAbilityUsed: false,
    firstDebuffApplied: false,
    sacrificeHpBonusUsed: false,
    firstArmoredHitUsed: false,
    postReloadBallisticBonus: false,
    riftEdgeTempoArmed: false,
    claymoreBreakCashoutUsed: false,
    magazineEmptiedThisCombat: false,
  };
}

export function resetWeaponRuntime(runtime: WeaponRuntimeState): WeaponRuntimeState {
  return createDefaultWeaponRuntime();
}

export function resolveClassCompatibleWeaponFamily(
  classId: import('../types/game').ClassType,
  familyId?: WeaponFamilyId | null,
): WeaponFamilyId {
  if (familyId && isWeaponFamilyId(familyId)
    && getWeaponFamily(familyId).classId === classId) {
    return familyId;
  }
  return getStarterWeaponForClass(classId);
}

export function hydrateWeaponIncursionFields<
  T extends Partial<Pick<ActiveIncursionState, 'activeWeaponFamilyId' | 'activeWeaponTier' | 'weaponRuntime'>>,
>(incursion: T, classId: import('../types/game').ClassType): T & Pick<ActiveIncursionState, 'activeWeaponFamilyId' | 'activeWeaponTier' | 'weaponRuntime'> {
  const familyId = resolveClassCompatibleWeaponFamily(classId, incursion.activeWeaponFamilyId);
  const tier = incursion.activeWeaponTier ?? 1;
  return {
    ...incursion,
    activeWeaponFamilyId: familyId,
    activeWeaponTier: tier,
    weaponRuntime: incursion.weaponRuntime ?? createDefaultWeaponRuntime(),
  };
}

export function snapshotWeaponForRun(
  classId: import('../types/game').ClassType,
  progression = createDefaultWeaponProgression(),
): Pick<ActiveIncursionState, 'activeWeaponFamilyId' | 'activeWeaponTier' | 'weaponRuntime'> {
  const equipped = progression.equippedWeaponByClass[classId]
    ?? progression.equippedWeaponByClass[classId]
    ?? getStarterWeaponForClass(classId);
  const familyId = equipped;
  const tier = progression.weaponTiers[familyId] ?? 1;
  return {
    activeWeaponFamilyId: familyId,
    activeWeaponTier: tier as WeaponTierNumber,
    weaponRuntime: createDefaultWeaponRuntime(),
  };
}

export function resolveActiveWeaponState(incursion: ActiveIncursionState) {
  const familyId = resolveClassCompatibleWeaponFamily(
    incursion.activeClass ?? 'AEGIS',
    incursion.activeWeaponFamilyId,
  );
  const tier = incursion.activeWeaponTier ?? 1;
  return resolveWeaponState(familyId, tier);
}

export function weaponFamilyDisplayName(familyId: WeaponFamilyId, tier: WeaponTierNumber): string {
  return resolveWeaponState(familyId, tier).displayName;
}
