/**
 * Weapon ultimate activation routing helpers (Phase 3M repair).
 * Pure functions — combat HUD must open the interaction before any commit.
 */

import type { WeaponFamilyId } from '../types/weapon';
import {
  getWeaponUltimate,
  type WeaponUltimateId,
} from './weaponUltimateRegistry';

/** Interaction controller kind mounted by the combat minigame host. */
export type WeaponUltimateInteractionControllerKind =
  | 'THREEFOLD_BRAND_SLICE'
  | 'ZERO_PROTOCOL_GRID'
  | 'NULL_CIRCUIT_SIGIL'
  | 'WU4_STAGED';

const CONTROLLER_BY_ULTIMATE: Record<WeaponUltimateId, WeaponUltimateInteractionControllerKind> = {
  THREEFOLD_BRAND: 'THREEFOLD_BRAND_SLICE',
  ZERO_PROTOCOL: 'ZERO_PROTOCOL_GRID',
  NULL_CIRCUIT: 'NULL_CIRCUIT_SIGIL',
  REND_THE_VEIL: 'WU4_STAGED',
  GRAVEFALL: 'WU4_STAGED',
  SIXTH_SEAL: 'WU4_STAGED',
  LAST_KNOCK: 'WU4_STAGED',
  FUNERAL_KNOT: 'WU4_STAGED',
  CRIMSON_REFRACTION: 'WU4_STAGED',
};

export function resolveWeaponUltimateInteractionController(
  weaponFamilyId: WeaponFamilyId | null | undefined,
): WeaponUltimateInteractionControllerKind | null {
  if (!weaponFamilyId) return null;
  const ultimate = getWeaponUltimate(weaponFamilyId);
  if (ultimate.status !== 'WIRED') return null;
  return CONTROLLER_BY_ULTIMATE[ultimate.id] ?? null;
}

export function resolveWeaponUltimateInteractionControllerById(
  ultimateId: WeaponUltimateId | null | undefined,
): WeaponUltimateInteractionControllerKind | null {
  if (!ultimateId) return null;
  return CONTROLLER_BY_ULTIMATE[ultimateId] ?? null;
}

/**
 * Gates CombatMinigameOverlayHost. Staged WU-4 and OFFENSE_SLICE must be included
 * or the interaction popup never mounts after the center ultimate circle is pressed.
 */
export function isWeaponUltimateMinigameHostActive(state: {
  activeReloadVisible?: boolean;
  zeroProtocolVisible?: boolean;
  cataclysmSigilVisible?: boolean;
  catalyticConsoleVisible?: boolean;
  stagedWeaponUltimateId?: WeaponUltimateId | null;
  cycleState?: string | null;
}): boolean {
  return Boolean(
    state.activeReloadVisible
    || state.zeroProtocolVisible
    || state.cataclysmSigilVisible
    || state.catalyticConsoleVisible
    || state.stagedWeaponUltimateId != null
    || state.cycleState === 'OFFENSE_SLICE',
  );
}

/** True when an ultimate interaction is open (blocks conflicting combat commits). */
export function isWeaponUltimateInteractionOpen(state: {
  zeroProtocolVisible?: boolean;
  cataclysmSigilVisible?: boolean;
  stagedWeaponUltimateId?: WeaponUltimateId | null;
  cycleState?: string | null;
}): boolean {
  return Boolean(
    state.zeroProtocolVisible
    || state.cataclysmSigilVisible
    || state.stagedWeaponUltimateId != null
    || state.cycleState === 'OFFENSE_SLICE',
  );
}

export function listWeaponUltimateControllerMappings(): Array<{
  weaponFamilyId: WeaponFamilyId;
  ultimateId: WeaponUltimateId;
  displayName: string;
  controller: WeaponUltimateInteractionControllerKind;
}> {
  const families: WeaponFamilyId[] = [
    'aegis-runed-longsword',
    'aegis-rift-edge',
    'aegis-claymore-blade',
    'hex-silver-core-sidearm',
    'hex-pulse-rifle',
    'hex-void-cannon',
    'envoy-echo-lantern',
    'envoy-null-conduit',
    'envoy-sanguine-prism',
  ];
  return families.map((weaponFamilyId) => {
    const ultimate = getWeaponUltimate(weaponFamilyId);
    return {
      weaponFamilyId,
      ultimateId: ultimate.id,
      displayName: ultimate.displayName,
      controller: CONTROLLER_BY_ULTIMATE[ultimate.id],
    };
  });
}
