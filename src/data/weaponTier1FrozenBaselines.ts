/**
 * Stage II-C — frozen effective Tier I baselines captured from the pre-migration
 * registry before tier rows were deleted. Each canonical family's tierless
 * combat profile MUST equal this mapping.
 *
 * Source: WEAPON_REGISTRY[legacyId].tiers[0].statModifiers (+ family tags/class).
 */
import type { ClassType } from '../types/game';
import type { WeaponStatModifiers, WeaponTag } from '../types/weapon';
import type { CanonicalWeaponFamilyId } from './weaponFamilyIdNormalize';

export type FrozenTier1Baseline = {
  canonicalId: CanonicalWeaponFamilyId;
  legacyId: string;
  classId: ClassType;
  /** Canonical live display name after Stage II-C. */
  displayName: string;
  /** Exact Tier I statModifiers from the legacy family. */
  statModifiers: WeaponStatModifiers;
  /** Tier I effect summary text (baseline only — no T2/T3 passive claims). */
  effectSummary: string;
  tags: readonly WeaponTag[];
};

export const FROZEN_TIER1_BASELINES: Readonly<Record<CanonicalWeaponFamilyId, FrozenTier1Baseline>> = {
  'aegis-longsword': {
    canonicalId: 'aegis-longsword',
    legacyId: 'aegis-runed-longsword',
    classId: 'AEGIS',
    displayName: 'Longsword',
    statModifiers: { aegisTechniquePowerPct: 0 },
    effectSummary: 'Baseline Fracture and Reserve generation.',
    tags: ['MELEE', 'KINETIC', 'BALANCED', 'FRACTURE'],
  },
  'aegis-paired-blades': {
    canonicalId: 'aegis-paired-blades',
    legacyId: 'aegis-rift-edge',
    classId: 'AEGIS',
    displayName: 'Paired Blades',
    statModifiers: {
      strikeDamagePct: -5,
      aegisTechniquePowerPct: -5,
      aegisUltimatePowerPct: -5,
      reserveGainFlat: 3,
      critChancePct: 5,
    },
    effectSummary: 'Melee generates extra Reserve; +5% crit.',
    tags: ['MELEE', 'OCCULT', 'FAST', 'CRIT', 'RESOURCE'],
  },
  'aegis-claymore': {
    canonicalId: 'aegis-claymore',
    legacyId: 'aegis-claymore-blade',
    classId: 'AEGIS',
    displayName: 'Claymore',
    statModifiers: {
      strikeDamagePct: 15,
      aegisTechniquePowerPct: 15,
      aegisUltimatePowerPct: 15,
      fractureFromMeleePct: 20,
      strikeStaminaCostPct: 10,
    },
    effectSummary: '+20% Fracture from melee.',
    tags: ['MELEE', 'KINETIC', 'HEAVY', 'FRACTURE'],
  },
  'hex-revolver': {
    canonicalId: 'hex-revolver',
    legacyId: 'hex-silver-core-sidearm',
    classId: 'HEX_SHOT',
    displayName: 'Revolver',
    statModifiers: {},
    effectSummary: 'Baseline sidearm stats.',
    tags: ['BALLISTIC', 'RANGED', 'KINETIC', 'BALANCED', 'AMMO'],
  },
  'hex-carbine': {
    canonicalId: 'hex-carbine',
    legacyId: 'hex-pulse-rifle',
    classId: 'HEX_SHOT',
    displayName: 'Carbine',
    statModifiers: { magazineSizeBonus: -1, ballisticDamagePct: -5 },
    effectSummary: 'Tighter magazine; spread-pattern basic; slight per-pellet trade.',
    tags: ['BALLISTIC', 'RANGED', 'AMMO', 'RELOAD', 'SUSTAINED'],
  },
  'hex-shotgun': {
    canonicalId: 'hex-shotgun',
    legacyId: 'hex-void-cannon',
    classId: 'HEX_SHOT',
    displayName: 'Shotgun',
    statModifiers: {
      magazineSizeBonus: -2,
      ballisticDamagePct: 20,
      armorPierceLayers: 1,
      strikeStaminaCostPct: 10,
    },
    effectSummary: 'Lower magazine; higher damage; pierces 1 armor layer.',
    tags: ['BALLISTIC', 'RANGED', 'VOID_AMMO', 'HEAVY', 'ARMOR_PIERCE'],
  },
  'envoy-vambrace': {
    canonicalId: 'envoy-vambrace',
    legacyId: 'envoy-echo-lantern',
    classId: 'ENVOY',
    displayName: 'Vambrace',
    statModifiers: { occultDamagePct: -5, debuffDurationPct: 15 },
    effectSummary: 'Debuffs last 15% longer; slightly reduced raw damage.',
    tags: ['OCCULT', 'ECHO', 'CONTROL', 'DEBUFF'],
  },
  'envoy-scythe': {
    canonicalId: 'envoy-scythe',
    legacyId: 'envoy-null-conduit',
    classId: 'ENVOY',
    displayName: 'Scythe',
    statModifiers: {},
    effectSummary: 'Baseline occult damage and Veil-Flux generation.',
    tags: ['OCCULT', 'RANGED', 'BALANCED', 'RESOURCE'],
  },
  'envoy-sanguine-prism': {
    canonicalId: 'envoy-sanguine-prism',
    legacyId: 'envoy-sanguine-prism',
    classId: 'ENVOY',
    displayName: 'Sanguine Prism',
    statModifiers: {
      occultDamagePct: 10,
      sacrificeResourceBonus: 5,
      healReceivedPct: -10,
    },
    effectSummary: '+10% occult; sacrifice generates extra Veil-Flux; −10% healing received.',
    tags: ['OCCULT', 'SACRIFICE', 'RESOURCE', 'HIGH_RISK'],
  },
};
