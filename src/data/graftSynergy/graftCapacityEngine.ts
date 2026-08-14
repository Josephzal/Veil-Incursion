/**
 * Stage II-B — run-scoped graft socket access.
 * Capacity follows Core Loop Depth 1/2/3 (= ActiveIncursionState.currentDistrict),
 * not Class Rank. Universal upgrades target registered actions directly.
 */
import { getDistrictFromDepth, type DistrictId } from '../districtPacing';

export type GraftSocketAccess = {
  capacity: number;
  /** @deprecated Compatibility field; universal upgrades have no basic-action gate. */
  allowFixedBasic: boolean;
  /** @deprecated Compatibility field; universal upgrades have no ultimate tier. */
  allowUltimate: boolean;
  /** @deprecated Compatibility field; universal upgrades have no premium tier. */
  allowApexMasterwork: boolean;
  /** @deprecated Compatibility field; Class Rank never gates universal upgrades. */
  requiredLicenseHooks: readonly string[];
};

/** Hard cap — Core Loop Depth 3. */
export const MAX_RUN_GRAFT_CAPACITY = 3;

/**
 * Canonical graft-capacity depth band.
 * Prefer `ActiveIncursionState.currentDistrict` (1–3). Falls back to deriving
 * district from player-facing `currentDepth` (1–45) when needed.
 */
export function resolveRunGraftDepthBand(input: {
  currentDistrict?: number | null;
  currentDepth?: number | null;
}): DistrictId {
  const district = input.currentDistrict;
  if (district === 1 || district === 2 || district === 3) return district;
  return getDistrictFromDepth(input.currentDepth ?? 1);
}

/**
 * Launch capacity policy: Depth 1 → 1, Depth 2 → 2, Depth 3 → 3 (capped).
 * Does not read Class Rank, XP, Clearance, currency, or weapon tier.
 */
export function getGraftCapacityForRunDepth(depthBand: number): number {
  const band = Math.min(MAX_RUN_GRAFT_CAPACITY, Math.max(1, Math.floor(depthBand) || 1));
  return Math.min(MAX_RUN_GRAFT_CAPACITY, band);
}

/** Capacity for the current run depth band. Deprecated fields are neutral. */
export function getGraftSocketAccessForRunDepth(depthBand: number): GraftSocketAccess {
  return {
    capacity: getGraftCapacityForRunDepth(depthBand),
    allowFixedBasic: true,
    allowUltimate: false,
    allowApexMasterwork: false,
    requiredLicenseHooks: [],
  };
}

export function describeGraftCapacityProgression(): string[] {
  return [
    'Depth 1 (district 1): capacity 1',
    'Depth 2 (district 2): capacity 2',
    'Depth 3 (district 3): capacity 3 (hard cap)',
    'Class Rank does not grant action-upgrade capacity or access',
    `MAX_RUN_GRAFT_CAPACITY=${MAX_RUN_GRAFT_CAPACITY}`,
  ];
}

/**
 * @deprecated Stage II-B — Class Rank no longer grants graft power.
 * Prefer getGraftSocketAccessForRunDepth. This alias ignores rank and returns
 * Depth-1 access so accidental callers cannot unlock power from career history.
 */
export function getGraftSocketAccessForClassRank(_rank: number): GraftSocketAccess {
  return getGraftSocketAccessForRunDepth(1);
}

/** @deprecated Universal upgrades have no cost tiers. */
export type LiveGraftCostTier = null;

/** @deprecated Universal upgrades have no cost tiers. */
export function inferGraftCostTier(_cost: number): LiveGraftCostTier {
  return null;
}

export type GraftSocketCategory =
  | 'STANDARD_ABILITY'
  | 'FIXED_BASIC_SIGNATURE'
  | 'ULTIMATE'
  | 'SPONSOR_RESTRICTED'
  | 'RELOAD_INTRINSIC';

export function classifyAbilitySocket(
  classId: 'AEGIS' | 'HEX_SHOT' | 'ENVOY',
  abilityId: string,
): GraftSocketCategory {
  if (classId === 'AEGIS') {
    // Strip encoded WA:/TECH: prefixes for socket classification.
    const bare = abilityId.startsWith('WA:') || abilityId.startsWith('TECH:')
      ? abilityId.slice(abilityId.indexOf(':') + 1)
      : abilityId;
    // Family Strike fixed-basics (Phase D) — never a generic STRIKE graft target.
    if (
      bare === 'WARDENS_STRIKE'
      || bare === 'PAIRED_BLADES_STRIKE'
      || bare === 'UNMAKER_STRIKE'
    ) {
      return 'FIXED_BASIC_SIGNATURE';
    }
    // Legacy generic STRIKE is not a live graftable socket.
    if (bare === 'STRIKE') return 'FIXED_BASIC_SIGNATURE';
    if (
      bare === 'EVISCERATE'
      || bare === 'WRAITH_PARRY'
      || bare === 'ABYSSAL_VERDICT'
      || bare === 'REND_THE_VEIL'
      || bare === 'GRAVEFALL'
    ) {
      return 'ULTIMATE';
    }
    // THREEFOLD_BRAND is retired — not a live Ultimate classification.
    return 'STANDARD_ABILITY';
  }
  if (classId === 'HEX_SHOT') {
    // W.2–W.4 — live fixed-basics; SILVER_CORE_SIDEARM remains the legacy signature.
    if (
      abilityId === 'SILVER_CORE_SIDEARM'
      || abilityId === 'QUICKDRAW'
      || abilityId === 'CENTER_MASS'
      || abilityId === 'DOOR_KNOCKER'
    ) {
      return 'FIXED_BASIC_SIGNATURE';
    }
    if (
      abilityId === 'ZERO_PROTOCOL'
      || abilityId === 'SIXTH_SEAL'
      || abilityId === 'LAST_KNOCK'
    ) {
      return 'ULTIMATE';
    }
    if (abilityId === 'PHASE_SHIFT_RELOAD') return 'RELOAD_INTRINSIC';
    return 'STANDARD_ABILITY';
  }
  if (abilityId === 'VEIL_SPLINTER') return 'FIXED_BASIC_SIGNATURE';
  if (
    abilityId === 'CATACLYSM_SIGIL'
    || abilityId === 'RIFT_WARD'
    || abilityId === 'NULL_CIRCUIT'
    || abilityId === 'FUNERAL_KNOT'
    || abilityId === 'CRIMSON_REFRACTION'
  ) {
    return 'ULTIMATE';
  }
  return 'STANDARD_ABILITY';
}
