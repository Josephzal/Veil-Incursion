/**
 * E.4 — Canonical Envoy weapon-action execution.
 * Action 1 consolidates live resolveEnvoySplinterBasic behavior.
 * Hub must not mount Actions 2–4 on the player deck until E.5.
 */
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnvoyWeaponActionId } from '../types/envoyWeaponAction';
import type { EnemyCombatProfile } from '../types/run';
import type { ResolvedWeaponState, WeaponRuntimeState } from '../types/weapon';
import type { CombatSessionExtras } from '../types/combatHooks';
import { getUnitById, isUnitAlive } from './combatSquadEngine';
import { stripOccultWards } from './combatDefenseLayerEngine';
import {
  addVeilRotStacks,
  consumeVeilRotStacks,
  infectVeilRot,
} from './envoyRotEngine';
import {
  armSanguineExposure,
  armSmokeArcAccuracyDown,
  consumeSanguineExposure,
} from './envoySanguineExposureEngine';
import {
  resolveEnvoyCatalystCast,
  type EnvoyCatalystCastResult,
} from './envoyCatalystCastEngine';
import {
  planEnvoyWeaponAction,
  type EnvoyWeaponActionPlan,
  type EnvoyWeaponActionPlanResult,
} from './envoyWeaponActionPlanEngine';
import { canonicalizeEnvoyCombatActionId } from './envoyCombatCompatibility';
import {
  isEnvoyWeaponActionId,
  isEnvoyWeaponFamilyId,
  type EnvoyWeaponFamilyId,
} from './envoyWeaponActionRegistry';
import { resolveClassWardenInterceptTarget } from './combatClassTargeting';
import {
  runWeaponOnDebuffAppliedHooks,
  runWeaponOnOccultCastHooks,
  runWeaponOnSacrificeHpHooks,
} from './weaponCombatEngine';
import type { WeaponFamilyId } from '../types/weapon';
import type { ClassGraftCastPlan } from '../types/classGraft';
import { readUniversalUpgradeValue } from './universalGraftRegistry';

export interface EnvoyWeaponActionHurtOptions {
  channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  targetId?: string;
  abilityId?: string;
  rollCrit?: boolean;
  indirectDamage?: boolean;
  /** Blocks recursive WA hook re-entry. */
  derivative?: boolean;
}

export interface EnvoyWeaponActionExecutionContext {
  actionId: string;
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId;
  squad: EnemyCombatProfile[];
  targetId: string | null;
  secondaryTargetId?: string | null;
  veilFlux: number;
  maxHp: number;
  operativeHp: number;
  classState: ClassCombatEncounterState;
  log: (msg: string) => void;
  resolvedWeapon: ResolvedWeaponState | null;
  weaponRuntime?: WeaponRuntimeState;
  sessionExtras?: CombatSessionExtras;
  historicalSourceId?: string | null;
  spendStamina: (cost: number) => boolean;
  applyHpSacrifice?: (amount: number) => void;
  applyVeilFluxBonus?: (delta: number) => void;
  applyWeaponRuntimePatch?: (patch: Partial<WeaponRuntimeState>) => void;
  hurtEnemy: (
    raw: number,
    tag: string,
    options?: EnvoyWeaponActionHurtOptions,
    targetId?: string,
  ) => boolean;
  patchUnit: (unitId: string, patch: Partial<EnemyCombatProfile>) => void;
  healOperative: (amount: number) => void;
  applyPlayerShield?: (amount: number) => void;
  /** When false, caller handles Catalyst (legacy Hub flex path). Default true for WA. */
  resolveCatalyst?: boolean;
  graftPlan?: ClassGraftCastPlan | null;
}

export type EnvoyWeaponActionExecutionResult =
  | {
      ok: true;
      plan: EnvoyWeaponActionPlan;
      fluxDelta: number;
      provenanceActionId: EnvoyWeaponActionId;
      historicalSourceId: string | null;
      catalyst: EnvoyCatalystCastResult | null;
    }
  | {
      ok: false;
      reason: string;
      refundAp: number;
      message: string;
    };

