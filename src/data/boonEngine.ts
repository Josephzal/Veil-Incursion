import { getAbilityTags } from './aegisAbilities';
import type { AegisAbilityId, AbilityTag } from '../types/aegisCombat';
import type { BoonActionContext, BoonHook, BoonRule } from '../types/boonHooks';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import { COMBAT_ACTION } from '../types/run';
import { hasCombatTag, isEnemyFractured } from './combatFractureEngine';
import type { EnemyCombatProfile } from '../types/run';

export type { BoonHook, BoonRule, BoonActionContext, BoonEncounterState } from '../types/boonHooks';
export { createDefaultBoonEncounterState } from '../types/boonHooks';

/** Tag-based boon registry — combat checks action.tags, not ability names. */
export const BOON_RULES: Record<LeyLineMutationId, BoonRule> = {
  SHARPENED: {
    id: 'SHARPENED',
    hook: 'onDamageDeal',
    tagAll: ['MELEE'],
    trigger: 'MELEE // pierce 1 kinetic armor',
  },
  VENOMOUS_RUIN: {
    id: 'VENOMOUS_RUIN',
    hook: 'onAbilityResolve',
    tagAll: ['AOE'],
    trigger: 'AOE // lingering fracture hazard',
  },
  SPIKED_WARD: {
    id: 'SPIKED_WARD',
    hook: 'onDefensiveSuccess',
    tagAll: ['DEFENSIVE'],
    trigger: 'DEFENSIVE // 50% reflect blocked damage',
  },
  RELENTLESS_MOMENTUM: {
    id: 'RELENTLESS_MOMENTUM',
    hook: 'onKill',
    trigger: 'Target FRACTURED // +25% Abyssal Reserve',
  },
  HEAVY_CALIBER: {
    id: 'HEAVY_CALIBER',
    hook: 'onAbilityResolve',
    tagAll: ['CONTROL'],
    trigger: 'CONTROL // +15 kinetic on displacement',
  },
  JUGGERNAUT_PLATING: {
    id: 'JUGGERNAUT_PLATING',
    hook: 'onAbilityResolve',
    tagAll: ['MOBILITY'],
    trigger: 'MOBILITY // 1-hit physical shield',
  },
  SHATTER_POINT: {
    id: 'SHATTER_POINT',
    hook: 'onDamageDeal',
    trigger: 'Target FRACTURED // +20% crit chance',
  },
  ADRENALINE_SPIKE: {
    id: 'ADRENALINE_SPIKE',
    hook: 'onTakeDamage',
    trigger: 'Damage past shields // +1 AP (1×/turn)',
  },
  ABYSSAL_RESONANCE: {
    id: 'ABYSSAL_RESONANCE',
    hook: 'onDamageDeal',
    tagAll: ['KINETIC'],
    trigger: 'KINETIC // +5% dmg per Runic Brand',
  },
  EXECUTIONERS_GRIP: {
    id: 'EXECUTIONERS_GRIP',
    hook: 'onAbilityResolve',
    tagAll: ['CONTROL'],
    trigger: 'CONTROL // shred 1 kinetic armor on expose/displace',
  },
  BLACK_LIGHT_SIPHON: {
    id: 'BLACK_LIGHT_SIPHON',
    hook: 'onAbilityResolve',
    tagAll: ['OCCULT', 'RESTORE'],
    trigger: 'OCCULT + RESTORE // heal per reserve consumed',
  },
  VOID_CONTAGION: {
    id: 'VOID_CONTAGION',
    hook: 'onTurnStart',
    trigger: 'Target DOOMED // occult pulse',
  },
  EVENT_HORIZON: {
    id: 'EVENT_HORIZON',
    hook: 'onAbilityResolve',
    tagAll: ['DEBUFF'],
    trigger: 'DEBUFF // drain target stamina',
  },
  ABYSSAL_OVERFLOW: {
    id: 'ABYSSAL_OVERFLOW',
    hook: 'passive',
    trigger: 'Passive // 150% reserve cap',
  },
  REACTIVE_WARDS: {
    id: 'REACTIVE_WARDS',
    hook: 'passive',
    tagAll: ['DEFENSIVE', 'OCCULT'],
    trigger: 'DEFENSIVE + OCCULT // 0 AP, 3-turn CD',
  },
  PHANTOM_STRIKES: {
    id: 'PHANTOM_STRIKES',
    hook: 'onCriticalHit',
    trigger: 'Critical hit // 50% echo to random target',
  },
  CORRUPTED_BLOOD: {
    id: 'CORRUPTED_BLOOD',
    hook: 'onAbilityResolve',
    tagAll: ['ULTIMATE'],
    trigger: 'ULTIMATE survivor // void bleed',
  },
  UMBRAL_CARAPACE: {
    id: 'UMBRAL_CARAPACE',
    hook: 'onReserveGenerate',
    trigger: 'Reserve generated // heal 2% HP',
  },
  NULL_ZONE: {
    id: 'NULL_ZONE',
    hook: 'onTakeDamage',
    tagAll: ['DEFENSIVE'],
    trigger: 'DEFENSIVE active // attacker −10% max HP',
  },
  ECHOING_VOID: {
    id: 'ECHOING_VOID',
    hook: 'passive',
    tagAll: ['OCCULT', 'MELEE'],
    trigger: 'OCCULT + MELEE // free reserve, +1 AP cost',
  },
  DEEP_LUNGS: {
    id: 'DEEP_LUNGS',
    hook: 'onAbilityResolve',
    tagAll: ['RESTORE'],
    trigger: 'RESTORE // surge Runic Brands to 3',
  },
  BLOOD_PRICE: {
    id: 'BLOOD_PRICE',
    hook: 'onAbilityResolve',
    tagAll: ['SACRIFICE'],
    trigger: 'SACRIFICE // −66% HP cost',
  },
  SECOND_WIND: {
    id: 'SECOND_WIND',
    hook: 'onTakeDamage',
    trigger: 'Below 10% HP // full Reserve +2 AP (1×/encounter)',
  },
  LEY_LINE_TAP: {
    id: 'LEY_LINE_TAP',
    hook: 'onEncounterStart',
    trigger: 'Combat entry // 50% reserve',
  },
  HYPER_METABOLISM: {
    id: 'HYPER_METABOLISM',
    hook: 'passive',
    trigger: 'Passive // +50% heal, −25% max HP',
  },
  UNSTOPPABLE_FORCE: {
    id: 'UNSTOPPABLE_FORCE',
    hook: 'onReceiveDebuff',
    trigger: 'First fracture // immune',
  },
  GRID_GHOST: {
    id: 'GRID_GHOST',
    hook: 'onEvadeSuccess',
    trigger: 'Evade success // +20% Reserve + evade stack',
  },
  MASOCISTS_JOY: {
    id: 'MASOCISTS_JOY',
    hook: 'onDefensiveParryFail',
    tagAll: ['DEFENSIVE'],
    trigger: 'Failed parry // +50% next hit',
  },
  PERFECTED_FORM: {
    id: 'PERFECTED_FORM',
    hook: 'onDefensiveParryPerfect',
    tagAll: ['DEFENSIVE'],
    trigger: 'Perfect parry // heal 10% max HP',
  },
  FINAL_STAND: {
    id: 'FINAL_STAND',
    hook: 'onDamageDeal',
    trigger: '1 AP + 0 stamina // true damage',
  },
  EXECUTIONERS_HIGH: {
    id: 'EXECUTIONERS_HIGH',
    hook: 'onKill',
    tagAll: ['KINETIC'],
    trigger: 'KINETIC kill // +1 AP (1×/turn)',
  },
  FLAWLESS_CONDUIT: {
    id: 'FLAWLESS_CONDUIT',
    hook: 'onDefensiveParryPerfect',
    tagAll: ['DEFENSIVE'],
    trigger: 'Perfect parry // +1 AP next turn',
  },
  BLOOD_FOR_TIME: {
    id: 'BLOOD_FOR_TIME',
    hook: 'passive',
    trigger: '1×/turn // HP → AP',
  },
  MOMENTUM_SHIFT: {
    id: 'MOMENTUM_SHIFT',
    hook: 'onTurnEnd',
    trigger: 'End turn at 0 stamina // +1 AP next turn',
  },
  MOMENTUM_TRANSFER: {
    id: 'MOMENTUM_TRANSFER',
    hook: 'onAbilityResolve',
    tagAll: ['MOBILITY'],
    trigger: 'MOBILITY // next KINETIC −1 AP',
  },
  ABYSSAL_ERUPTION: {
    id: 'ABYSSAL_ERUPTION',
    hook: 'onDamageDeal',
    tagAll: ['AOE'],
    trigger: 'AOE per hit // +10 reserve',
  },
  EXECUTIONERS_STRIDE: {
    id: 'EXECUTIONERS_STRIDE',
    hook: 'onDamageDeal',
    tagAll: ['MELEE'],
    trigger: 'MELEE vs EXPOSED // +1 AP',
  },
  SPALL_SHATTER: {
    id: 'SPALL_SHATTER',
    hook: 'onDefensiveSuccess',
    tagAll: ['DEFENSIVE'],
    trigger: 'DEFENSIVE expires // AoE physical burst',
  },
  VOID_RESONANCE: {
    id: 'VOID_RESONANCE',
    hook: 'onDamageDeal',
    trigger: 'OCCULT after KINETIC // +15% damage',
  },
  TAR_TRAPPED: {
    id: 'TAR_TRAPPED',
    hook: 'onDamageDeal',
    tagAll: ['AOE'],
    trigger: 'AOE hit // target cannot evade 2 turns',
  },
  SLIPSTREAM: {
    id: 'SLIPSTREAM',
    hook: 'onAbilityResolve',
    tagAll: ['MOBILITY'],
    trigger: 'MOBILITY // −20% Reserve',
  },
  NECROTIC_ATROPHY: {
    id: 'NECROTIC_ATROPHY',
    hook: 'onAbilityResolve',
    tagAll: ['DEBUFF'],
    trigger: 'DEBUFF // −5% target base damage',
  },
  SUNDER_WEAVE: {
    id: 'SUNDER_WEAVE',
    hook: 'onDamageDeal',
    tagAll: ['MELEE', 'OCCULT'],
    trigger: 'MELEE + OCCULT // shred 1 armor',
  },
  VOIDS_TOLL: {
    id: 'VOIDS_TOLL',
    hook: 'onKill',
    tagAll: ['ULTIMATE'],
    trigger: 'ULTIMATE kill // +1 max AP, −15% max HP',
  },
};

