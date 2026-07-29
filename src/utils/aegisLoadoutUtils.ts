import {
  ALL_AEGIS_ABILITIES,
  DEFAULT_AEGIS_LOADOUT,
  type AegisAbilityId,
  type AegisLoadout,
} from '../types/aegisCombat';

/** Fixed weapon-basic slot — same principle as Hex SILVER_CORE_SIDEARM / Envoy VEIL_SPLINTER. */
export const AEGIS_ANCHOR: AegisAbilityId = 'STRIKE';

type AssignableAegisAbilityId = Exclude<AegisAbilityId, 'EVISCERATE' | 'WRAITH_PARRY'>;
/** Flex pool — excludes fixed basic, ultimate, and Void Ward intrinsic. */
type FlexAegisAbilityId = Exclude<AssignableAegisAbilityId, 'STRIKE'>;

const FLEX_POOL = new Set<FlexAegisAbilityId>(
  ALL_AEGIS_ABILITIES.filter((id): id is FlexAegisAbilityId => (
    id !== 'EVISCERATE' && id !== 'WRAITH_PARRY' && id !== AEGIS_ANCHOR
  )),
);

function isFlexAbility(id: unknown): id is FlexAegisAbilityId {
  return typeof id === 'string' && FLEX_POOL.has(id as FlexAegisAbilityId);
}

/**
 * Sanitize Aegis combat loadout: slot 0 is always STRIKE (weapon basic).
 * Valid flex abilities from the prior loadout are preserved in order without duplicates.
 */
export function sanitizeAegisCombatLoadout(loadout: readonly AegisAbilityId[]): AegisLoadout {
  const used = new Set<AegisAbilityId>([AEGIS_ANCHOR]);
  const flex: AegisAbilityId[] = [];
  for (const raw of loadout) {
    if (raw === AEGIS_ANCHOR || raw === 'EVISCERATE' || raw === 'WRAITH_PARRY') continue;
    if (!isFlexAbility(raw) || used.has(raw)) continue;
    used.add(raw);
    flex.push(raw);
    if (flex.length >= 3) break;
  }
  const defaults = DEFAULT_AEGIS_LOADOUT.slice(1) as AegisAbilityId[];
  for (const d of defaults) {
    if (flex.length >= 3) break;
    if (used.has(d) || !isFlexAbility(d)) continue;
    used.add(d);
    flex.push(d);
  }
  for (const d of FLEX_POOL) {
    if (flex.length >= 3) break;
    if (used.has(d)) continue;
    used.add(d);
    flex.push(d);
  }
  return [AEGIS_ANCHOR, flex[0]!, flex[1]!, flex[2]!] as AegisLoadout;
}

export function normalizeAegisLoadout(input: unknown): AegisLoadout {
  if (!Array.isArray(input) || input.length === 0) {
    return [...DEFAULT_AEGIS_LOADOUT];
  }
  const migrated = input.map((id) => {
    if (id === 'WRAITH_PARRY') return null;
    if (typeof id === 'string' && (id === AEGIS_ANCHOR || isFlexAbility(id))) return id as AegisAbilityId;
    return null;
  }).filter((id): id is AegisAbilityId => id != null);
  return sanitizeAegisCombatLoadout(migrated);
}

export function hasDuplicateLoadoutSlots(loadout: readonly AegisAbilityId[]): boolean {
  return new Set(loadout).size < loadout.length;
}

export function validateLoadoutCommit(
  loadout: readonly AegisAbilityId[],
  unlocked?: readonly AegisAbilityId[],
): string | null {
  if (loadout.length !== 4) return '>> LOADOUT REJECTED — FOUR SLOTS REQUIRED.';
  if (loadout[0] !== AEGIS_ANCHOR) {
    return '>> LOADOUT REJECTED — SLOT 1 MUST REMAIN STRIKE (WEAPON BASIC).';
  }
  if (loadout.some((id) => id === 'EVISCERATE' || id === 'WRAITH_PARRY')) {
    return '>> LOADOUT REJECTED — ABILITY RESERVED FOR COMBAT CONTROLS.';
  }
  if (hasDuplicateLoadoutSlots(loadout)) {
    return '>> LOADOUT REJECTED — DUPLICATE ABILITY SLOTS DETECTED.';
  }
  const flex = loadout.slice(1);
  if (flex.some((id) => !isFlexAbility(id))) {
    return '>> LOADOUT REJECTED — UNKNOWN OR NON-FLEX ABILITY IN SLOT.';
  }
  if (unlocked) {
    const locked = flex.find((id) => !unlocked.includes(id) && id !== AEGIS_ANCHOR);
    if (locked) {
      return `>> LOADOUT REJECTED — ${locked.replace(/_/g, ' ')} NOT UNLOCKED.`;
    }
  }
  return null;
}

/** Flex abilities assignable to slots 1–3 (excludes fixed STRIKE). */
export function getAegisFlexAbilities(): FlexAegisAbilityId[] {
  return [...FLEX_POOL];
}
