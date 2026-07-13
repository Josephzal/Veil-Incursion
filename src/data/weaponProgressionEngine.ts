import type { ClassType } from '../types/game';
import type { ResourceQuantity } from '../types/resourceItem';
import type {
  ResolvedWeaponState,
  WeaponFamilyId,
  WeaponProgressionState,
  WeaponStatModifiers,
  WeaponTierNumber,
} from '../types/weapon';
import {
  getStarterWeaponForClass,
  getWeaponFamily,
  isWeaponFamilyId,
  listWeaponFamiliesForClass,
  STARTER_WEAPON_BY_CLASS,
  WEAPON_REGISTRY,
} from './weaponRegistry';
import { canAffordCost, deductCostFromStash } from './weaponResourceEngine';

export function createDefaultWeaponProgression(): WeaponProgressionState {
  const weaponUnlocks: WeaponFamilyId[] = [];
  const weaponTiers: Partial<Record<WeaponFamilyId, WeaponTierNumber>> = {};
  const equippedWeaponByClass: Partial<Record<ClassType, WeaponFamilyId>> = {};

  Object.values(STARTER_WEAPON_BY_CLASS).forEach((starterId) => {
    const def = getWeaponFamily(starterId);
    weaponUnlocks.push(starterId);
    weaponTiers[starterId] = 1;
  });

  (Object.keys(STARTER_WEAPON_BY_CLASS) as ClassType[]).forEach((classId) => {
    equippedWeaponByClass[classId] = STARTER_WEAPON_BY_CLASS[classId];
  });

  Object.values(WEAPON_REGISTRY).forEach((def) => {
    if (def.startingUnlocked && !weaponUnlocks.includes(def.id)) {
      weaponUnlocks.push(def.id);
      weaponTiers[def.id] = 1;
    }
  });

  return { weaponUnlocks, weaponTiers, equippedWeaponByClass };
}

export function normalizeWeaponProgression(
  parsed: Partial<WeaponProgressionState> | undefined,
): WeaponProgressionState {
  const defaults = createDefaultWeaponProgression();
  if (!parsed) return defaults;

  const weaponUnlocks = [...defaults.weaponUnlocks];
  parsed.weaponUnlocks?.forEach((id) => {
    if (isWeaponFamilyId(id) && !weaponUnlocks.includes(id)) {
      weaponUnlocks.push(id);
    }
  });

  const weaponTiers: Partial<Record<WeaponFamilyId, WeaponTierNumber>> = {
    ...defaults.weaponTiers,
  };
  Object.entries(parsed.weaponTiers ?? {}).forEach(([id, tier]) => {
    if (!isWeaponFamilyId(id)) return;
    if (tier !== 1 && tier !== 2 && tier !== 3) return;
    weaponTiers[id] = tier;
  });

  const equippedWeaponByClass: Partial<Record<ClassType, WeaponFamilyId>> = {
    ...defaults.equippedWeaponByClass,
  };
  Object.entries(parsed.equippedWeaponByClass ?? {}).forEach(([classId, familyId]) => {
    if (!isWeaponFamilyId(familyId)) return;
    const def = getWeaponFamily(familyId);
    if (def.classId !== classId) return;
    if (!weaponUnlocks.includes(familyId)) return;
    equippedWeaponByClass[classId as ClassType] = familyId;
  });

  (Object.keys(STARTER_WEAPON_BY_CLASS) as ClassType[]).forEach((classId) => {
    const equipped = equippedWeaponByClass[classId];
    if (!equipped || !weaponUnlocks.includes(equipped)) {
      equippedWeaponByClass[classId] = STARTER_WEAPON_BY_CLASS[classId];
    }
  });

  return { weaponUnlocks, weaponTiers, equippedWeaponByClass };
}

export function getEquippedWeaponForClass(
  state: WeaponProgressionState,
  classId: ClassType,
): WeaponFamilyId {
  const equipped = state.equippedWeaponByClass[classId];
  if (equipped && state.weaponUnlocks.includes(equipped)) {
    return equipped;
  }
  return getStarterWeaponForClass(classId);
}

export function getWeaponTier(
  state: WeaponProgressionState,
  familyId: WeaponFamilyId,
): WeaponTierNumber {
  if (!state.weaponUnlocks.includes(familyId)) return 1;
  return state.weaponTiers[familyId] ?? 1;
}

export function mergeWeaponStatModifiers(
  modifiers: readonly WeaponStatModifiers[],
): WeaponStatModifiers {
  const merged: WeaponStatModifiers = {};
  modifiers.forEach((mod) => {
    (Object.keys(mod) as Array<keyof WeaponStatModifiers>).forEach((key) => {
      const value = mod[key];
      if (value == null) return;
      const current = merged[key] ?? 0;
      merged[key] = (current + value) as never;
    });
  });
  return merged;
}