export interface MutationCombatModifiers {
  strikeArmorPierce: number;
  ruinDotFracture: number;
  parryReflectPct: number;
  graveBindDamage: number;
  graveBindArmorShred: number;
  shatterPointCritBonus: number;
  abyssalResonancePctPerBrand: number;
  bloodTitheHealPctPer10Ar: number;
  relentlessMomentumReserveGain: number;
  gridGhostReserveRefundPct: number;
  slipstreamReserveCost: number;
  crimsonPactHpCostPct: number;
  startingAbyssalPercent: number;
  healMultiplier: number;
  maxHpMultiplier: number;
  abyssalCap: number;
  ashenMantleFree: boolean;
  phantomCritSplitPct: number;
  nailApDrain: number;
  bloodTitheFree: boolean;
  bloodTitheCooldown: number;
  voidContagionDamage: number;
  corruptedBloodDamage: number;
  abyssalEruptionPerHit: number;
  eventHorizonStaminaDrain: number;
  necroticAtrophyPct: number;
  sunderWeaveArmorShred: number;
}

export function hasMutation(
  mutations: readonly LeyLineMutationId[],
  id: LeyLineMutationId,
): boolean {
  return mutations.includes(id);
}

export function abilityTagsMatch(
  actionTags: readonly AbilityTag[],
  tagAll?: readonly AbilityTag[],
  tagAny?: readonly AbilityTag[],
): boolean {
  if (tagAll && tagAll.length > 0 && !tagAll.every((tag) => actionTags.includes(tag))) {
    return false;
  }
  if (tagAny && tagAny.length > 0 && !tagAny.some((tag) => actionTags.includes(tag))) {
    return false;
  }
  return true;
}

