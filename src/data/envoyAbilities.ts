import type { EnvoyAbilityId } from '../types/operativeClass';
import type { EnvoyAbilityTag } from '../types/classCombatAbility';
import type { AbilityUnlockCost } from '../types/aegisCombat';

export interface EnvoyAbilityDefinition {
  id: EnvoyAbilityId;
  classId: 'ENVOY';
  label: string;
  description: string;
  apCost: number;
  /** Percent Veil-Flux consumed on cast. */
  fluxCost: number;
  /** Percent Veil-Flux restored on cast (RESTORE actions). */
  fluxRegen: number;
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
    description: 'Anchor spell — applies 1 Veil Rot stack. Strips 1 Occult Ward. Counters: Channel / Ritual. Cannot be removed or grafted.',
    apCost: 1,
    fluxCost: 5,
    fluxRegen: 0,
    staminaCost: 6,
    baseDamage: 10,
    tags: ['SPELL', 'RANGED', 'OCCULT', 'WARD_BREAK', 'INTERRUPT', 'SILENCE'],
    unlockCost: {},
  },
  CATACLYSM_SIGIL: {
    id: 'CATACLYSM_SIGIL',
    classId: 'ENVOY',
    label: '[ CATACLYSM SIGIL ]',
    description: 'Ultimate — consumes all Veil Rot for grid-wide true damage (procs at 6+ stacks).',
    apCost: 0,
    fluxCost: 0,
    fluxRegen: 0,
    staminaCost: 0,
    baseDamage: 25,
    tags: ['ULTIMATE', 'TRUE_DAMAGE', 'AOE'],
    unlockCost: { 'ley-slag': 30 },
  },
  ASTRAL_LANCE: {
    id: 'ASTRAL_LANCE',
    classId: 'ENVOY',
    label: '[ ASTRAL LANCE ]',
    description: 'Pierces front row to strike back row. Applies 1 Veil Rot to both.',
    apCost: 1,
    fluxCost: 15,
    fluxRegen: 0,
    staminaCost: 10,
    baseDamage: 18,
    tags: ['SPELL', 'RANGED', 'OCCULT'],
    unlockCost: { 'ley-slag': 12 },
  },
  NECROTIC_BLOOM: {
    id: 'NECROTIC_BLOOM',
    classId: 'ENVOY',
    label: '[ NECROTIC BLOOM ]',
    description: '2×2 occult burst — applies 2 Veil Rot stacks to all hostiles.',
    apCost: 2,
    fluxCost: 25,
    fluxRegen: 0,
    staminaCost: 14,
    baseDamage: 14,
    tags: ['SPELL', 'AOE', 'OCCULT'],
    unlockCost: { 'ley-slag': 16 },
  },
  FLUX_PURGE: {
    id: 'FLUX_PURGE',
    classId: 'ENVOY',
    label: '[ FLUX-PURGE ]',
    description: 'Drains 1 Veil Rot stack from the target to regenerate 20% Veil-Flux.',
    apCost: 1,
    fluxCost: 0,
    fluxRegen: 20,
    staminaCost: 12,
    baseDamage: 12,
    tags: ['SPELL', 'MELEE', 'RESTORE'],
    unlockCost: { 'ley-slag': 14 },
  },
  DIMENSIONAL_SHEAR: {
    id: 'DIMENSIONAL_SHEAR',
    classId: 'ENVOY',
    label: '[ DIMENSIONAL SHEAR ]',
    description: 'Strips all Occult Wards and applies 1 Veil Rot stack. Counters: Channel / Ritual.',
    apCost: 2,
    fluxCost: 20,
    fluxRegen: 0,
    staminaCost: 12,
    baseDamage: 15,
    tags: ['SPELL', 'RANGED', 'OCCULT', 'WARD_BREAK', 'INTERRUPT'],
    unlockCost: { 'ley-slag': 12 },
  },
  RIFT_WARD: {
    id: 'RIFT_WARD',
    classId: 'ENVOY',
    label: '[ RIFT-WARD ]',
    description: 'Defensive hold & release — perfect block restores flux. Counters: Heavy Attack / Lock-On (partial).',
    apCost: 1,
    fluxCost: 0,
    fluxRegen: 0,
    staminaCost: 0,
    baseDamage: 0,
    tags: ['SPELL', 'DEFENSIVE', 'OCCULT', 'BLOCK'],
    unlockCost: {},
  },
  PHASE_STEP: {
    id: 'PHASE_STEP',
    classId: 'ENVOY',
    label: '[ PHASE-STEP ]',
    description: '100% evade against the next incoming hit. Defensive answer to Lock-On / Heavy Attack.',
    apCost: 0,
    fluxCost: 15,
    fluxRegen: 0,
    staminaCost: 8,
    baseDamage: 0,
    tags: ['SPELL', 'MOBILITY', 'BUFF', 'BLOCK', 'DECOY'],
    unlockCost: { 'ley-slag': 10 },
  },
  AETHERIC_TRANSFUSION: {
    id: 'AETHERIC_TRANSFUSION',
    classId: 'ENVOY',
    label: '[ AETHERIC TRANSFUSION ]',
    description: 'Converts flux into flesh — restores 25% Max HP.',
    apCost: 2,
    fluxCost: 30,
    fluxRegen: 0,
    staminaCost: 0,
    baseDamage: 0,
    tags: ['SPELL', 'RESTORE'],
    unlockCost: { 'ley-slag': 16 },
  },
  SOUL_TETHER: {
    id: 'SOUL_TETHER',
    classId: 'ENVOY',
    label: '[ SOUL-TETHER ]',
    description: 'Mirrors 50% of damage taken back to the tethered target as true damage.',
    apCost: 1,
    fluxCost: 10,
    fluxRegen: 0,
    staminaCost: 8,
    baseDamage: 0,
    tags: ['SPELL', 'DEFENSIVE', 'CURSE'],
    unlockCost: { 'ley-slag': 12 },
  },
  ENTROPY_HEX: {
    id: 'ENTROPY_HEX',
    classId: 'ENVOY',
    label: '[ ENTROPY HEX ]',
    description: 'Applies 1 Veil Rot stack. Target loses 1 AP next turn.',
    apCost: 1,
    fluxCost: 15,
    fluxRegen: 0,
    staminaCost: 8,
    baseDamage: 5,
    tags: ['CURSE', 'RANGED', 'DEBUFF'],
    unlockCost: { 'ley-slag': 10 },
  },
  FLESH_WARP: {
    id: 'FLESH_WARP',
    classId: 'ENVOY',
    label: '[ FLESH-WARP ]',
    description: "Permanently reduces target Max HP by 15%, blocks healing, applies 1 Veil Rot.",
    apCost: 1,
    fluxCost: 20,
    fluxRegen: 0,
    staminaCost: 10,
    baseDamage: 0,
    tags: ['CURSE', 'DEBUFF'],
    unlockCost: { 'ley-slag': 14 },
  },
  PARALYTIC_MIASMA: {
    id: 'PARALYTIC_MIASMA',
    classId: 'ENVOY',
    label: '[ PARALYTIC MIASMA ]',
    description: 'Roots target (0% evade), doubles their next Veil Rot tick. Applies 1 stack.',
    apCost: 1,
    fluxCost: 15,
    fluxRegen: 0,
    staminaCost: 10,
    baseDamage: 0,
    tags: ['CURSE', 'CONTROL', 'DEBUFF'],
    unlockCost: { 'ley-slag': 12 },
  },
  MIND_SUNDER: {
    id: 'MIND_SUNDER',
    classId: 'ENVOY',
    label: '[ MIND-SUNDER ]',
    description: "Applies CONCUSSED. Cancels the target's planned attack if preparing. Counters: Channel / Lock-On.",
    apCost: 1,
    fluxCost: 20,
    fluxRegen: 0,
    staminaCost: 8,
    baseDamage: 12,
    tags: ['CURSE', 'CONTROL', 'OCCULT', 'INTERRUPT', 'SILENCE'],
    unlockCost: { 'ley-slag': 12 },
  },
};

export function getEnvoyAbilityDefinition(id: EnvoyAbilityId): EnvoyAbilityDefinition {
  return ENVOY_ABILITY_CATALOG[id];
}

export function getEnvoyAbilityTags(id: EnvoyAbilityId): readonly EnvoyAbilityTag[] {
  return ENVOY_ABILITY_CATALOG[id].tags;
}

export function envoyAbilityConsumesFlux(id: EnvoyAbilityId): boolean {
  return ENVOY_ABILITY_CATALOG[id].fluxCost > 0;
}

export function envoyAbilityRestoresFlux(id: EnvoyAbilityId): boolean {
  return ENVOY_ABILITY_CATALOG[id].fluxRegen > 0;
}