export function resolveWeaponState(
  familyId: WeaponFamilyId,
  tier: WeaponTierNumber,
): ResolvedWeaponState {
  const def = getWeaponFamily(familyId);
  const tierDef = def.tiers[tier - 1];
  const statModifiers = tierDef.statModifiers;
  return {
    familyId,
    tier,
    displayName: tierDef.displayName,
    statModifiers,
    oncePerCombatPassive: tierDef.oncePerCombatPassive,
    passiveBonusPct: tierDef.passiveBonusPct,
    effectSummary: tierDef.effectSummary,
    tags: def.tags,
    classId: def.classId,
  };
}

export function canUnlockWeaponFamily(
  stash: ResourceQuantity,
  state: WeaponProgressionState,
  familyId: WeaponFamilyId,
): boolean {
  if (state.weaponUnlocks.includes(familyId)) return false;
  const def = getWeaponFamily(familyId);
  if (def.startingUnlocked) return true;
  return canAffordCost(stash, def.unlockRequirement);
}

export function canUpgradeWeaponTier(
  stash: ResourceQuantity,
  state: WeaponProgressionState,
  familyId: WeaponFamilyId,
): boolean {
  if (!state.weaponUnlocks.includes(familyId)) return false;
  const currentTier = getWeaponTier(state, familyId);
  if (currentTier >= 3) return false;
  const upgradeCost = getWeaponFamily(familyId).tiers[currentTier - 1].upgradeCost;
  return canAffordCost(stash, upgradeCost);
}

export function unlockWeaponFamily(
  stash: ResourceQuantity,
  state: WeaponProgressionState,
  familyId: WeaponFamilyId,
): { nextStash: ResourceQuantity; nextState: WeaponProgressionState } | null {
  const def = getWeaponFamily(familyId);
  if (state.weaponUnlocks.includes(familyId)) return null;
  if (!def.startingUnlocked) {
    const nextStash = deductCostFromStash(stash, def.unlockRequirement);
    if (!nextStash) return null;
    stash = nextStash;
  }
  return {
    nextStash: stash,
    nextState: {
      ...state,
      weaponUnlocks: [...state.weaponUnlocks, familyId],
      weaponTiers: { ...state.weaponTiers, [familyId]: 1 },
    },
  };
}

export function upgradeWeaponTier(
  stash: ResourceQuantity,
  state: WeaponProgressionState,
  familyId: WeaponFamilyId,
): { nextStash: ResourceQuantity; nextState: WeaponProgressionState } | null {
  const currentTier = getWeaponTier(state, familyId);
  if (currentTier >= 3) return null;
  const upgradeCost = getWeaponFamily(familyId).tiers[currentTier - 1].upgradeCost;
  const nextStash = deductCostFromStash(stash, upgradeCost);
  if (!nextStash) return null;
  const nextTier = (currentTier + 1) as WeaponTierNumber;
  return {
    nextStash,
    nextState: {
      ...state,
      weaponTiers: { ...state.weaponTiers, [familyId]: nextTier },
    },
  };
}

export function equipWeaponForClass(
  state: WeaponProgressionState,
  classId: ClassType,
  familyId: WeaponFamilyId,
): WeaponProgressionState | null {
  const def = getWeaponFamily(familyId);
  if (def.classId !== classId) return null;
  if (!state.weaponUnlocks.includes(familyId)) return null;
  return {
    ...state,
    equippedWeaponByClass: {
      ...state.equippedWeaponByClass,
      [classId]: familyId,
    },
  };
}

export function listLockedWeaponsForClass(classId: ClassType, state: WeaponProgressionState) {
  return listWeaponFamiliesForClass(classId).filter((def) => !state.weaponUnlocks.includes(def.id));
}

export function listUnlockedWeaponsForClass(classId: ClassType, state: WeaponProgressionState) {
  return listWeaponFamiliesForClass(classId).filter((def) => state.weaponUnlocks.includes(def.id));
}

export function unlockAllWeapons(): WeaponProgressionState {
  const weaponUnlocks = [...Object.keys(WEAPON_REGISTRY)] as WeaponFamilyId[];
  const weaponTiers: Partial<Record<WeaponFamilyId, WeaponTierNumber>> = {};
  weaponUnlocks.forEach((id) => {
    weaponTiers[id] = 3;
  });
  return {
    weaponUnlocks,
    weaponTiers,
    equippedWeaponByClass: { ...STARTER_WEAPON_BY_CLASS },
  };
}

export function resetWeaponProgression(): WeaponProgressionState {
  return createDefaultWeaponProgression();
}
