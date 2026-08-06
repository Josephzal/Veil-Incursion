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
  /** Flat Abyssal Reserve % gained on successful resolution (effect, not activation cost). */
  reserveGain?: number;
  /** @deprecated Techniques must not imprint Brands (Phase C). */
  brandsImprinted?: number;
  /** Brands spent at commitment. */
  brandsConsumed?: BrandConsumeMode;
  /** Minimum brands required before cast. */
  requiredBrands?: number;
  /** @deprecated Technique activation Reserve costs removed in Phase C. */
  minReservePct?: number;
  /** @deprecated Technique activation Reserve costs removed in Phase C. */
  reserveCost?: number;
  /** @deprecated Technique activation Reserve costs removed in Phase C. */
  reserveCostPct?: number;
  /** Fixed kinetic damage (legacy Strike). */
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
    description: 'Legacy kinetic melee identity. Brands are generated only by weapon-mastery conditions — not by this action.',
    tags: ['STRIKE', 'KINETIC', 'MELEE', 'FRACTURE', 'ARMOR_BREAK', 'DEBUFF', 'GUARD_BREAK'],
    unlockCost: {},
  },
  RUIN: {
    id: 'RUIN',
    label: '[ RUIN ]',
    apCost: 2,
    staminaCost: 0,
    requiredBrands: 1,
    brandsConsumed: 'ALL',
    description: 'Spend all Brands (min 1) — full 2×2 grid AoE. Fracture 20 + 30 per Brand, then 12 Kinetic. 3 Brands + Concussed = instant Fractured.',
    tags: ['KINETIC', 'AOE', 'FRACTURE', 'CONTROL', 'GUARD_BREAK'],
    unlockCost: { 'ley-slag': 15 },
  },
  WRAITH_PARRY: {
    id: 'WRAITH_PARRY',
    label: '[ VOID WARD ]',
    apCost: 1,
    staminaCost: 0,
    description: 'Prime for next enemy attack. Perfect Parry grants riposte on next strike. Counters: Heavy Attack, Lock-On.',
    tags: ['KINETIC', 'DEFENSIVE', 'MELEE', 'FRACTURE', 'PARRY', 'BLOCK'],
    unlockCost: { 'ley-slag': 10, 'sanguine-ampoule': 2 },
  },
  GRAVE_BIND: {
    id: 'GRAVE_BIND',
    label: '[ GRAVE BIND ]',
    apCost: 1,
    staminaCost: 0,
    description: 'Pull backline target to melee. Exposed — defense halved. Counters: Guard (pulls protected backline).',
    tags: ['OCCULT', 'RANGED', 'CONTROL', 'DEBUFF', 'GUARD_BREAK', 'INTERRUPT'],
    unlockCost: { 'ley-slag': 12, 'echo-glass-shard': 3 },
  },
  SHADOW_STEP: {
    id: 'SHADOW_STEP',
    label: '[ SHADOW STEP ]',
    apCost: 1,
    staminaCost: 0,
    description: 'Teleport shoulder-check. Massive fracture. End turn to seize initiative.',
    tags: ['OCCULT', 'MOBILITY', 'MELEE', 'FRACTURE', 'BUFF'],
    unlockCost: { 'ley-slag': 20, 'echo-glass-shard': 5 },
  },
  VEIL_PIERCER: {
    id: 'VEIL_PIERCER',
    label: '[ VEIL-PIERCER ]',
    apCost: 1,
    staminaCost: 0,
    requiredBrands: 1,
    brandsConsumed: 1,
    reserveGain: 20,
    /** Display mirror of COMBAT_CHANCE.VEIL_PIERCER_CRIT_BONUS (0.10 → 10). */
    critBonusPct: 10,
    description: 'Spend 1 Brand — Occult pierce (ignore Armor/Ward), +15 Fracture, +10% crit. On hit: +20% Reserve.',
    tags: ['OCCULT', 'MELEE', 'ARMOR_PIERCE'],
    unlockCost: { 'encrypted-grid-drive': 1 },
  },
  ASHEN_MANTLE: {
    id: 'ASHEN_MANTLE',
    label: '[ ASHEN MANTLE ]',
    apCost: 2,
    staminaCost: 0,
    description: '50% damage reduction through the next enemy phase. Eligible attackers become Doomed. Expires at the start of your next turn.',
    tags: ['OCCULT', 'DEFENSIVE', 'DEBUFF'],
    unlockCost: { 'ley-slag': 8, 'sanguine-ampoule': 1 },
  },
  NAIL_TO_GRID: {
    id: 'NAIL_TO_GRID',
    label: '[ NAIL TO GRID ]',
    apCost: 1,
    staminaCost: 0,
    description: 'Pin target shadow — enemy loses 1 AP. Doomed spreads to adjacents.',
    tags: ['OCCULT', 'RANGED', 'DEBUFF', 'CONTROL'],
    unlockCost: { 'ley-slag': 10, 'echo-glass-shard': 4 },
  },
  DEMONS_LUNG: {
    id: 'DEMONS_LUNG',
    label: "[ DEMON'S LUNG ]",
    apCost: 0,
    staminaCost: 0,
    requiredBrands: 1,
    brandsConsumed: 1,
    cooldownTurns: 3,
    reserveGain: 30,
    description: 'Spend 1 Brand — +30% Reserve, Overcharged, +1 AP next turn. 3-turn cooldown.',
    tags: ['RESTORE', 'BUFF'],
    unlockCost: { 'ley-slag': 10 },
  },
  CRIMSON_PACT: {
    id: 'CRIMSON_PACT',
    label: '[ CRIMSON PACT ]',
    apCost: 1,
    staminaCost: 0,
    requiredBrands: 1,
    brandsConsumed: 1,
    hpCostPct: 12,
    description: 'Spend 1 Brand and 12% HP — gain two guaranteed-critical charges (one per authored attack).',
    tags: ['OCCULT', 'SACRIFICE', 'BUFF'],
    unlockCost: { 'sanguine-ampoule': 4, 'ley-slag': 12 },
  },
  EVISCERATE: {
    id: 'EVISCERATE',
    label: '[ ABYSSAL VERDICT ]',
    apCost: 0,
    staminaCost: 0,
    requiresFullAbyssal: true,
    description: 'Longsword ultimate at 100% Reserve — 0 AP. Flush Reserve. True-damage brand. Sunder armor on survivors.',
    tags: ['ULTIMATE', 'TRUE_DAMAGE', 'MELEE', 'DEBUFF', 'EXECUTE', 'FINISHER'],
    unlockCost: { 'anomalous-core': 1, 'ossified-ley-knot': 1 },
  },
  DEVASTATE: {
    id: 'DEVASTATE',
    label: '[ DEVASTATE ]',
    apCost: 1,
    staminaCost: 0,
    requiredBrands: 3,
    brandsConsumed: 3,
    description: 'Spend 3 Brands — target must be Fractured. 4 Kinetic, then True damage equal to the target’s Fracture threshold (minimum 8), then clear Fractured.',
    tags: ['KINETIC', 'MELEE', 'TRUE_DAMAGE', 'CONTROL', 'FRACTURE', 'EXECUTE'],
    unlockCost: { 'ley-slag': 18 },
  },
  RUNEBOUND_CARAPACE: {
    id: 'RUNEBOUND_CARAPACE',
    label: '[ RUNEBOUND CARAPACE ]',
    apCost: 1,
    staminaCost: 0,
    description: 'Arm a carapace until your next turn. After the first blockable melee hit that damages you, reflect 12 True and 24 Fracture once, then consume.',
    tags: ['KINETIC', 'DEFENSIVE', 'BUFF'],
    unlockCost: {},
  },
  FINAL_MERCY: {
    id: 'FINAL_MERCY',
    label: '[ FINAL MERCY ]',
    apCost: 1,
    staminaCost: 0,
    requiredBrands: 2,
    brandsConsumed: 2,
    description: 'Spend 2 Brands — execute a foe at ≤25% HP for True damage equal to remaining HP (bosses: 36 True). Kill heals 10% max HP. No accuracy check.',
    tags: ['KINETIC', 'MELEE', 'EXECUTE', 'TRUE_DAMAGE'],
    unlockCost: {},
  },
  REAVE: {
    id: 'REAVE',
    label: '[ REAVE ]',
    apCost: 2,
    staminaCost: 0,
    description: 'Column burst — heavy kinetic, shatters 1 armor layer; unarmored targets bleed 2 turns. +12 Fracture per hit.',
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

/** Retired technique IDs — migration inputs only; never playable. */
export const RETIRED_AEGIS_TECHNIQUE_IDS = [
  'BLOOD_TITHE',
  'ABYSSAL_FAULT',
  'BLOOD_BOUND_CARAPACE',
] as const;

export function isRetiredAegisTechniqueId(id: string): boolean {
  return (RETIRED_AEGIS_TECHNIQUE_IDS as readonly string[]).includes(id);
}
