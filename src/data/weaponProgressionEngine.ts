import type { ClassType } from '../types/game';
import type { ResourceQuantity } from '../types/resourceItem';
import type {
  ResolvedWeaponState,
  StoredWeaponProgressionInput,
  WeaponFamilyId,
  WeaponProgressionState,
  WeaponStatModifiers,
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
import {
  normalizeWeaponFamilyId,
  normalizeWeaponFamilyIdList,
} from './weaponFamilyIdNormalize';

export function createDefaultWeaponProgression(): WeaponProgressionState {
  const weaponUnlocks: WeaponFamilyId[] = [];
  const equippedWeaponByClass: Partial<Record<ClassType, WeaponFamilyId>> = {};

  Object.values(STARTER_WEAPON_BY_CLASS).forEach((starterId) => {
    if (!weaponUnlocks.includes(starterId)) weaponUnlocks.push(starterId);
  });

  (Object.keys(STARTER_WEAPON_BY_CLASS) as ClassType[]).forEach((classId) => {
    equippedWeaponByClass[classId] = STARTER_WEAPON_BY_CLASS[classId];
  });

  Object.values(WEAPON_REGISTRY).forEach((def) => {
    if (def.startingUnlocked && !weaponUnlocks.includes(def.id)) {
      weaponUnlocks.push(def.id);
    }
  });

  return { weaponUnlocks, equippedWeaponByClass };
}

/**
 * Normalize stored weapon progression:
 * - Map legacy family IDs → canonical
 * - Collapse duplicate legacy+canonical ownership
 * - Recover valid ownership from retired weaponTiers map keys
 * - Strip weaponTiers from live output
 * - Idempotent
 */
export function normalizeWeaponProgression(
  parsed: StoredWeaponProgressionInput | Partial<WeaponProgressionState> | undefined,
): WeaponProgressionState {
  const defaults = createDefaultWeaponProgression();
  if (!parsed) return defaults;

  const unlockSet = new Set<WeaponFamilyId>(defaults.weaponUnlocks);

  normalizeWeaponFamilyIdList(parsed.weaponUnlocks).forEach((id) => unlockSet.add(id));

  // Tier-map keys may be the only ownership evidence on older saves.
  const storedTiers = (parsed as StoredWeaponProgressionInput).weaponTiers;
  if (storedTiers && typeof storedTiers === 'object') {
    Object.keys(storedTiers).forEach((rawId) => {
      const id = normalizeWeaponFamilyId(rawId);
      if (id) unlockSet.add(id);
    });
  }

  const weaponUnlocks = [...unlockSet];

  const equippedWeaponByClass: Partial<Record<ClassType, WeaponFamilyId>> = {
    ...defaults.equippedWeaponByClass,
  };
  Object.entries(parsed.equippedWeaponByClass ?? {}).forEach(([classId, familyRaw]) => {
    const familyId = normalizeWeaponFamilyId(familyRaw);
    if (!familyId) return;
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

  return { weaponUnlocks, equippedWeaponByClass };
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

/** Resolve the tierless canonical family combat profile. */
export function resolveWeaponState(familyId: WeaponFamilyId): ResolvedWeaponState {
  const def = getWeaponFamily(familyId);
  return {
    familyId,
    displayName: def.name,
    statModifiers: { ...def.baselineStatModifiers },
    effectSummary: def.baselineEffectSummary,
    tags: def.tags,
    classId: def.classId,
  };
}

/**
 * @deprecated Stage II-C — tier argument ignored; use resolveWeaponState(familyId).
 */
export function resolveWeaponStateAtTier(
  familyId: WeaponFamilyId,
  _tier?: 1 | 2 | 3,
): ResolvedWeaponState {
  return resolveWeaponState(familyId);
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

export function unlockWeaponFamily(
  stash: ResourceQuantity,
  state: WeaponProgressionState,
  familyId: WeaponFamilyId,
): { ok: boolean; state: WeaponProgressionState; stash: ResourceQuantity; message: string } {
  if (state.weaponUnlocks.includes(familyId)) {
    return { ok: false, state, stash, message: 'Already unlocked.' };
  }
  const def = getWeaponFamily(familyId);
  if (!def.startingUnlocked && !canAffordCost(stash, def.unlockRequirement)) {
    return { ok: false, state, stash, message: 'Insufficient resources.' };
  }
  const nextStash = def.startingUnlocked
    ? stash
    : (deductCostFromStash(stash, def.unlockRequirement) ?? stash);
  return {
    ok: true,
    stash: nextStash,
    state: {
      weaponUnlocks: [...state.weaponUnlocks, familyId],
      equippedWeaponByClass: { ...state.equippedWeaponByClass },
    },
    message: `${def.name} unlocked.`,
  };
}

/**
 * @deprecated Stage II-C — weapon tier upgrades removed. Always fails closed.
 */
export function canUpgradeWeaponTier(
  _stash: ResourceQuantity,
  _state: WeaponProgressionState,
  _familyId: WeaponFamilyId,
): boolean {
  return false;
}

/**
 * @deprecated Stage II-C — weapon tier upgrades removed. No-op / fail closed.
 */
export function upgradeWeaponTier(
  stash: ResourceQuantity,
  state: WeaponProgressionState,
  _familyId: WeaponFamilyId,
): { ok: boolean; state: WeaponProgressionState; stash: ResourceQuantity; message: string } {
  return {
    ok: false,
    state,
    stash,
    message: 'Weapon tier upgrades have been retired.',
  };
}

export function equipWeaponForClass(
  state: WeaponProgressionState,
  classId: ClassType,
  familyId: WeaponFamilyId,
): { ok: boolean; state: WeaponProgressionState; message: string } {
  if (!state.weaponUnlocks.includes(familyId)) {
    return { ok: false, state, message: 'Weapon locked.' };
  }
  const def = getWeaponFamily(familyId);
  if (def.classId !== classId) {
    return { ok: false, state, message: 'Wrong class.' };
  }
  return {
    ok: true,
    state: {
      ...state,
      equippedWeaponByClass: { ...state.equippedWeaponByClass, [classId]: familyId },
    },
    message: `${def.name} equipped.`,
  };
}

export function listLockedWeaponsForClass(classId: ClassType, state: WeaponProgressionState) {
  return listWeaponFamiliesForClass(classId).filter((d) => !state.weaponUnlocks.includes(d.id));
}

export function listUnlockedWeaponsForClass(classId: ClassType, state: WeaponProgressionState) {
  return listWeaponFamiliesForClass(classId).filter((d) => state.weaponUnlocks.includes(d.id));
}

export function unlockAllWeapons(): WeaponProgressionState {
  const weaponUnlocks = [...ALL_WEAPON_FAMILY_IDS_LOCAL];
  const equippedWeaponByClass: Partial<Record<ClassType, WeaponFamilyId>> = {
    AEGIS: STARTER_WEAPON_BY_CLASS.AEGIS,
    HEX_SHOT: STARTER_WEAPON_BY_CLASS.HEX_SHOT,
    ENVOY: STARTER_WEAPON_BY_CLASS.ENVOY,
  };
  return { weaponUnlocks, equippedWeaponByClass };
}

export function resetWeaponProgression(): WeaponProgressionState {
  return createDefaultWeaponProgression();
}

const ALL_WEAPON_FAMILY_IDS_LOCAL = Object.keys(WEAPON_REGISTRY) as WeaponFamilyId[];

/** @deprecated Stage II-C — tiers removed; always returns 1 for compatibility callers. */
export function getWeaponTier(
  _state: WeaponProgressionState,
  _familyId: WeaponFamilyId,
): 1 {
  return 1;
}

export { isWeaponFamilyId };
