/**
 * Envoy weapon actions — always derived from equipped family.
 * Never persist these IDs on PlayerAccount or ActiveIncursion flex selections.
 *
 * E.3 — total family authority. All registered Envoy families are kit-complete.
 * Incomplete-family fallback is forbidden.
 */
import type { EnvoyWeaponActionId } from '../types/envoyWeaponAction';
import {
  ENVOY_EXECUTABLE_WEAPON_ACTION_IDS,
  ENVOY_HEARTS_DUE_WEAPON_ACTIONS,
  ENVOY_SCYTHE_WEAPON_ACTIONS,
  ENVOY_VAMBRACE_WEAPON_ACTIONS,
} from '../types/envoyWeaponAction';
import type { WeaponFamilyId } from '../types/weapon';

export type EnvoyWeaponFamilyId =
  | 'envoy-vambrace'
  | 'envoy-scythe'
  | 'envoy-sanguine-prism';

export interface EnvoyWeaponActionSet {
  familyId: EnvoyWeaponFamilyId;
  /** Live registry display name. */
  displayName: string;
  actions: readonly [
    EnvoyWeaponActionId,
    EnvoyWeaponActionId,
    EnvoyWeaponActionId,
    EnvoyWeaponActionId,
  ];
  /**
   * Validation metadata — all registered families must be true after E.3.
   * Does not select an alternate combat surface or imply Actions 2–4 are executable.
   */
  kitComplete: true;
}

const ENVOY_WEAPON_ACTION_BY_FAMILY: Record<EnvoyWeaponFamilyId, EnvoyWeaponActionSet> = {
  'envoy-vambrace': {
    familyId: 'envoy-vambrace',
    displayName: 'Vambrace',
    actions: ENVOY_VAMBRACE_WEAPON_ACTIONS,
    kitComplete: true,
  },
  'envoy-scythe': {
    familyId: 'envoy-scythe',
    displayName: 'Scythe',
    actions: ENVOY_SCYTHE_WEAPON_ACTIONS,
    kitComplete: true,
  },
  'envoy-sanguine-prism': {
    familyId: 'envoy-sanguine-prism',
    displayName: 'Sanguine Prism',
    actions: ENVOY_HEARTS_DUE_WEAPON_ACTIONS,
    kitComplete: true,
  },
};

export const ALL_ENVOY_WEAPON_FAMILY_IDS: readonly EnvoyWeaponFamilyId[] = [
  'envoy-vambrace',
  'envoy-scythe',
  'envoy-sanguine-prism',
];

Object.freeze(ALL_ENVOY_WEAPON_FAMILY_IDS);
Object.freeze(ENVOY_VAMBRACE_WEAPON_ACTIONS);
Object.freeze(ENVOY_SCYTHE_WEAPON_ACTIONS);
Object.freeze(ENVOY_HEARTS_DUE_WEAPON_ACTIONS);
for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
  Object.freeze(ENVOY_WEAPON_ACTION_BY_FAMILY[familyId]);
  Object.freeze(ENVOY_WEAPON_ACTION_BY_FAMILY[familyId].actions);
}
Object.freeze(ENVOY_WEAPON_ACTION_BY_FAMILY);

export function isEnvoyWeaponFamilyId(
  id: string | null | undefined,
): id is EnvoyWeaponFamilyId {
  return id === 'envoy-vambrace'
    || id === 'envoy-scythe'
    || id === 'envoy-sanguine-prism';
}

export function getEnvoyWeaponActionSet(
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined,
): EnvoyWeaponActionSet | null {
  if (!isEnvoyWeaponFamilyId(familyId)) return null;
  return ENVOY_WEAPON_ACTION_BY_FAMILY[familyId];
}

export function isEnvoyWeaponKitComplete(
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined,
): boolean {
  const set = getEnvoyWeaponActionSet(familyId);
  return set != null && set.kitComplete === true;
}

export function deriveEnvoyWeaponActions(
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined,
): readonly [
  EnvoyWeaponActionId,
  EnvoyWeaponActionId,
  EnvoyWeaponActionId,
  EnvoyWeaponActionId,
] | null {
  return getEnvoyWeaponActionSet(familyId)?.actions ?? null;
}

/**
 * Require a registered Envoy family with four catalog-defined actions.
 * Throws on missing/incomplete mappings — never falls back to a legacy basic.
 */
export function requireEnvoyWeaponActions(
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined,
): readonly [
  EnvoyWeaponActionId,
  EnvoyWeaponActionId,
  EnvoyWeaponActionId,
  EnvoyWeaponActionId,
] {
  if (!isEnvoyWeaponFamilyId(familyId)) {
    throw new Error(`[ENVOY E.3] Unknown or missing Envoy weapon family: ${String(familyId)}`);
  }
  const set = ENVOY_WEAPON_ACTION_BY_FAMILY[familyId];
  if (!set.kitComplete) {
    throw new Error(`[ENVOY E.3] Registered family not kit-complete: ${familyId}`);
  }
  if (set.actions.length !== 4) {
    throw new Error(`[ENVOY E.3] Family ${familyId} must derive exactly 4 weapon actions.`);
  }
  return set.actions;
}

/** Registry-wide structural invariant — all three families resolve four actions. */
export function assertEnvoyWeaponFamilyRegistryInvariant(): void {
  for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
    requireEnvoyWeaponActions(familyId);
  }
}

export function isEnvoyWeaponActionId(id: string): id is EnvoyWeaponActionId {
  for (const familyId of ALL_ENVOY_WEAPON_FAMILY_IDS) {
    if ((ENVOY_WEAPON_ACTION_BY_FAMILY[familyId].actions as readonly string[]).includes(id)) {
      return true;
    }
  }
  return false;
}

/**
 * Belongs to the equipped family's four WAs.
 * Does NOT mean the action is live-executable (Actions 2–4 await E.4).
 */
export function isEnvoyWeaponActionOnEquippedFamily(
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined,
  actionId: string,
): boolean {
  if (!isEnvoyWeaponFamilyId(familyId)) return false;
  try {
    const actions = requireEnvoyWeaponActions(familyId);
    return (actions as readonly string[]).includes(actionId);
  } catch {
    return false;
  }
}

/**
 * E.4 engine-internal executable gate: all twelve WA on the equipped family.
 * Does not imply player-facing Hub/Sanctuary 4+3 presentation (E.5).
 */
export function isEnvoyWeaponActionLiveExecutable(
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined,
  actionId: string,
): boolean {
  if (!isEnvoyWeaponActionOnEquippedFamily(familyId, actionId)) return false;
  return (ENVOY_EXECUTABLE_WEAPON_ACTION_IDS as readonly string[]).includes(actionId);
}

/** Player-facing deck still uses Action 1 + flex projection until E.5. */
/**
 * E.5 — all twelve canonical weapon actions are player-facing on their equipped family.
 * Distinct from internal executability only for architecture clarity (both true post-E.5).
 */
export function isEnvoyWeaponActionPlayerFacingLive(
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined,
  actionId: string,
): boolean {
  return isEnvoyWeaponActionLiveExecutable(familyId, actionId);
}

export function getEnvoyWeaponActionOrderIndex(
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined,
  actionId: string,
): number {
  if (!isEnvoyWeaponFamilyId(familyId)) return -1;
  const actions = deriveEnvoyWeaponActions(familyId);
  if (!actions) return -1;
  return (actions as readonly string[]).indexOf(actionId);
}
