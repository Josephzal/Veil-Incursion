/**
 * Hex Shot Phase H.1a — chassis authority normalization helpers.
 *
 * Pure/data-only: naming canon, retired Chamber contract, Sixth Seal ultimate-owned
 * refill semantics. Combat hub applies these contracts; this module is the testable
 * authority surface for H.1a regressions.
 */
import type { HexShotCombatState } from '../types/hexShotState';
import { createDefaultClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnemyCombatProfile } from '../types/run';
import {
  HEX_MAGAZINE_CONFIG,
  type HexAmmoType,
  type ReloadQuality,
} from '../types/hexAmmo';
import { hexShotReducer } from '../reducers/hexShotReducer';
import { getWeaponFamily } from './weaponRegistry';
import { getWeaponIdentityProfile } from './weaponIdentityProfiles';
import { getWeaponAnchorAttack, RETIRED_WEAPON_DISPLAY_NAMES } from './weaponAnchorAttackRegistry';
import { getWeaponUltimate } from './weaponUltimateRegistry';
import type { WeaponFamilyId } from '../types/weapon';

/** Canonical player-facing Hex weapon display names (H.1a). */
export const HEX_H1A_CANONICAL_DISPLAY_NAMES = {
  'hex-silver-core-sidearm': 'Silver-Core Sidearm',
  'hex-void-cannon': 'Nullbreach',
  'hex-pulse-rifle': 'Ash Shotgun',
} as const satisfies Record<
  'hex-silver-core-sidearm' | 'hex-void-cannon' | 'hex-pulse-rifle',
  string
>;

/** Legacy presentation aliases — may be accepted as input, never emitted live. */
export const HEX_H1A_LEGACY_PRESENTATION_ALIASES = [
  'Revolver',
  'Black Door',
  'Carbine',
] as const;

/** Retired class-wide Chamber damage layer (was ×1.15). H.1a authority = 1.0 (no-op). */
export const HEX_LEGACY_CHAMBER_DAMAGE_MULT = 1.0;

/**
 * Sixth Seal resolution order after successful commitment validation.
 * Protocol spend is atomic and precedes ultimate-owned refill / shots.
 */
export const SIXTH_SEAL_COMMIT_STEPS = [
  'VALIDATE_TARGET',
  'SPEND_PROTOCOL',
  'ULTIMATE_OWNED_REFILL',
  'PRECISION_SHOTS',
  'EMPTY_MAGAZINE',
] as const;

export type SixthSealCommitStep = (typeof SIXTH_SEAL_COMMIT_STEPS)[number];

export function getHexCanonicalDisplayName(
  familyId: keyof typeof HEX_H1A_CANONICAL_DISPLAY_NAMES,
): string {
  return HEX_H1A_CANONICAL_DISPLAY_NAMES[familyId];
}

/** True when text is exactly a retired Hex presentation alias (not a substring of a live name). */
export function isHexLegacyPresentationAlias(text: string): boolean {
  return (HEX_H1A_LEGACY_PRESENTATION_ALIASES as readonly string[]).includes(text);
}

/**
 * Class-wide Chamber +15% is retired. Always returns damage unchanged.
 * `chamberBonusReady` must be sanitized to false by callers; this never applies a mult.
 */
export function applyRetiredClassWideChamberBonus(
  damage: number,
  _chamberBonusReady = false,
): { damage: number; applied: boolean; multiplier: number } {
  return {
    damage,
    applied: false,
    multiplier: HEX_LEGACY_CHAMBER_DAMAGE_MULT,
  };
}

export function resolveOrdinaryReload(
  state: HexShotCombatState,
  quality: ReloadQuality,
  ammoType: HexAmmoType,
  deadMansSwitchBlocksOvercharge = false,
): HexShotCombatState {
  return hexShotReducer(state, {
    type: 'HEX_RESOLVE_RELOAD',
    quality,
    ammoType,
    encounter: createDefaultClassCombatEncounterState(),
    squad: [] as EnemyCombatProfile[],
    deadMansSwitchBlocksOvercharge,
  });
}

/**
 * Ultimate-owned magazine refill (Sixth Seal). Refills ammo only —
 * no Protocol, Overcharge, fail penalty, or calibrated push.
 */
export function resolveUltimateOwnedMagazineRefill(
  state: HexShotCombatState,
): HexShotCombatState {
  return hexShotReducer(state, { type: 'HEX_ULTIMATE_OWNED_MAGAZINE_REFILL' });
}

