/**
 * Envoy E.3 combat surface + historical action compatibility.
 * Pure derivation — never mutates inputs; never persists weapon actions.
 */
import type { EnvoyFlexLoadout } from '../types/operativeClass';
import type { EnvoyWeaponActionId } from '../types/envoyWeaponAction';
import { DEFAULT_ENVOY_FLEX_LOADOUT } from '../types/operativeClass';
import { sanitizeEnvoyFlexLoadout } from './envoyFlexLoadoutEngine';
import {
  getEnvoyWeaponActionSet,
  isEnvoyWeaponActionId,
  isEnvoyWeaponActionLiveExecutable,
  isEnvoyWeaponFamilyId,
  requireEnvoyWeaponActions,
  type EnvoyWeaponFamilyId,
} from './envoyWeaponActionRegistry';
import type { WeaponFamilyId } from '../types/weapon';
import {
  isEnvoyCompatibilityOnlyId,
  isEnvoyHistoricalAnchorId,
} from './envoyActionAliases';

export { isEnvoyCompatibilityOnlyId, isEnvoyHistoricalAnchorId };

/**
 * Canonicalize a historical Envoy combat-action ingress ID for the equipped family.
 * Flex aliases are handled by sanitizeEnvoyFlexLoadout / migrateEnvoyAbilityId — not here.
 */
export function canonicalizeEnvoyCombatActionId(
  rawId: string,
  equippedFamilyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined,
): {
  canonicalId: string;
  historicalSourceId: string | null;
  kind: 'WEAPON_ACTION' | 'FLEX' | 'ULTIMATE_COMPAT' | 'UNKNOWN';
} {
  const historicalSourceId = rawId;
  if (rawId === 'BLACK_WICK') {
    return { canonicalId: 'GRAVEWEAVE', historicalSourceId, kind: 'WEAPON_ACTION' };
  }
  if (rawId === 'VEIL_SPLINTER') {
    if (!isEnvoyWeaponFamilyId(equippedFamilyId)) {
      return { canonicalId: 'GRAVEWEAVE', historicalSourceId, kind: 'WEAPON_ACTION' };
    }
    const action1 = requireEnvoyWeaponActions(equippedFamilyId)[0];
    return { canonicalId: action1, historicalSourceId, kind: 'WEAPON_ACTION' };
  }
  if (rawId === 'CATACLYSM_SIGIL') {
    return { canonicalId: 'NULL_CIRCUIT', historicalSourceId, kind: 'ULTIMATE_COMPAT' };
  }
  if (isEnvoyWeaponActionId(rawId)) {
    return { canonicalId: rawId, historicalSourceId: null, kind: 'WEAPON_ACTION' };
  }
  return { canonicalId: rawId, historicalSourceId: null, kind: 'FLEX' };
}

/** Action-1 of the equipped family (throws if family unknown). */
export function resolveEnvoyActionOneId(
  equippedFamilyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined,
): EnvoyWeaponActionId {
  return requireEnvoyWeaponActions(equippedFamilyId)[0];
}

export type EnvoyCombatSurfaceMode = 'WEAPON_KIT';

export interface EnvoyCombatSurface {
  familyId: EnvoyWeaponFamilyId | null;
  mode: EnvoyCombatSurfaceMode;
  weaponActions: readonly EnvoyWeaponActionId[];
  flex: EnvoyFlexLoadout;
  /**
   * Flat structural order: 4 WA + 3 flex when family resolves.
   * E.5 — live Hub / Sanctuary strip source.
   */
  hudCards: readonly string[];
  weaponActionCount: number;
  flexCount: number;
  /** Player-facing + executable weapon-action IDs (all twelve post-E.5). */
  liveExecutableIds: readonly string[];
}

/**
 * Build the derived Envoy 4+3 strip for an equipped family.
 * Unknown/missing family throws via require when forceComplete; soft path returns null family.
 * Never inserts VEIL_SPLINTER as a card. Never mutates inputs.
 */
export function buildEnvoyCombatSurface(args: {
  weaponFamilyId: WeaponFamilyId | EnvoyWeaponFamilyId | null | undefined;
  flex: EnvoyFlexLoadout | readonly string[] | null | undefined;
}): EnvoyCombatSurface {
  const flex = sanitizeEnvoyFlexLoadout(args.flex ?? DEFAULT_ENVOY_FLEX_LOADOUT);

  if (!isEnvoyWeaponFamilyId(args.weaponFamilyId)) {
    throw new Error(
      `[ENVOY E.3] Cannot derive 4+3 surface for unknown Envoy family: ${String(args.weaponFamilyId)}`,
    );
  }

  const set = getEnvoyWeaponActionSet(args.weaponFamilyId)!;
  const actions = requireEnvoyWeaponActions(args.weaponFamilyId);
  const liveExecutableIds = actions.filter((id) =>
    isEnvoyWeaponActionLiveExecutable(args.weaponFamilyId, id),
  );

  return {
    familyId: set.familyId,
    mode: 'WEAPON_KIT',
    weaponActions: actions,
    flex,
    hudCards: [...actions, ...flex],
    weaponActionCount: 4,
    flexCount: 3,
    liveExecutableIds,
  };
}

export function isEnvoyCombatSurfaceComplete(surface: EnvoyCombatSurface): boolean {
  return surface.familyId != null
    && surface.mode === 'WEAPON_KIT'
    && surface.weaponActionCount === 4
    && surface.flexCount === 3
    && surface.weaponActions.length === 4
    && surface.hudCards.length === 7
    && new Set(surface.hudCards).size === 7
    && !surface.hudCards.includes('VEIL_SPLINTER')
    && !surface.hudCards.includes('RIFT_WARD')
    && !surface.hudCards.includes('CATACLYSM_SIGIL');
}

/**
 * Internal validation — Actions 2–4 must report executor unavailable / not live.
 */
export function assertEnvoyActionNotLiveExecutable(
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId,
  actionId: string,
): void {
  if (isEnvoyWeaponActionLiveExecutable(familyId, actionId)) {
    throw new Error(`[ENVOY E.3] Unexpected live-executable action: ${actionId}`);
  }
}
