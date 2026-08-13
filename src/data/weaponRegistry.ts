import type { ClassType } from '../types/game';
import type {
  WeaponFamilyDefinition,
  WeaponFamilyId,
  WeaponResourceCost,
} from '../types/weapon';
import { FROZEN_TIER1_BASELINES } from './weaponTier1FrozenBaselines';
import {
  CANONICAL_WEAPON_FAMILY_IDS,
  isCanonicalWeaponFamilyId,
} from './weaponFamilyIdNormalize';

const EMPTY_COST: readonly WeaponResourceCost[] = [];

export const ALL_WEAPON_FAMILY_IDS: readonly WeaponFamilyId[] = CANONICAL_WEAPON_FAMILY_IDS;

export const STARTER_WEAPON_BY_CLASS: Record<ClassType, WeaponFamilyId> = {
  AEGIS: 'aegis-longsword',
  HEX_SHOT: 'hex-revolver',
  ENVOY: 'envoy-vambrace',
};

/**
 * Tierless weapon registry — nine canonical families.
 * baselineStatModifiers = frozen former effective Tier I output (Stage II-C).
 */
export const WEAPON_REGISTRY: Record<WeaponFamilyId, WeaponFamilyDefinition> = {
  'aegis-longsword': {
    id: 'aegis-longsword',
    classId: 'AEGIS',
    name: 'Longsword',
    shortName: 'Longsword',
    description: 'Longsword — balanced damage, fracture, and Reserve generation.',
    flavorText: 'Agency-standard rune etching. For operatives learning the Aegis rhythm.',
    role: 'Starter / balanced fracture setup',
    tags: FROZEN_TIER1_BASELINES['aegis-longsword'].tags,
    startingUnlocked: true,
    unlockRequirement: EMPTY_COST,
    baselineStatModifiers: { ...FROZEN_TIER1_BASELINES['aegis-longsword'].statModifiers },
    baselineEffectSummary: FROZEN_TIER1_BASELINES['aegis-longsword'].effectSummary,
    uiSummary: 'Steady Fracture strike — reliable Parry and Reserve setup.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Deferred masterwork — inert; requires Anomalous Core when designed.',
  },
  'aegis-claymore': {
    id: 'aegis-claymore',
    classId: 'AEGIS',
    name: 'Claymore',
    shortName: 'Claymore',
    description: 'Massive claymore — heavy Fracture pressure and break cashouts.',
    flavorText: 'Legion-forged mass transfer lattice for breaking armored Veil entities.',
    role: 'Heavy Fracture-break cashout',
    tags: FROZEN_TIER1_BASELINES['aegis-claymore'].tags,
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'legion-blood-iron', quantity: 3 },
      { resourceId: 'rail-capacitor', quantity: 2 },
      { resourceId: 'combustion-cylinder', quantity: 2 },
    ],
    baselineStatModifiers: { ...FROZEN_TIER1_BASELINES['aegis-claymore'].statModifiers },
    baselineEffectSummary: FROZEN_TIER1_BASELINES['aegis-claymore'].effectSummary,
    uiSummary: 'Heavy Fracture commitment — cash out on breaks.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Deferred masterwork — inert; requires Anomalous Core when designed.',
  },
  'aegis-paired-blades': {
    id: 'aegis-paired-blades',
    classId: 'AEGIS',
    name: 'Paired Blades',
    shortName: 'Paired',
    description: 'Two equal-length swords — crit and Reserve over raw kinetic output.',
    flavorText: 'Cuts along the membrane between worlds. Occult resonance over brute force.',
    role: 'Tempo / evade / execution',
    tags: FROZEN_TIER1_BASELINES['aegis-paired-blades'].tags,
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'ossified-ley-knot', quantity: 2 },
      { resourceId: 'resonant-filament', quantity: 2 },
      { resourceId: 'echo-glass-shard', quantity: 6 },
    ],
    baselineStatModifiers: { ...FROZEN_TIER1_BASELINES['aegis-paired-blades'].statModifiers },
    baselineEffectSummary: FROZEN_TIER1_BASELINES['aegis-paired-blades'].effectSummary,
    uiSummary: 'Kinetic cut — Occult rider after evade/parry tempo.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Deferred masterwork — inert; requires Anomalous Core when designed.',
  },
  'hex-revolver': {
    id: 'hex-revolver',
    classId: 'HEX_SHOT',
    name: 'Revolver',
    shortName: 'Revolver',
    description: 'Revolver — consistent ballistic damage and manageable ammo.',
    flavorText: 'Terran Grid warded sidearm. The Riftshot operative\'s default field piece.',
    role: 'Starter / precision reload-tempo',
    tags: FROZEN_TIER1_BASELINES['hex-revolver'].tags,
    startingUnlocked: true,
    unlockRequirement: EMPTY_COST,
    baselineStatModifiers: { ...FROZEN_TIER1_BASELINES['hex-revolver'].statModifiers },
    baselineEffectSummary: FROZEN_TIER1_BASELINES['hex-revolver'].effectSummary,
    uiSummary: 'Efficient revolver — reload tempo and precise finishes.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Deferred masterwork — inert; requires Anomalous Core when designed.',
  },
  /**
   * Carbine — complete former hex-carbine (Ash Shotgun) kit.
   * Display rename only; mechanics unchanged.
   */
  'hex-carbine': {
    id: 'hex-carbine',
    classId: 'HEX_SHOT',
    name: 'Carbine',
    shortName: 'Carbine',
    description: 'Carbine — multi-target pressure and reload tempo.',
    flavorText: 'Recovered encrypted tech lattice. Spread pattern favors clustered frontliners over precision.',
    role: 'Close-range AoE / crowd clear',
    tags: FROZEN_TIER1_BASELINES['hex-carbine'].tags,
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'encrypted-grid-drive', quantity: 3 },
      { resourceId: 'rail-capacitor', quantity: 2 },
      { resourceId: 'containment-seal', quantity: 1 },
      { resourceId: 'nullcrete-shard', quantity: 4 },
    ],
    baselineStatModifiers: { ...FROZEN_TIER1_BASELINES['hex-carbine'].statModifiers },
    baselineEffectSummary: FROZEN_TIER1_BASELINES['hex-carbine'].effectSummary,
    uiSummary: 'Spread basic — crowd clear, poor backline, frequent reload.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Deferred masterwork — inert; requires Anomalous Core when designed.',
  },
  /**
   * Shotgun — complete former hex-shotgun (Nullbreach) kit.
   * Display rename only; mechanics unchanged.
   */
  'hex-shotgun': {
    id: 'hex-shotgun',
    classId: 'HEX_SHOT',
    name: 'Shotgun',
    shortName: 'Shotgun',
    description: 'Shotgun — high burst, low magazine, armor interaction.',
    flavorText: 'Dangerous single-shot lattice. Pierces armored hostiles at risky tempo.',
    role: 'Armor-breach single-target burst',
    tags: FROZEN_TIER1_BASELINES['hex-shotgun'].tags,
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'encrypted-grid-drive', quantity: 1 },
      { resourceId: 'combustion-cylinder', quantity: 2 },
      { resourceId: 'rail-capacitor', quantity: 1 },
      { resourceId: 'breach-thread', quantity: 1 },
    ],
    baselineStatModifiers: { ...FROZEN_TIER1_BASELINES['hex-shotgun'].statModifiers },
    baselineEffectSummary: FROZEN_TIER1_BASELINES['hex-shotgun'].effectSummary,
    uiSummary: 'Breach weapon — small mag, armor pressure, weak crowds.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Deferred masterwork — inert; requires Anomalous Core when designed.',
  },
  'envoy-scythe': {
    id: 'envoy-scythe',
    classId: 'ENVOY',
    name: 'Scythe',
    shortName: 'Scythe',
    description: 'Occult scythe — stable occult output and resource flow.',
    flavorText: 'Agency-issue focusing scythe. Reliable occult throughput for field casters.',
    role: 'Clean Flux / Catalyst specialist',
    tags: FROZEN_TIER1_BASELINES['envoy-scythe'].tags,
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'echo-glass-shard', quantity: 8 },
      { resourceId: 'resonant-filament', quantity: 3 },
      { resourceId: 'encrypted-grid-drive', quantity: 1 },
      { resourceId: 'sanguine-ampoule', quantity: 1 },
    ],
    baselineStatModifiers: { ...FROZEN_TIER1_BASELINES['envoy-scythe'].statModifiers },
    baselineEffectSummary: FROZEN_TIER1_BASELINES['envoy-scythe'].effectSummary,
    uiSummary: 'Clean Flux cycle — stable Catalyst sequencing.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Deferred masterwork — inert; requires Anomalous Core when designed.',
  },
  'envoy-sanguine-prism': {
    id: 'envoy-sanguine-prism',
    classId: 'ENVOY',
    name: 'Sanguine Prism',
    shortName: 'Prism',
    description: 'Floating blood focus — converts blood into Veil power at elevated risk.',
    flavorText: 'Blood-for-power exchange. Rewards sacrifice without runaway healing loops.',
    role: 'Sacrifice / Brink',
    tags: FROZEN_TIER1_BASELINES['envoy-sanguine-prism'].tags,
    startingUnlocked: false,
    unlockRequirement: [
      { resourceId: 'sanguine-ampoule', quantity: 3 },
      { resourceId: 'mycelial-ichor', quantity: 1 },
      { resourceId: 'ossified-ley-knot', quantity: 2 },
    ],
    baselineStatModifiers: { ...FROZEN_TIER1_BASELINES['envoy-sanguine-prism'].statModifiers },
    baselineEffectSummary: FROZEN_TIER1_BASELINES['envoy-sanguine-prism'].effectSummary,
    uiSummary: 'Brink caster — capped HP sacrifice near low Flux.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Deferred masterwork — inert; requires Anomalous Core when designed.',
  },
  'envoy-vambrace': {
    id: 'envoy-vambrace',
    classId: 'ENVOY',
    name: 'Vambrace',
    shortName: 'Vambrace',
    description: 'Hand/forearm curseweave — control and debuff synergy over raw damage.',
    flavorText: 'Crystallized runner echoes bound to the forearm. Support and control doctrine.',
    role: 'Starter / Rot / curse / detonation',
    tags: FROZEN_TIER1_BASELINES['envoy-vambrace'].tags,
    startingUnlocked: true,
    unlockRequirement: EMPTY_COST,
    baselineStatModifiers: { ...FROZEN_TIER1_BASELINES['envoy-vambrace'].statModifiers },
    baselineEffectSummary: FROZEN_TIER1_BASELINES['envoy-vambrace'].effectSummary,
    uiSummary: 'Rot setup — delay detonation for board payoff.',
    masterworkUnlocked: false,
    masterworkRecipeId: null,
    requiresAnomalousCore: true,
    masterworkEffectSummary: 'Deferred masterwork — inert; requires Anomalous Core when designed.',
  },
};

export function isWeaponFamilyId(id: string): id is WeaponFamilyId {
  return isCanonicalWeaponFamilyId(id);
}

export function getWeaponFamily(id: WeaponFamilyId): WeaponFamilyDefinition {
  return WEAPON_REGISTRY[id];
}

export function listWeaponFamiliesForClass(classId: ClassType): WeaponFamilyDefinition[] {
  return ALL_WEAPON_FAMILY_IDS
    .map((id) => WEAPON_REGISTRY[id])
    .filter((def) => def.classId === classId);
}

export function getStarterWeaponForClass(classId: ClassType): WeaponFamilyId {
  return STARTER_WEAPON_BY_CLASS[classId];
}
