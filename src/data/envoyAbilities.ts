import type { EnvoyAbilityId } from '../types/operativeClass';
import type { EnvoyAbilityTag } from '../types/classCombatAbility';
import type { AbilityUnlockCost } from '../types/aegisCombat';

export interface EnvoyAbilityDefinition {
  id: EnvoyAbilityId;
  classId: 'ENVOY';
  label: string;
  description: string;
  apCost: number;
  fluxGen: number;
  fluxCost: number;
  minFluxRequired?: number;
  staminaCost: number;
  baseDamage: number;
  tags: readonly EnvoyAbilityTag[];
  unlockCost: AbilityUnlockCost;
}

export const ENVOY_ABILITY_CATALOG: Record<EnvoyAbilityId, EnvoyAbilityDefinition> = {
  VEIL_SPLINTER: {
    id: 'VEIL_SPLINTER',
    classId: 'ENVOY',
    label: '[ VEIL-SPLINTER ]',
    description: 'Anchor spell — basic occult tear. Cannot be removed or grafted.',
    apCost: 1,
    fluxGen: 15,
    fluxCost: 0,
    staminaCost: 6,
    baseDamage: 10,
    tags: ['SPELL', 'RANGED', 'OCCULT', 'FLUX_GEN'],
    unlockCost: {},
  },
  CATACLYSM_SIGIL: {
    id: 'CATACLYSM_SIGIL',
    classId: 'ENVOY',
    label: '[ CATACLYSM SIGIL ]',
    description: 'Ultimate — consumes 100 Flux for grid-wide true damage.',
    apCost: 0,
    fluxGen: 0,
    fluxCost: 100,
    minFluxRequired: 100,
    staminaCost: 0,
    baseDamage: 25,
    tags: ['ULTIMATE', 'TRUE_DAMAGE', 'AOE'],
    unlockCost: { 'ley-slag': 30 },
  },
  ASTRAL_LANCE: {
    id: 'ASTRAL_LANCE',
    classId: 'ENVOY',
    label: '[ ASTRAL LANCE ]',
    description: 'Pierces front row to strike back row for equal occult damage.',
    apCost: 1,
    fluxGen: 25,
    fluxCost: 0,
    staminaCost: 10,
    baseDamage: 18,
    tags: ['SPELL', 'RANGED', 'OCCULT', 'FLUX_GEN'],
    unlockCost: { 'ley-slag': 12 },
  },
  SPATIAL_COLLAPSE: {
    id: 'SPATIAL_COLLAPSE',
    classId: 'ENVOY',
    label: '[ SPATIAL COLLAPSE ]',
    description: '2×2 occult burst — destroys grid hazards and cover.',
    apCost: 2,
    fluxGen: 35,
    fluxCost: 0,
    staminaCost: 14,
    baseDamage: 14,
    tags: ['SPELL', 'AOE', 'OCCULT', 'FLUX_GEN'],
    unlockCost: { 'ley-slag': 16 },
  },
  FLUX_PURGE: {
    id: 'FLUX_PURGE',
    classId: 'ENVOY',
    label: '[ FLUX-PURGE ]',
    description: 'Flux dump — high melee occult vent (requires 40+ Flux).',
    apCost: 1,
    fluxGen: 0,
    fluxCost: 40,
    minFluxRequired: 40,
    staminaCost: 12,
    baseDamage: 28,
    tags: ['SPELL', 'MELEE', 'OCCULT', 'FLUX_DUMP'],
    unlockCost: { 'ley-slag': 14 },
  },
  DIMENSIONAL_SHEAR: {
    id: 'DIMENSIONAL_SHEAR',
    classId: 'ENVOY',
    label: '[ DIMENSIONAL SHEAR ]',
    description: 'Rends occult wards and shields from the target.',
    apCost: 2,
    fluxGen: 20,
    fluxCost: 0,
    staminaCost: 12,
    baseDamage: 15,
    tags: ['SPELL', 'RANGED', 'OCCULT', 'FLUX_GEN'],
    unlockCost: { 'ley-slag': 12 },
  },
  RIFT_WARD: {
    id: 'RIFT_WARD',
    classId: 'ENVOY',
    label: '[ RIFT-WARD ]',
    description: 'Intrinsic reactive ward — triggers on incoming attacks (class feature).',
    apCost: 1,
    fluxGen: 0,
    fluxCost: 0,
    staminaCost: 0,
    baseDamage: 0,
    tags: ['SPELL', 'DEFENSIVE', 'OCCULT'],
    unlockCost: {},
  },
  PHASE_STEP: {
    id: 'PHASE_STEP',
    classId: 'ENVOY',
    label: '[ PHASE-STEP ]',
    description: '100% evade against the next incoming hit.',
    apCost: 0,
    fluxGen: 25,
    fluxCost: 0,
    staminaCost: 8,
    baseDamage: 0,
    tags: ['SPELL', 'MOBILITY', 'BUFF', 'FLUX_GEN'],
    unlockCost: { 'ley-slag': 10 },
  },
  AETHERIC_TRANSFUSION: {
    id: 'AETHERIC_TRANSFUSION',
    classId: 'ENVOY',
    label: '[ AETHERIC TRANSFUSION ]',
    description: 'Flux dump heal — restores 25% Max HP (requires 50+ Flux).',
    apCost: 2,
    fluxGen: 0,
    fluxCost: 50,
    minFluxRequired: 50,
    staminaCost: 0,
    baseDamage: 0,
    tags: ['SPELL', 'RESTORE', 'FLUX_DUMP'],
    unlockCost: { 'ley-slag': 16 },
  },
  SOUL_TETHER: {
    id: 'SOUL_TETHER',
    classId: 'ENVOY',
    label: '[ SOUL-TETHER ]',
    description: 'Mirrors 50% of damage taken back to the tethered target as true damage.',
    apCost: 1,
    fluxGen: 15,
    fluxCost: 0,
    staminaCost: 8,
    baseDamage: 0,
    tags: ['SPELL', 'DEFENSIVE', 'CURSE', 'FLUX_GEN'],
    unlockCost: { 'ley-slag': 12 },
  },
  ENTROPY_HEX: {
    id: 'ENTROPY_HEX',
    classId: 'ENVOY',
    label: '[ ENTROPY HEX ]',
    description: 'Target loses 1 AP next turn and suffers 8 Occult DoT for 2 turns.',
    apCost: 1,
    fluxGen: 25,
    fluxCost: 0,
    staminaCost: 8,
    baseDamage: 5,
    tags: ['CURSE', 'RANGED', 'DEBUFF', 'FLUX_GEN'],
    unlockCost: { 'ley-slag': 10 },
  },
  FLESH_WARP: {
    id: 'FLESH_WARP',
    classId: 'ENVOY',
    label: '[ FLESH-WARP ]',
    description: "Permanently reduces target's Max HP by 15% and negates healing.",
    apCost: 1,
    fluxGen: 20,
    fluxCost: 0,
    staminaCost: 10,
    baseDamage: 0,
    tags: ['CURSE', 'DEBUFF', 'FLUX_GEN'],
    unlockCost: { 'ley-slag': 14 },
  },
  GRAVITY_WELL: {
    id: 'GRAVITY_WELL',
    classId: 'ENVOY',
    label: '[ GRAVITY WELL ]',
    description: 'Pulls hostiles to center tiles — rooted with zero evade.',
    apCost: 1,
    fluxGen: 15,
    fluxCost: 0,
    staminaCost: 10,
    baseDamage: 8,
    tags: ['CURSE', 'CONTROL', 'AOE', 'FLUX_GEN'],
    unlockCost: { 'ley-slag': 12 },
  },
  MIND_SUNDER: {
    id: 'MIND_SUNDER',
    classId: 'ENVOY',
    label: '[ MIND-SUNDER ]',
    description: "Applies CONCUSSED. Cancels the target's planned attack if preparing.",
    apCost: 1,
    fluxGen: 0,
    fluxCost: 20,
    staminaCost: 8,
    baseDamage: 12,
    tags: ['CURSE', 'CONTROL', 'OCCULT', 'FLUX_DUMP'],
    unlockCost: { 'ley-slag': 12 },
  },
};

export function getEnvoyAbilityDefinition(id: EnvoyAbilityId): EnvoyAbilityDefinition {
  return ENVOY_ABILITY_CATALOG[id];
}

export function getEnvoyAbilityTags(id: EnvoyAbilityId): readonly EnvoyAbilityTag[] {
  return ENVOY_ABILITY_CATALOG[id].tags;
}