export function buildBoonActionContext(
  abilityId?: AegisAbilityId,
  extras?: Partial<BoonActionContext>,
): BoonActionContext {
  const actionTags = abilityId ? getAbilityTags(abilityId) : [];
  return {
    abilityId,
    actionTags,
    ...extras,
  };
}

/** Whether an owned boon's tag filter matches the current action. */
export function boonMatchesAction(
  owned: readonly LeyLineMutationId[],
  boonId: LeyLineMutationId,
  abilityId?: AegisAbilityId,
): boolean {
  if (!hasMutation(owned, boonId)) return false;
  const rule = BOON_RULES[boonId];
  if (!rule.tagAll?.length && !rule.tagAny?.length) return true;
  if (!abilityId) return false;
  return abilityTagsMatch(getAbilityTags(abilityId), rule.tagAll, rule.tagAny);
}

export function boonMatchesContext(
  owned: readonly LeyLineMutationId[],
  boonId: LeyLineMutationId,
  ctx: BoonActionContext,
): boolean {
  if (!hasMutation(owned, boonId)) return false;
  const rule = BOON_RULES[boonId];
  if (!rule.tagAll?.length && !rule.tagAny?.length) return true;
  if (ctx.actionTags.length === 0 && !ctx.abilityId) return false;
  const tags = ctx.actionTags.length > 0
    ? ctx.actionTags
    : (ctx.abilityId ? getAbilityTags(ctx.abilityId) : []);
  return abilityTagsMatch(tags, rule.tagAll, rule.tagAny);
}

export function ownedBoonsForHook(
  owned: readonly LeyLineMutationId[],
  hook: BoonHook,
): LeyLineMutationId[] {
  return owned.filter((id) => BOON_RULES[id]?.hook === hook);
}

