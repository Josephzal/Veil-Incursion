import type { EncounterEnemyKey } from './enemyCombatConfig';
import type { EnemyRosterId } from './enemyRoster';
import type { VeilBiome } from '../types/encounterSpawn';

/** Depth 2 Breach variants — explicit IDs, parent AI/sprites reused. */
export const DEPTH_2_VARIANT_KEYS = [
  'WEEPING_GARGOYLE',
  'PHASE_SCUTTLER',
  'REMEMBERING_THRALL',
  'TAR_CHOIR',
  'STATIC_CALLER',
  'BLOOD_RUSTED_GOLEM',
  'ROOTBOUND_WEEPER',
  'ANCHOR_HUSK',
] as const;

export type Depth2VariantKey = (typeof DEPTH_2_VARIANT_KEYS)[number];

/** Depth 3 Deep Veil elite tags as explicit variant IDs. */
export const DEPTH_3_ELITE_VARIANT_KEYS = [
  'CORE_SICK_AMALGAM',
  'VOID_LOCK_MEMORY_LEECH',
  'GRAVE_ENGINE_CHURN',
  'NULL_CROWN_SHADE',
  'CHOIR_BOUND_RESONANCE_CASTER',
  'RIFT_SPIKE_SNIPER',
] as const;

export type Depth3EliteVariantKey = (typeof DEPTH_3_ELITE_VARIANT_KEYS)[number];

export type DepthEnemyVariantKey = Depth2VariantKey | Depth3EliteVariantKey;

export interface DepthEnemyVariantMeta {
  key: DepthEnemyVariantKey;
  rosterId: EnemyRosterId;
  parentKey: EncounterEnemyKey;
  label: string;
  allowedDepths: ReadonlyArray<1 | 2 | 3>;
  biomes: readonly VeilBiome[];
  /** Anchor Husk — only Anchor Signal / Operation Target nodes. */
  anchorOrOperationOnly?: boolean;
  telegraph: string;
}

