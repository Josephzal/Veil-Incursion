/**
 * Phase 3J — graft capacity on the live class-rank progression axis (ranks 1–20).
 * Permanent field: ProgressionProfile.classes[classId].rank (+ unlockedGraftLicenses hooks).
 */
import { CLASS_RANK_MAX } from '../classRankEngine';

export type GraftSocketAccess = {
  capacity: number;
  allowFixedBasic: boolean;
  allowUltimate: boolean;
  allowApexMasterwork: boolean;
  requiredLicenseHooks: readonly string[];
};

/** Approved capacity table — live and authoritative. */
export function getGraftSocketAccessForClassRank(rank: number): GraftSocketAccess {
  const r = Math.max(1, Math.min(CLASS_RANK_MAX, Math.floor(rank)));
  if (r <= 2) {
    return {
      capacity: 0,
      allowFixedBasic: false,
      allowUltimate: false,
      allowApexMasterwork: false,
      requiredLicenseHooks: [],
    };
  }
  if (r < 7) {
    return {
      capacity: 1,
      allowFixedBasic: false,
      allowUltimate: false,
      allowApexMasterwork: false,
      requiredLicenseHooks: ['hook.graft.basic'],
    };
  }
  if (r < 12) {
    return {
      capacity: 2,
      allowFixedBasic: true,
      allowUltimate: false,
      allowApexMasterwork: false,
      requiredLicenseHooks: ['hook.graft.basic', 'hook.graft.advanced'],
    };
  }
  if (r < 15) {
    return {
      capacity: 3,
      allowFixedBasic: true,
      allowUltimate: false,
      allowApexMasterwork: false,
      requiredLicenseHooks: ['hook.graft.basic', 'hook.graft.advanced', 'hook.graft.capacity_3'],
    };
  }
  if (r < 17) {
    return {
      capacity: 3,
      allowFixedBasic: true,
      allowUltimate: true,
      allowApexMasterwork: false,
      requiredLicenseHooks: [
        'hook.graft.basic',
        'hook.graft.advanced',
        'hook.graft.capacity_3',
        'hook.graft.ultimate',
      ],
    };
  }
  if (r < 20) {
    return {
      capacity: 4,
      allowFixedBasic: true,
      allowUltimate: true,
      allowApexMasterwork: false,
      requiredLicenseHooks: [
        'hook.graft.basic',
        'hook.graft.advanced',
        'hook.graft.capacity_3',
        'hook.graft.ultimate',
        'hook.graft.capacity_4',
      ],
    };
  }
  return {
    capacity: 4,
    allowFixedBasic: true,
    allowUltimate: true,
    allowApexMasterwork: true,
    requiredLicenseHooks: [
      'hook.graft.basic',
      'hook.graft.advanced',
      'hook.graft.capacity_3',
      'hook.graft.ultimate',
      'hook.graft.capacity_4',
      'hook.graft.apex_masterwork',
    ],
  };
}

export function describeGraftCapacityProgression(): string[] {
  return [
    'Rank 1–2: capacity 0',
    'Rank 3: capacity 1 (basic graft license)',
    'Rank 7: capacity 2 + fixed-basic/signature grafting',
    'Rank 12: capacity 3',
    'Rank 15: capacity 3 + ultimate grafting',
    'Rank 17: capacity 4',
    'Rank 20: capacity 4 + Apex/Masterwork access',
    `CLASS_RANK_MAX=${CLASS_RANK_MAX}`,
  ];
}

export type LiveGraftCostTier = 'STANDARD' | 'ADVANCED' | 'SPONSOR' | 'APEX' | 'MASTERWORK';

export function inferGraftCostTier(cost: number): LiveGraftCostTier {
  if (cost >= 45) return 'APEX';
  if (cost >= 35) return 'ADVANCED';
  if (cost >= 25) return 'ADVANCED';
  return 'STANDARD';
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