export function targetIsFractured(target?: EnemyCombatProfile): boolean {
  return target != null && isEnemyFractured(target);
}

export function targetIsExposed(target?: EnemyCombatProfile): boolean {
  return target != null && hasCombatTag(target, 'EXPOSED');
}

/** Aggregate passive numeric modifiers from owned boons. */
export function aggregateMutationModifiers(
  mutations: readonly LeyLineMutationId[],
): MutationCombatModifiers {
  const has = (id: LeyLineMutationId) => hasMutation(mutations, id);
  return {
    strikeArmorPierce: has('SHARPENED') ? 1 : 0,
    ruinDotFracture: has('VENOMOUS_RUIN') ? 10 : 0,
    parryReflectPct: has('SPIKED_WARD') ? 50 : 0,
    graveBindDamage: has('HEAVY_CALIBER') ? 15 : 0,
    graveBindArmorShred: has('EXECUTIONERS_GRIP') ? 1 : 0,
    shatterPointCritBonus: has('SHATTER_POINT') ? 0.20 : 0,
    abyssalResonancePctPerBrand: has('ABYSSAL_RESONANCE') ? 5 : 0,
    bloodTitheHealPctPer10Ar: has('BLACK_LIGHT_SIPHON') ? 3 : 2,
    relentlessMomentumReserveGain: has('RELENTLESS_MOMENTUM') ? 25 : 0,
    gridGhostReserveRefundPct: has('GRID_GHOST') ? 20 : 0,
    slipstreamReserveCost: has('SLIPSTREAM') ? 20 : 0,
    crimsonPactHpCostPct: has('BLOOD_PRICE') ? 5 : 15,
    startingAbyssalPercent: has('LEY_LINE_TAP') ? 50 : 0,
    healMultiplier: has('HYPER_METABOLISM') ? 1.5 : 1,
    maxHpMultiplier: has('HYPER_METABOLISM') ? 0.75 : 1,
    abyssalCap: has('ABYSSAL_OVERFLOW') ? 150 : COMBAT_ACTION.ABYSSAL_RESERVE_CAP,
    ashenMantleFree: has('REACTIVE_WARDS'),
    phantomCritSplitPct: has('PHANTOM_STRIKES') ? 0.5 : 0,
    nailApDrain: has('EVENT_HORIZON') ? 2 : 1,
    bloodTitheFree: has('ECHOING_VOID'),
    bloodTitheCooldown: has('ECHOING_VOID') ? 2 : 0,
    voidContagionDamage: has('VOID_CONTAGION') ? 5 : 0,
    corruptedBloodDamage: has('CORRUPTED_BLOOD') ? 8 : 0,
    abyssalEruptionPerHit: has('ABYSSAL_ERUPTION') ? 10 : 0,
    eventHorizonStaminaDrain: has('EVENT_HORIZON') ? 100 : 0,
    necroticAtrophyPct: has('NECROTIC_ATROPHY') ? 5 : 0,
    sunderWeaveArmorShred: has('SUNDER_WEAVE') ? 1 : 0,
  };
}

/** Resolve modifier value only when the boon matches the action's tags. */
export function modifierForAction(
  owned: readonly LeyLineMutationId[],
  boonId: LeyLineMutationId,
  abilityId: AegisAbilityId | undefined,
  value: number,
): number {
  return boonMatchesAction(owned, boonId, abilityId) ? value : 0;
}

export function applyBoonDamageModifiers(
  owned: readonly LeyLineMutationId[],
  abilityId: AegisAbilityId | undefined,
  baseDamage: number,
  runicBrands: number,
  playerAp: number,
  isFinalStand: boolean,
  voidResonanceBonus: boolean,
): number {
  let dmg = baseDamage;
  const ctx = buildBoonActionContext(abilityId);

  if (boonMatchesContext(owned, 'ABYSSAL_RESONANCE', ctx) && dmg > 0 && runicBrands > 0) {
    const bonus = runicBrands * 5;
    dmg = Math.floor(dmg * (1 + bonus / 100));
  }

  if (hasMutation(owned, 'VOID_RESONANCE') && voidResonanceBonus && dmg > 0) {
    dmg = Math.floor(dmg * 1.15);
  }

  if (
    hasMutation(owned, 'FINAL_STAND')
    && isFinalStand
    && abilityId
    && dmg > 0
  ) {
    // channel upgraded to TRUE upstream
  }

  return dmg;
}

export function getBoonRule(id: LeyLineMutationId): BoonRule {
  return BOON_RULES[id];
}

/** @deprecated Use boonEngine exports — kept for existing imports. */
export { aggregateMutationModifiers as aggregateBoonCombatModifiers };
