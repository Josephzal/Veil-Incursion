import type { AegisAbilityId } from '../types/aegisCombat';
import type { BoonEncounterState } from '../types/boonHooks';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import { COMBAT_CHANCE } from '../types/combatChance';
import type { CombatChanceEncounterState } from '../types/combatChance';
import {
  boonMatchesAction,
  hasMutation,
  modifierForAction,
  type MutationCombatModifiers,
} from './boonEngine';
import { getAbilityTags } from './aegisAbilities';

export interface AegisBoonHookContext {
  owned: readonly LeyLineMutationId[];
  mods: MutationCombatModifiers;
  encounter: BoonEncounterState;
  chance: CombatChanceEncounterState;
  log: (msg: string) => void;
  maxSoulAnchor: number;
  runicBrands: number;
  healOperative: (amount: number) => void;
  chargeReserve: (amount: number) => void;
}

export function runOnReserveGenerate(ctx: AegisBoonHookContext, amount: number): void {
  if (amount <= 0 || !hasMutation(ctx.owned, 'UMBRAL_CARAPACE')) return;
  const heal = Math.floor(ctx.maxSoulAnchor * 0.02 * ctx.mods.healMultiplier);
  if (heal <= 0) return;
  ctx.healOperative(heal);
  ctx.log('[UMBRAL CARAPACE] >> Reserve flux — Soul Anchor restored.');
}

export function applyAbyssalResonanceDamage(
  owned: readonly LeyLineMutationId[],
  abilityId: AegisAbilityId | undefined,
  damage: number,
  runicBrands: number,
  mods: MutationCombatModifiers,
): number {
  if (
    damage <= 0
    || runicBrands <= 0
    || modifierForAction(owned, 'ABYSSAL_RESONANCE', abilityId, mods.abyssalResonancePctPerBrand) <= 0
  ) {
    return damage;
  }
  const bonus = runicBrands * mods.abyssalResonancePctPerBrand;
  return Math.floor(damage * (1 + bonus / 100));
}

export function applyVoidResonanceDamage(
  owned: readonly LeyLineMutationId[],
  abilityId: AegisAbilityId | undefined,
  damage: number,
  encounter: BoonEncounterState,
): { damage: number; consumed: boolean } {
  if (
    damage <= 0
    || !encounter.voidResonanceOccultBonus
    || !abilityId
    || !hasMutation(owned, 'VOID_RESONANCE')
    || !getAbilityTags(abilityId).includes('OCCULT')
  ) {
    return { damage, consumed: false };
  }
  encounter.voidResonanceOccultBonus = false;
  return {
    damage: Math.floor(damage * 1.15),
    consumed: true,
  };
}

export function resolveVoidResonanceOnAbilityResolve(
  owned: readonly LeyLineMutationId[],
  abilityId: AegisAbilityId,
  encounter: BoonEncounterState,
  log: (msg: string) => void,
): void {
  const tags = getAbilityTags(abilityId);
  if (!hasMutation(owned, 'VOID_RESONANCE')) {
    encounter.lastActionTags = tags;
    return;
  }
  if (tags.includes('KINETIC')) {
    encounter.voidResonanceKineticPrimed = true;
    encounter.voidResonanceOccultBonus = false;
  } else if (tags.includes('OCCULT') && encounter.voidResonanceKineticPrimed) {
    encounter.voidResonanceOccultBonus = true;
    encounter.voidResonanceKineticPrimed = false;
    log('[VOID RESONANCE] >> Kinetic primed — Occult follow-up +15%.');
  } else if (tags.includes('OCCULT')) {
    encounter.voidResonanceKineticPrimed = false;
  }
  encounter.lastActionTags = tags;
}

export function runOnFracturedKill(ctx: AegisBoonHookContext): void {
  if (ctx.mods.relentlessMomentumReserveGain <= 0) return;
  ctx.chargeReserve(ctx.mods.relentlessMomentumReserveGain);
  ctx.log(`[RELENTLESS MOMENTUM] >> Fractured kill — +${ctx.mods.relentlessMomentumReserveGain}% Reserve.`);
}

export function runOnParryPerfect(ctx: AegisBoonHookContext): void {
  if (hasMutation(ctx.owned, 'PERFECTED_FORM')) {
    const heal = Math.floor(ctx.maxSoulAnchor * 0.1 * ctx.mods.healMultiplier);
    if (heal > 0) {
      ctx.healOperative(heal);
      ctx.log('[PERFECTED FORM] >> Perfect parry — 10% Soul Anchor restored.');
    }
  }
  if (hasMutation(ctx.owned, 'FLAWLESS_CONDUIT')) {
    ctx.encounter.flawlessConduitPending = true;
    ctx.log('[FLAWLESS CONDUIT] >> Perfect parry — +1 AP queued next turn.');
  }
}

export function runOnParryFail(ctx: AegisBoonHookContext): void {
  if (!hasMutation(ctx.owned, 'MASOCISTS_JOY')) return;
  ctx.encounter.masochistBuff = true;
  ctx.log("[MASOCHIST'S JOY] >> Failed parry — next attack empowered.");
}

export function runOnEvadeSuccess(ctx: AegisBoonHookContext): void {
  if (ctx.mods.gridGhostReserveRefundPct > 0) {
    ctx.chargeReserve(ctx.mods.gridGhostReserveRefundPct);
    ctx.log(`[GRID GHOST] >> Evade successful — +${ctx.mods.gridGhostReserveRefundPct}% Reserve.`);
  }
  if (ctx.chance.gridGhostEvadeStacks < COMBAT_CHANCE.GRID_GHOST_MAX_STACKS) {
    ctx.chance.gridGhostEvadeStacks += 1;
    ctx.log(
      `[GRID GHOST] >> +5% evade (${ctx.chance.gridGhostEvadeStacks}/${COMBAT_CHANCE.GRID_GHOST_MAX_STACKS}).`,
    );
  }
}

export function slipstreamMobilityActive(
  owned: readonly LeyLineMutationId[],
  abilityId: AegisAbilityId,
  mods: MutationCombatModifiers,
): boolean {
  return mods.slipstreamReserveCost > 0 && boonMatchesAction(owned, 'SLIPSTREAM', abilityId);
}

/** Phase C: Deep Lungs adds +10% max Reserve on RESTORE resolve — never grants Brands. */
export const DEEP_LUNGS_BONUS_RESERVE_PCT = 10;

export function applyDeepLungsOnRestore(
  owned: readonly LeyLineMutationId[],
  abilityId: AegisAbilityId,
  chargeReserve: (pct: number) => void,
  log: (msg: string) => void,
): void {
  if (!hasMutation(owned, 'DEEP_LUNGS')) return;
  if (!getAbilityTags(abilityId).includes('RESTORE')) return;
  chargeReserve(DEEP_LUNGS_BONUS_RESERVE_PCT);
  log(`[DEEP LUNGS] >> +${DEEP_LUNGS_BONUS_RESERVE_PCT}% Abyssal Reserve.`);
}