export function spendProtocolCharges(state: HexShotCombatState): HexShotCombatState {
  return hexShotReducer(state, {
    type: 'HEX_EXECUTE_ZERO_PROTOCOL',
    encounter: createDefaultClassCombatEncounterState(),
    squad: [] as EnemyCombatProfile[],
  });
}

export function protocolReadyForWeaponUltimate(state: HexShotCombatState): boolean {
  return state.protocolCharges >= state.maxProtocolCharges
    && state.maxProtocolCharges === HEX_MAGAZINE_CONFIG.maxProtocolCharges;
}

/**
 * Simulate Sixth Seal protocol + ultimate-owned refill after target validation.
 * Does not invoke ordinary Active Reload reward hooks.
 */
export function simulateSixthSealProtocolAndOwnedRefill(
  state: HexShotCombatState,
): {
  afterSpend: HexShotCombatState;
  afterRefill: HexShotCombatState;
  protocolSpent: number;
  protocolGainedFromRefill: number;
  overchargeArmedByRefill: boolean;
  failPenaltyArmedByRefill: boolean;
} {
  const beforeProtocol = state.protocolCharges;
  const afterSpend = spendProtocolCharges(state);
  const protocolSpent = beforeProtocol - afterSpend.protocolCharges;
  const afterRefill = resolveUltimateOwnedMagazineRefill(afterSpend);
  return {
    afterSpend,
    afterRefill,
    protocolSpent,
    protocolGainedFromRefill: afterRefill.protocolCharges - afterSpend.protocolCharges,
    overchargeArmedByRefill: afterRefill.nextShotOvercharged && !afterSpend.nextShotOvercharged,
    failPenaltyArmedByRefill: afterRefill.firstShotPenaltyPending && !afterSpend.firstShotPenaltyPending,
  };
}

export function assertHexDisplaySurfacesCanonical(familyId: WeaponFamilyId): string[] {
  const expected = HEX_H1A_CANONICAL_DISPLAY_NAMES[
    familyId as keyof typeof HEX_H1A_CANONICAL_DISPLAY_NAMES
  ];
  if (!expected) return [];
  const issues: string[] = [];
  const def = getWeaponFamily(familyId);
  const identity = getWeaponIdentityProfile(familyId);
  const anchor = getWeaponAnchorAttack(familyId);
  const ultimate = getWeaponUltimate(familyId);
  if (def.name !== expected) issues.push(`registry name ${def.name}`);
  if (identity.liveDisplayName !== expected) issues.push(`identity ${identity.liveDisplayName}`);
  if (anchor.weaponDisplayName !== expected) issues.push(`anchor ${anchor.weaponDisplayName}`);
  if (ultimate.weaponDisplayName !== expected) issues.push(`ultimate ${ultimate.weaponDisplayName}`);
  for (const retired of RETIRED_WEAPON_DISPLAY_NAMES) {
    if (def.name.includes(retired) && def.name !== expected) {
      issues.push(`registry still emits retired ${retired}`);
    }
  }
  for (const alias of HEX_H1A_LEGACY_PRESENTATION_ALIASES) {
    if (def.name === alias || identity.liveDisplayName === alias) {
      issues.push(`live surface still emits alias ${alias}`);
    }
  }
  return issues;
}

/** Perfect Overcharge multiplier as a damage scale (1.20), not additive with Chamber. */
export function perfectOverchargeDamageScale(): number {
  return 1 + HEX_MAGAZINE_CONFIG.overchargedDamagePct / 100;
}

export function failedReloadFirstShotDamageScale(): number {
  return 1 - HEX_MAGAZINE_CONFIG.failedFirstShotDamagePct / 100;
}

/**
 * Multiplier order for ordinary ballistic first shot after a reload grade.
 * Chamber layer is intentionally absent (retired).
 */
export function ordinaryReloadFirstShotMultiplierOrder(
  quality: ReloadQuality,
): { factors: readonly string[]; aggregate: number } {
  if (quality === 'PERFECT') {
    return {
      factors: ['base', 'perfectOvercharge×1.20'],
      aggregate: perfectOverchargeDamageScale(),
    };
  }
  if (quality === 'FAILED') {
    return {
      factors: ['base', 'failedFirstShot×0.90'],
      aggregate: failedReloadFirstShotDamageScale(),
    };
  }
  return { factors: ['base'], aggregate: 1 };
}