function resolveTarget(
  squad: EnemyCombatProfile[],
  familyId: string,
  actionId: string,
  targetId: string,
): EnemyCombatProfile & { unitId: string } | null {
  const raw = getUnitById(squad, targetId);
  if (!raw?.unitId || !isUnitAlive(raw)) return null;
  const resolvedId = resolveClassWardenInterceptTarget(squad, 'ENVOY', actionId, raw.unitId);
  const resolved = getUnitById(squad, resolvedId);
  return resolved?.unitId
    ? (resolved as EnemyCombatProfile & { unitId: string })
    : (raw as EnemyCombatProfile & { unitId: string });
}

export function planEnvoyWeaponActionFromContext(
  ctx: EnvoyWeaponActionExecutionContext,
): EnvoyWeaponActionPlanResult {
  let actionId = ctx.actionId;
  let historical = ctx.historicalSourceId ?? null;
  if (!isEnvoyWeaponActionId(actionId)) {
    const canon = canonicalizeEnvoyCombatActionId(actionId, ctx.familyId);
    if (canon.kind !== 'WEAPON_ACTION' || !isEnvoyWeaponActionId(canon.canonicalId)) {
      return {
        ok: false,
        reason: 'UNKNOWN_ACTION',
        message: `Not a weapon action: ${actionId}`,
        apCost: 0,
      };
    }
    historical = canon.historicalSourceId;
    actionId = canon.canonicalId;
  }
  return planEnvoyWeaponAction({
    actionId: actionId as EnvoyWeaponActionId,
    familyId: ctx.familyId,
    classState: ctx.classState,
    squad: ctx.squad,
    targetId: ctx.targetId,
    secondaryTargetId: ctx.secondaryTargetId,
    veilFlux: ctx.veilFlux,
    operativeHp: ctx.operativeHp,
    maxHp: ctx.maxHp,
    resolvedWeapon: ctx.resolvedWeapon,
    previousCatalystForCleanCycle: ctx.classState.currentCatalyst ?? null,
  });
}