export const DEPTH_ENEMY_VARIANT_META: Record<DepthEnemyVariantKey, DepthEnemyVariantMeta> = {
  WEEPING_GARGOYLE: {
    key: 'WEEPING_GARGOYLE',
    rosterId: 'weeping-gargoyle',
    parentKey: 'CONCRETE_GARGOYLE',
    label: 'WEEPING GARGOYLE',
    allowedDepths: [2, 3],
    biomes: ['NULL_ZONE'],
    telegraph: 'Concrete that weeps occult matter — fracture releases a retaliation pulse.',
  },
  PHASE_SCUTTLER: {
    key: 'PHASE_SCUTTLER',
    rosterId: 'phase-scuttler',
    parentKey: 'SCUTTLER',
    label: 'PHASE SCUTTLER',
    allowedDepths: [2, 3],
    biomes: ['NULL_ZONE', 'ABYSSAL_SINK', 'BLACKLINE_TERMINUS'],
    telegraph: 'Hits slip it out of phase — next strike suffers reduced accuracy.',
  },
  REMEMBERING_THRALL: {
    key: 'REMEMBERING_THRALL',
    rosterId: 'remembering-thrall',
    parentKey: 'THRALL',
    label: 'REMEMBERING THRALL',
    allowedDepths: [2, 3],
    biomes: ['ABYSSAL_SINK', 'BLACKLINE_TERMINUS', 'NULL_ZONE'],
    telegraph: 'Dies once into slump, then reforms unless overkilled.',
  },
  TAR_CHOIR: {
    key: 'TAR_CHOIR',
    rosterId: 'tar-choir',
    parentKey: 'TAR_SPITTER',
    label: 'TAR CHOIR',
    allowedDepths: [2, 3],
    biomes: ['ASHEN_WASTE', 'SLAG_WORKS', 'ABYSSAL_SINK'],
    telegraph: 'Tar marks amplify the next Veil strike.',
  },
  STATIC_CALLER: {
    key: 'STATIC_CALLER',
    rosterId: 'static-caller',
    parentKey: 'SMOG_CALLER',
    label: 'STATIC CALLER',
    allowedDepths: [2, 3],
    biomes: ['NULL_ZONE', 'BLACKLINE_TERMINUS', 'SLAG_WORKS'],
    telegraph: 'Frontline melee costs more stamina under static fog.',
  },
  BLOOD_RUSTED_GOLEM: {
    key: 'BLOOD_RUSTED_GOLEM',
    rosterId: 'blood-rusted-golem',
    parentKey: 'GOLEM',
    label: 'BLOOD-RUSTED GOLEM',
    allowedDepths: [2, 3],
    biomes: ['SLAG_WORKS', 'ASHEN_WASTE'],
    telegraph: 'Heat vents harder — industrial bruiser with blood-iron pressure.',
  },
  ROOTBOUND_WEEPER: {
    key: 'ROOTBOUND_WEEPER',
    rosterId: 'rootbound-weeper',
    parentKey: 'ASH_WEEPER',
    label: 'ROOTBOUND WEEPER',
    allowedDepths: [2, 3],
    biomes: ['ABYSSAL_SINK', 'ASHEN_WASTE'],
    telegraph: 'Incorrect kill roots/marks; clean occult kill softens the blast.',
  },
  ANCHOR_HUSK: {
    key: 'ANCHOR_HUSK',
    rosterId: 'anchor-husk',
    parentKey: 'THRALL',
    label: 'ANCHOR HUSK',
    allowedDepths: [2, 3],
    biomes: ['ABYSSAL_SINK', 'NULL_ZONE', 'ASHEN_WASTE', 'SLAG_WORKS', 'BLACKLINE_TERMINUS'],
    anchorOrOperationOnly: true,
    telegraph: 'Anchor-tagged husk — buffs allies while alive; prefer on Anchor/Operation nodes.',
  },
  CORE_SICK_AMALGAM: {
    key: 'CORE_SICK_AMALGAM',
    rosterId: 'core-sick-amalgam',
    parentKey: 'AMALGAM',
    label: 'CORE-SICK AMALGAM',
    allowedDepths: [3],
    biomes: ['ABYSSAL_SINK', 'NULL_ZONE', 'ASHEN_WASTE', 'SLAG_WORKS', 'BLACKLINE_TERMINUS'],
    telegraph: 'Wide-front Anchor-sick amalgam with fused HP pressure.',
  },
  VOID_LOCK_MEMORY_LEECH: {
    key: 'VOID_LOCK_MEMORY_LEECH',
    rosterId: 'void-lock-memory-leech',
    parentKey: 'MEMORY_LEECH',
    label: 'VOID-LOCK MEMORY LEECH',
    allowedDepths: [3],
    biomes: ['NULL_ZONE', 'BLACKLINE_TERMINUS', 'ABYSSAL_SINK'],
    telegraph: 'Temporarily locks an ability/augment — clearly telegraphed.',
  },
  GRAVE_ENGINE_CHURN: {
    key: 'GRAVE_ENGINE_CHURN',
    rosterId: 'grave-engine-churn',
    parentKey: 'CHURN',
    label: 'GRAVE-ENGINE CHURN',
    allowedDepths: [3],
    biomes: ['SLAG_WORKS', 'ABYSSAL_SINK', 'ASHEN_WASTE'],
    telegraph: 'Consumes fragile allies for stronger fire — counter with kill order.',
  },
  NULL_CROWN_SHADE: {
    key: 'NULL_CROWN_SHADE',
    rosterId: 'null-crown-shade',
    parentKey: 'NULL_SHADE',
    label: 'NULL-CROWN SHADE',
    allowedDepths: [3],
    biomes: ['NULL_ZONE', 'BLACKLINE_TERMINUS'],
    telegraph: 'Harder occult rejection; kinetic/fracture tools remain viable.',
  },
  CHOIR_BOUND_RESONANCE_CASTER: {
    key: 'CHOIR_BOUND_RESONANCE_CASTER',
    rosterId: 'choir-bound-resonance-caster',
    parentKey: 'RESONANCE_CASTER',
    label: 'CHOIR-BOUND RESONANCE CASTER',
    allowedDepths: [3],
    biomes: ['ASHEN_WASTE', 'SLAG_WORKS', 'BLACKLINE_TERMINUS'],
    telegraph: 'Starts with a resonance stack and escalates each turn.',
  },
  RIFT_SPIKE_SNIPER: {
    key: 'RIFT_SPIKE_SNIPER',
    rosterId: 'rift-spike-sniper',
    parentKey: 'COIL_SPIKE_SNIPER',
    label: 'RIFT-SPIKE SNIPER',
    allowedDepths: [3],
    biomes: ['ASHEN_WASTE', 'NULL_ZONE', 'BLACKLINE_TERMINUS', 'ABYSSAL_SINK'],
    telegraph: 'Longer lock-on true-damage telegraph — interrupt or evade.',
  },
};

export const ALL_DEPTH_ENEMY_VARIANT_KEYS: readonly DepthEnemyVariantKey[] = [
  ...DEPTH_2_VARIANT_KEYS,
  ...DEPTH_3_ELITE_VARIANT_KEYS,
];

export function isDepthEnemyVariantKey(key: string): key is DepthEnemyVariantKey {
  return (ALL_DEPTH_ENEMY_VARIANT_KEYS as readonly string[]).includes(key);
}

export function isDepth2VariantRosterId(rosterId: string | undefined | null): boolean {
  if (!rosterId) return false;
  return DEPTH_2_VARIANT_KEYS.some((key) => DEPTH_ENEMY_VARIANT_META[key].rosterId === rosterId);
}

/** Soft combat constants for Phase E hooks. */
export const WEEPING_FRACTURE_PULSE_DAMAGE = 8;
export const PHASE_SCUTTLER_ACCURACY_PENALTY = 0.25;
export const STATIC_CALLER_MELEE_STAMINA_MULT = 1.35;
export const TAR_CHOIR_MARK_DAMAGE_BONUS = 0.2;
export const ANCHOR_HUSK_ALLY_DAMAGE_BONUS = 0.12;
export const ANCHOR_HUSK_INJECT_CHANCE = 0.42;
export const REMEMBERING_THRALL_REVIVE_HP_PCT = 0.45;
