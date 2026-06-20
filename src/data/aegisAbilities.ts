import type { AegisAbilityId, AbilityTag, AbilityUnlockCost } from '../types/aegisCombat';

export interface AegisAbilityDefinition {
  id: AegisAbilityId;
  label: string;
  apCost: number;
  staminaCost: number;
  staminaCostPct?: number;
  hpCostPct?: number;
  cooldownTurns?: number;
  requiresFullAbyssal?: boolean;
  description: string;
  tags: readonly AbilityTag[];
  unlockCost: AbilityUnlockCost;
}

export const AEGIS_ABILITY_CATALOG: Record<AegisAbilityId, AegisAbilityDefinition> = {
  STRIKE: {
    id: 'STRIKE',
    label: '[ STRIKE ]',
    apCost: 1,
    staminaCost: 12,
    description: '10 kinetic damage. +15% Abyssal Reserve. +25 fracture. Concussed if fracture >50%.',
    tags: ['KINETIC', 'MELEE', 'FRACTURE', 'DEBUFF'],
    unlockCost: {},
  },
  RUIN: {
    id: 'RUIN',
    label: '[ RUIN ]',
    apCost: 2,
    staminaCost: 20,
    description: 'AoE fracture shockwave. Instant fracture if target is Concussed.',
    tags: ['KINETIC', 'AOE', 'FRACTURE', 'CONTROL'],
    unlockCost: { 'ley-slag': 15 },
  },
  WRAITH_PARRY: {
    id: 'WRAITH_PARRY',
    label: '[ WRAITH PARRY ]',
    apCost: 1,
    staminaCost: 0,
    staminaCostPct: 18,
    description: 'Defensive stance — reflect 100% fracture on next physical hit.',
    tags: ['KINETIC', 'DEFENSIVE', 'MELEE', 'FRACTURE'],
    unlockCost: { 'ley-slag': 10, 'sanguine-ampoule': 2 },
  },
  GRAVE_BIND: {
    id: 'GRAVE_BIND',
    label: '[ GRAVE BIND ]',
    apCost: 1,
    staminaCost: 10,
    description: 'Pull backline target to melee. Exposed — defense halved.',
    tags: ['OCCULT', 'RANGED', 'CONTROL', 'DEBUFF'],
    unlockCost: { 'ley-slag': 12, 'echo-glass-shard': 3 },
  },
  SHADOW_STEP: {
    id: 'SHADOW_STEP',
    label: '[ SHADOW STEP ]',
    apCost: 0,
    staminaCost: 0,
    staminaCostPct: 30,
    description: 'Teleport shoulder-check. Massive fracture. End turn to seize initiative.',
    tags: ['OCCULT', 'MOBILITY', 'MELEE', 'FRACTURE', 'BUFF'],
    unlockCost: { 'ley-slag': 20, 'echo-glass-shard': 5 },
  },
  VEIL_PIERCER: {
    id: 'VEIL_PIERCER',
    label: '[ VEIL-PIERCER ]',
    apCost: 1,
    staminaCost: 10,
    description: 'Occult damage bypasses kinetic armor. +20% Reserve. +15 fracture.',
    tags: ['OCCULT', 'MELEE', 'ARMOR_PIERCE'],
    unlockCost: { 'encrypted-grid-drive': 1 },
  },
  ASHEN_MANTLE: {
    id: 'ASHEN_MANTLE',
    label: '[ ASHEN MANTLE ]',
    apCost: 2,
    staminaCost: 8,
    description: 'Block 50% incoming damage. Attackers gain Doomed.',
    tags: ['OCCULT', 'DEFENSIVE', 'DEBUFF'],
    unlockCost: { 'ley-slag': 8, 'sanguine-ampoule': 1 },
  },
  NAIL_TO_GRID: {
    id: 'NAIL_TO_GRID',
    label: '[ NAIL TO GRID ]',
    apCost: 1,
    staminaCost: 8,
    description: 'Pin target shadow — enemy loses 1 AP. Doomed spreads to adjacents.',
    tags: ['OCCULT', 'RANGED', 'DEBUFF', 'CONTROL'],
    unlockCost: { 'ley-slag': 10, 'echo-glass-shard': 4 },
  },
  BLOOD_TITHE: {
    id: 'BLOOD_TITHE',
    label: '[ BLOOD-TITHE ]',
    apCost: 2,
    staminaCost: 8,
    description: 'Consume Reserve to heal 2% HP per 10 Reserve and deal occult damage.',
    tags: ['OCCULT', 'MELEE', 'RESTORE'],
    unlockCost: { 'sanguine-ampoule': 3, 'ley-slag': 10 },
  },
  DEMONS_LUNG: {
    id: 'DEMONS_LUNG',
    label: "[ DEMON'S LUNG ]",
    apCost: 0,
    staminaCost: 0,
    cooldownTurns: 3,
    description: 'Restore 40% stamina and gain +1 AP this turn.',
    tags: ['RESTORE', 'BUFF'],
    unlockCost: { 'ley-slag': 10 },
  },
  CRIMSON_PACT: {
    id: 'CRIMSON_PACT',
    label: '[ CRIMSON PACT ]',
    apCost: 1,
    staminaCost: 0,
    hpCostPct: 12,
    description: 'Sacrifice HP — next two attacks are guaranteed Critical Hits.',
    tags: ['OCCULT', 'SACRIFICE', 'BUFF'],
    unlockCost: { 'sanguine-ampoule': 4, 'ley-slag': 12 },
  },
  EVISCERATE: {
    id: 'EVISCERATE',
    label: '[ EVISCERATE ]',
    apCost: 2,
    staminaCost: 0,
    requiresFullAbyssal: true,
    description: 'Ultimate — 3-slice execution. True damage. Sunder armor on survivors.',
    tags: ['ULTIMATE', 'TRUE_DAMAGE', 'MELEE', 'DEBUFF'],
    unlockCost: { 'anomalous-core': 1, 'ossified-ley-knot': 1 },
  },
  DEVASTATE: {
    id: 'DEVASTATE',
    label: '[ DEVASTATE ]',
    apCost: 1,
    staminaCost: 15,
    description: 'Combo finisher — minimal kinetic hit, then detonates 100% of target fracture as True damage.',
    tags: ['KINETIC', 'MELEE', 'TRUE_DAMAGE', 'CONTROL', 'FRACTURE'],
    unlockCost: { 'ley-slag': 18 },
  },
  ABYSSAL_FAULT: {
    id: 'ABYSSAL_FAULT',
    label: '[ ABYSSAL FAULT ]',
    apCost: 2,
    staminaCost: 22,
    description: 'Corrupts the entire grid with Veil-tar for 3 turns — hostiles lose evade and are rooted on entry.',
    tags: ['OCCULT', 'AOE', 'DEBUFF', 'CONTROL'],
    unlockCost: { 'ley-slag': 15, 'echo-glass-shard': 4 },
  },
  BLOOD_BOUND_CARAPACE: {
    id: 'BLOOD_BOUND_CARAPACE',
    label: '[ BLOOD-BOUND CARAPACE ]',
    apCost: 1,
    staminaCost: 0,
    hpCostPct: 10,
    description: 'Sacrifice HP — next enemy phase: full damage taken, melee attackers reflect True damage and Fracture.',
    tags: ['KINETIC', 'DEFENSIVE', 'SACRIFICE', 'BUFF'],
    unlockCost: { 'sanguine-ampoule': 3, 'ley-slag': 12 },
  },
  REAVE: {
    id: 'REAVE',
    label: '[ REAVE ]',
    apCost: 1,
    staminaCost: 0,
    staminaCostPct: 15,
    description: 'Line burst through a column — heavy kinetic, shatters 1 armor layer; unarmored targets bleed 2 turns.',
    tags: ['KINETIC', 'RANGED', 'AOE', 'ARMOR_PIERCE', 'DEBUFF'],
    unlockCost: { 'ley-slag': 14, 'encrypted-grid-drive': 1 },
  },
};

export function getAbilityDefinition(id: AegisAbilityId): AegisAbilityDefinition {
  return AEGIS_ABILITY_CATALOG[id];
}

export function getAbilityTags(id: AegisAbilityId): readonly AbilityTag[] {
  return AEGIS_ABILITY_CATALOG[id].tags;
}

export function abilityHasTag(id: AegisAbilityId, tag: AbilityTag): boolean {
  return AEGIS_ABILITY_CATALOG[id].tags.includes(tag);
}