export function executeEnvoyWeaponAction(
  ctx: EnvoyWeaponActionExecutionContext,
): EnvoyWeaponActionExecutionResult {
  const canon = canonicalizeEnvoyCombatActionId(ctx.actionId, ctx.familyId);
  if (canon.kind === 'ULTIMATE_COMPAT') {
    return {
      ok: false,
      reason: 'ULTIMATE_COMPAT',
      refundAp: 0,
      message: 'CATACLYSM_SIGIL is Ultimate compatibility only.',
    };
  }
  if (canon.kind !== 'WEAPON_ACTION' || !isEnvoyWeaponActionId(canon.canonicalId)) {
    return {
      ok: false,
      reason: 'NOT_WEAPON_ACTION',
      refundAp: 0,
      message: `Rejected non-weapon-action ingress: ${ctx.actionId}`,
    };
  }
  if (!isEnvoyWeaponFamilyId(ctx.familyId)) {
    return {
      ok: false,
      reason: 'UNKNOWN_FAMILY',
      refundAp: 0,
      message: `Unknown Envoy family: ${String(ctx.familyId)}`,
    };
  }

  const planned = planEnvoyWeaponAction({
    actionId: canon.canonicalId,
    familyId: ctx.familyId,
    classState: ctx.classState,
    squad: ctx.squad,
    targetId: ctx.targetId,
    secondaryTargetId: ctx.secondaryTargetId,
    veilFlux: ctx.veilFlux,
    operativeHp: ctx.operativeHp,
    maxHp: ctx.maxHp,
    resolvedWeapon: ctx.resolvedWeapon,
    previousCatalystForCleanCycle: ctx.classState.currentCatalyst ?? null,
  });

  if (!planned.ok) {
    return {
      ok: false,
      reason: planned.reason,
      refundAp: planned.apCost,
      message: planned.message,
    };
  }

  const plan = planned;
  if (plan.staminaCost > 0 && !ctx.spendStamina(plan.staminaCost)) {
    ctx.log('[REJECTED] >> Insufficient stamina.');
    return {
      ok: false,
      reason: 'INSUFFICIENT_STAMINA',
      refundAp: plan.apCost,
      message: 'Insufficient stamina.',
    };
  }

  // Resource commitment: HP sacrifice once.
  if (plan.hpSacrifice > 0) {
    ctx.applyHpSacrifice?.(plan.hpSacrifice);
  }

  plan.logLines.forEach((line) => ctx.log(line));

  // Authored damage; WA Actions 2–4 apply Catalyst amp; Action1 matches live (no retro amp).
  let damage = plan.authoredOccultDamage;
  const shouldResolveCatalyst = ctx.resolveCatalyst !== false;
  if (shouldResolveCatalyst && !plan.action1Plan) {
    const bonus = plan.catalystPreview.payoff?.damageBonusPercent;
    if (bonus) {
      damage = Math.floor(damage * (1 + bonus / 100));
    }
  }

  // Grave Transfer damages destination; others use primary source.
  const primaryId = plan.actionId === 'GRAVE_TRANSFER'
    ? plan.destUnitId
    : plan.sourceUnitId;
  let primary = primaryId
    ? resolveTarget(ctx.squad, ctx.familyId, plan.actionId, primaryId)
    : null;

  // Ward strip once.
  if (plan.wardStrip > 0 && primary?.unitId) {
    const stripped = stripOccultWards(primary, plan.wardStrip);
    ctx.patchUnit(primary.unitId, stripped.enemy);
    primary = { ...stripped.enemy, unitId: primary.unitId };
  }

  // Rot transfer (Grave Transfer) before damage.
  if (plan.rotTransfer > 0 && plan.sourceUnitId && plan.destUnitId) {
    const moved = Math.min(
      plan.rotTransfer,
      ctx.classState.veilRotStacks[plan.sourceUnitId] ?? 0,
    );
    if (moved > 0) {
      consumeVeilRotStacks(ctx.classState, plan.sourceUnitId, moved);
      addVeilRotStacks(ctx.classState, plan.destUnitId, moved);
      ctx.log(
        `>> [VEIL ROT] — transferred ${moved} stack${moved === 1 ? '' : 's'} → destination.`,
      );
    }
  }

  // Rot consume (Knell) before damage packet.
  if (plan.rotConsume > 0 && plan.sourceUnitId) {
    consumeVeilRotStacks(ctx.classState, plan.sourceUnitId, plan.rotConsume);
  }

  let catalyst: EnvoyCatalystCastResult | null = null;

  // Deliver damage / self effects.
  if (plan.actionId === 'CRIMSON_VENT') {
    if (plan.selfHeal > 0) ctx.healOperative(plan.selfHeal);
  } else if (primary?.unitId && damage > 0) {
    const tag = `[ ${plan.def.displayName.toUpperCase()} ]`;
    ctx.hurtEnemy(
      damage,
      tag,
      {
        channel: 'OCCULT',
        abilityId: plan.provenanceActionId,
        targetId: primary.unitId,
      },
      primary.unitId,
    );
  }

  // Rot apply (not transfer/consume).
  if (plan.rotApply > 0 && primary?.unitId) {
    infectVeilRot(ctx.classState, primary, plan.rotApply, ctx.log);
  }

  // Status / family state.
  if (plan.apDrain > 0 && primary?.unitId) {
    ctx.classState.enemyApDrainNextTurn[primary.unitId] = plan.apDrain;
  }
  if (plan.armSanguineExposure && primary?.unitId) {
    armSanguineExposure(ctx.classState, primary.unitId);
  }
  if (plan.consumeSanguineExposure && primary?.unitId) {
    consumeSanguineExposure(ctx.classState, primary.unitId);
  }
  if (plan.smokeArcAccuracyDown && primary?.unitId) {
    armSmokeArcAccuracyDown(ctx.classState, primary.unitId);
  }

  // Catalyst prime + payoff (once).
  if (shouldResolveCatalyst && plan.catalystPrime) {
    const cat = resolveEnvoyCatalystCast({
      classState: ctx.classState,
      prime: plan.catalystPrime,
      target: primary,
      originActionId: plan.provenanceActionId,
      historicalSourceId: canon.historicalSourceId ?? ctx.historicalSourceId ?? null,
      applyTargetPayoff: true,
    });
    catalyst = cat;
    cat.payoff?.logMessages.forEach((m) => ctx.log(`[CATALYST] >> ${m}`));
    if (cat.patchedTarget?.unitId) {
      ctx.patchUnit(cat.patchedTarget.unitId, cat.patchedTarget);
    }
    if (cat.payoff?.healAmount) ctx.healOperative(cat.payoff.healAmount);
    if (cat.payoff?.shieldAmount) ctx.applyPlayerShield?.(cat.payoff.shieldAmount);
  }

  // Weapon hooks (Action1 parity + Claim sacrifice).
  if (ctx.resolvedWeapon && ctx.weaponRuntime) {
    const makeHookCtx = () => ({
      weapon: ctx.resolvedWeapon!,
      runtime: ctx.weaponRuntime!,
      blueprintId: null,
      player: {
        hp: ctx.operativeHp,
        maxHp: ctx.maxHp,
        shield: ctx.sessionExtras?.playerShield ?? 0,
        shieldTurnsRemaining: ctx.sessionExtras?.playerShieldTurnsRemaining ?? 0,
        debuffs: [...(ctx.sessionExtras?.playerDebuffs ?? [])],
      },
      squad: ctx.squad,
    });
    if (plan.invokeOccultCastHook) {
      const occultHooks = runWeaponOnOccultCastHooks(makeHookCtx());
      occultHooks.logLines.forEach((line) => ctx.log(line));
      if (occultHooks.runtimePatch) {
        ctx.applyWeaponRuntimePatch?.(occultHooks.runtimePatch);
        Object.assign(ctx.weaponRuntime, occultHooks.runtimePatch);
      }
      if (occultHooks.veilFluxDelta) ctx.applyVeilFluxBonus?.(occultHooks.veilFluxDelta);
    }
    if (plan.invokeSacrificeHook) {
      const sacHooks = runWeaponOnSacrificeHpHooks(makeHookCtx());
      sacHooks.logLines.forEach((line) => ctx.log(line));
      if (sacHooks.runtimePatch) {
        ctx.applyWeaponRuntimePatch?.(sacHooks.runtimePatch);
        Object.assign(ctx.weaponRuntime, sacHooks.runtimePatch);
      }
      if (sacHooks.veilFluxDelta) ctx.applyVeilFluxBonus?.(sacHooks.veilFluxDelta);
    }
    if (plan.invokeDebuffHook && ctx.sessionExtras) {
      const debuffHooks = runWeaponOnDebuffAppliedHooks(makeHookCtx(), ctx.sessionExtras);
      debuffHooks.logLines.forEach((line) => ctx.log(line));
      if (debuffHooks.runtimePatch) {
        ctx.applyWeaponRuntimePatch?.(debuffHooks.runtimePatch);
        Object.assign(ctx.weaponRuntime, debuffHooks.runtimePatch);
      }
    }
  }

  return {
    ok: true,
    plan,
    fluxDelta: plan.actionId === 'CRIMSON_VENT'
      ? readUniversalUpgradeValue(ctx.graftPlan, 'RESOURCE_GAIN', plan.fluxDelta)
      : plan.fluxDelta,
    provenanceActionId: plan.provenanceActionId,
    historicalSourceId: canon.historicalSourceId ?? ctx.historicalSourceId ?? null,
    catalyst,
  };
}

/**
 * Compatibility entry for legacy VEIL_SPLINTER / BLACK_WICK / Action1 IDs.
 * Used by executeEnvoyAbility consolidation.
 * Catalyst remains caller-owned (Hub cast facade) for live flex/Action1 parity.
 */
export function executeEnvoyActionOneFromCompat(
  ctx: Omit<EnvoyWeaponActionExecutionContext, 'actionId'> & {
    ingressId: string;
  },
): EnvoyWeaponActionExecutionResult {
  return executeEnvoyWeaponAction({
    ...ctx,
    actionId: ctx.ingressId,
    resolveCatalyst: false,
  });
}
