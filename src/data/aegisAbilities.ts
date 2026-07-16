import type { AegisAbilityId, AbilityTag, AbilityUnlockCost } from '../types/aegisCombat';
import type { BrandConsumeMode } from './aegisResourceEngine';

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
  /** Flat Abyssal Reserve % gained on successful resolution. */
  reserveGain?: number;
  /** Runic Brands imprinted on successful resolution. */
  brandsImprinted?: number;
  /** Brands spent when the ability resolves. */
  brandsConsumed?: BrandConsumeMode;
  /** Minimum brands required before cast. */
  requiredBrands?: number;
  /** Minimum Abyssal Reserve % required before cast. */
  minReservePct?: number;
  /** Flat Abyssal Reserve % tithed on cast. */
  reserveCost?: number;
  /** Percent of current Reserve tithed on cast. */
  reserveCostPct?: number;
  /** Fixed kinetic damage (Strike). */
  baseKineticDamage?: number;
  /** Bonus crit chance % (Veil-Piercer). */
  critBonusPct?: number;
}

export const AEGIS_ABILITY_CATALOG: Record<AegisAbilityId, AegisAbilityDefinition> = {
  STRIKE: {
    id: 'STRIKE',
    label: '[ STRIKE ]',
    apCost: 1,
    staminaCost: 0,
    baseKineticDamage: 10,
    reserveGain: 15,
    brandsImprinted: 1,
    description: '10 kinetic damage. Strips 1 Kinetic Armor. +15% Abyssal Reserve. +1 Runic Brand. Concussed if fracture >50%. Counters: Guard, Heavy Attack (armor break). Riposte Ready: +30% vs Fractured + strip armor.',
    tags: ['KINETIC', 'MELEE', 'FRACTURE', 'ARMOR_BREAK', 'DEBUFF', 'GUARD_BREAK'],
    unlockCost: {},
  },
  RUIN: {
    id: 'RUIN',
    label: '[ RUIN ]',
    apCost: 2,
    staminaCost: 0,
    brandsConsumed: 'ALL',
    description: 'Consume all Brands — full 2×2 grid AoE (front + back). +30 fracture per Brand. 3 Brands + Concussed = fracture stun. Counters: Guard.',
    tags: ['KINETIC', 'AOE', 'FRACTURE', 'CONTROL', 'GUARD_BREAK'],
    unlockCost: { 'ley-slag': 15 },
  },
  WRAITH_PARRY: {
    id: 'WRAITH_PARRY',
    label: '[ VOID WARD ]',
    apCost: 1,
    staminaCost: 0,
    description: 'Prime Void Ward Shroud — perfect kinetic parry reflects fracture, +25% Reserve, +1 Brand. Counters: Heavy Attack, Lock-On.',
    tags: ['KINETIC', 'DEFENSIVE', 'MELEE', 'FRACTURE', 'PARRY', 'BLOCK'],
    unlockCost: { 'ley-slag': 10, 'sanguine-ampoule': 2 },
  },
  GRAVE_BIND: {
    id: 'GRAVE_BIND',
    label: '[ GRAVE BIND ]',
    apCost: 1,
    staminaCost: 0,
    reserveCost: 10,
    description: 'Pull backline target to melee. Exposed — defense halved. Counters: Guard (pulls protected backline).',
    tags: ['OCCULT', 'RANGED', 'CONTROL', 'DEBUFF', 'GUARD_BREAK', 'INTERRUPT'],
    unlockCost: { 'ley-slag': 12, 'echo-glass-shard': 3 },
  },
  SHADOW_STEP: {
    id: 'SHADOW_STEP',
    label: '[ SHADOW STEP ]',
    apCost: 0,
    staminaCost: 0,
    reserveCostPct: 30,
    description: 'Teleport shoulder-check. Massive fracture. End turn to seize initiative.',
    tags: ['OCCULT', 'MOBILITY', 'MELEE', 'FRACTURE', 'BUFF'],
    unlockCost: { 'ley-slag': 20, 'echo-glass-shard': 5 },
  },
  VEIL_PIERCER: {
    id: 'VEIL_PIERCER',
    label: '[ VEIL-PIERCER ]',
    apCost: 1,
    staminaCost: 0,
    reserveGain: 20,
    brandsImprinted: 1,
    critBonusPct: 15,
    description: 'Occult strike — armor pierce, +15% crit. +20% Reserve. +1 Runic Brand.',
    tags: ['OCCULT', 'MELEE', 'ARMOR_PIERCE'],
    unlockCost: { 'encrypted-grid-drive': 1 },
  },
  ASHEN_MANTLE: {
    id: 'ASHEN_MANTLE',
    label: '[ ASHEN MANTLE ]',
    apCost: 2,
    staminaCost: 0,
    brandsConsumed: 'ALL',
    description: 'Consume all Brands — 50% damage reduction for 1 turn (+1 turn per Brand). Attackers gain Doomed.',
    tags: ['OCCULT', 'DEFENSIVE', 'DEBUFF'],
    unlockCost: { 'ley-slag': 8, 'sanguine-ampoule': 1 },
  },
  NAIL_TO_GRID: {
    id: 'NAIL_TO_GRID',
    label: '[ NAIL TO GRID ]',
    apCost: 1,
    staminaCost: 0,
    reserveCost: 8,
    description: 'Pin target shadow — enemy loses 1 AP. Doomed spreads to adjacents.',
    tags: ['OCCULT', 'RANGED', 'DEBUFF', 'CONTROL'],
    unlockCost: { 'ley-slag': 10, 'echo-glass-shard': 4 },
  },
  BLOOD_TITHE: {
    id: 'BLOOD_TITHE',
    label: '[ BLOOD-TITHE ]',
    apCost: 2,
    staminaCost: 0,
    minReservePct: 30,
    brandsConsumed: 'ALL',
    description: 'Requires 30% Reserve — tithe Reserve to heal 3% HP per 10 AR. Occult damage ×1.5 per Brand spent.',
    tags: ['OCCULT', 'MELEE', 'RESTORE'],
    unlockCost: { 'sanguine-ampoule': 3, 'ley-slag': 10 },
  },
  DEMONS_LUNG: {
    id: 'DEMONS_LUNG',
    label: "[ DEMON'S LUNG ]",
    apCost: 0,
    staminaCost: 0,
    cooldownTurns: 3,
    reserveGain: 30,
    description: "+30% Reserve, Overcharged, +1 AP next turn. Cooldown −1 on critical hit.",
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
    apCost: 0,
    staminaCost: 0,
    requiresFullAbyssal: true,
    description: 'Ultimate at 100% Reserve — 0 AP. Flush Reserve. 3-slice true damage. Sunder armor on survivors.',
    tags: ['ULTIMATE', 'TRUE_DAMAGE', 'MELEE', 'DEBUFF'],
    unlockCost: { 'anomalous-core': 1, 'ossified-ley-knot': 1 },
  },
  DEVASTATE: {
    id: 'DEVASTATE',
    label: '[ DEVASTATE ]',
    apCost: 1,
    staminaCost: 0,
    requiredBrands: 3,
    brandsConsumed: 3,
    description: 'Requires 3 Brands — detonates 100% of target fracture as True damage.',
    tags: ['KINETIC', 'MELEE', 'TRUE_DAMAGE', 'CONTROL', 'FRACTURE'],
    unlockCost: { 'ley-slag': 18 },
  },
  ABYSSAL_FAULT: {
    id: 'ABYSSAL_FAULT',
    label: '[ ABYSSAL FAULT ]',
    apCost: 2,
    staminaCost: 0,
    reserveCost: 22,
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
    reserveCostPct: 15,
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
