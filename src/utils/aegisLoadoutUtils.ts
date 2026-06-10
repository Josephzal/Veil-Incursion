import {
  ALL_AEGIS_ABILITIES,
  DEFAULT_AEGIS_LOADOUT,
  type AegisAbilityId,
  type AegisLoadout,
} from '../types/aegisCombat';

type AssignableAegisAbilityId = Exclude<AegisAbilityId, 'EVISCERATE'>;

const LOADOUT_POOL = new Set<AssignableAegisAbilityId>(
  ALL_AEGIS_ABILITIES.filter((id): id is AssignableAegisAbilityId => id !== 'EVISCERATE'),
);

function isAssignableAbility(id: unknown): id is AssignableAegisAbilityId {
  return typeof id === 'string' && LOADOUT_POOL.has(id as AssignableAegisAbilityId);
}

export function normalizeAegisLoadout(input: unknown): AegisLoadout {
  if (!Array.isArray(input) || input.length !== 4) {
    return [...DEFAULT_AEGIS_LOADOUT];
  }
  const slots = input.map((id) => (isAssignableAbility(id) ? id : null));
  if (slots.some((id) => id == null)) return [...DEFAULT_AEGIS_LOADOUT];
  return [
    slots[0]!,
    slots[1]!,
    slots[2]!,
    slots[3]!,
  ];
}

export function hasDuplicateLoadoutSlots(loadout: readonly AegisAbilityId[]): boolean {
  return new Set(loadout).size < loadout.length;
}

export function validateLoadoutCommit(loadout: readonly AegisAbilityId[]): string | null {
  if (loadout.length !== 4) return '>> LOADOUT REJECTED — FOUR SLOTS REQUIRED.';
  if (loadout.some((id) => id === 'EVISCERATE')) {
    return '>> LOADOUT REJECTED — EVISCERATE IS A HIDDEN ULTIMATE.';
  }
  if (hasDuplicateLoadoutSlots(loadout)) {
    return '>> LOADOUT REJECTED — DUPLICATE ABILITY SLOTS DETECTED.';
  }
  if (loadout.some((id) => !isAssignableAbility(id))) {
    return '>> LOADOUT REJECTED — UNKNOWN ABILITY IN SLOT.';
  }
  return null;
}
