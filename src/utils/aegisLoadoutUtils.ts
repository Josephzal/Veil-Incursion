import {
  ALL_AEGIS_ABILITIES,
  DEFAULT_AEGIS_LOADOUT,
  type AegisAbilityId,
  type AegisLoadout,
} from '../types/aegisCombat';

type AssignableAegisAbilityId = Exclude<AegisAbilityId, 'EVISCERATE' | 'WRAITH_PARRY'>;

const LOADOUT_POOL = new Set<AssignableAegisAbilityId>(
  ALL_AEGIS_ABILITIES.filter((id): id is AssignableAegisAbilityId => (
    id !== 'EVISCERATE' && id !== 'WRAITH_PARRY'
  )),
);

function resolveLoadoutSlotId(id: unknown, slotIndex: number): AssignableAegisAbilityId | null {
  if (id === 'WRAITH_PARRY') return DEFAULT_AEGIS_LOADOUT[slotIndex] as AssignableAegisAbilityId;
  return isAssignableAbility(id) ? id : null;
}

function isAssignableAbility(id: unknown): id is AssignableAegisAbilityId {
  return typeof id === 'string' && LOADOUT_POOL.has(id as AssignableAegisAbilityId);
}

export function normalizeAegisLoadout(input: unknown): AegisLoadout {
  if (!Array.isArray(input) || input.length !== 4) {
    return [...DEFAULT_AEGIS_LOADOUT];
  }
  const slots = input.map((id, index) => resolveLoadoutSlotId(id, index));
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

export function validateLoadoutCommit(
  loadout: readonly AegisAbilityId[],
  unlocked?: readonly AegisAbilityId[],
): string | null {
  if (loadout.length !== 4) return '>> LOADOUT REJECTED — FOUR SLOTS REQUIRED.';
  if (loadout.some((id) => id === 'EVISCERATE' || id === 'WRAITH_PARRY')) {
    return '>> LOADOUT REJECTED — ABILITY RESERVED FOR COMBAT CONTROLS.';
  }
  if (hasDuplicateLoadoutSlots(loadout)) {
    return '>> LOADOUT REJECTED — DUPLICATE ABILITY SLOTS DETECTED.';
  }
  if (loadout.some((id) => !isAssignableAbility(id))) {
    return '>> LOADOUT REJECTED — UNKNOWN ABILITY IN SLOT.';
  }
  if (unlocked) {
    const locked = loadout.find((id) => !unlocked.includes(id));
    if (locked) {
      return `>> LOADOUT REJECTED — ${locked.replace(/_/g, ' ')} NOT UNLOCKED.`;
    }
  }
  return null;
}
