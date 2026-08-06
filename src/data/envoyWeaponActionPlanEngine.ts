/**
 * E.4 — Pure Envoy weapon-action plans (no mutation, no RNG).
 * Action 1 plans delegate to resolveEnvoySplinterBasic for live parity.
 */
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { EnvoyWeaponActionId } from '../types/envoyWeaponAction';
import type { EnemyCombatProfile } from '../types/run';
import type { ResolvedWeaponState } from '../types/weapon';
import {
  getEnvoyWeaponActionDefinition,
  type EnvoyWeaponActionDefinition,
} from './envoyWeaponActionCatalog';
import {
  isEnvoyWeaponActionOnEquippedFamily,
  isEnvoyWeaponFamilyId,
  type EnvoyWeaponFamilyId,
} from './envoyWeaponActionRegistry';
import {
  LANTERN_FLUX_PURGE_DAMAGE_PER_EXTRA_ROT,
  PRISM_BASIC_HP_SACRIFICE_MAX,
  PRISM_BASIC_HP_SACRIFICE_PCT,
  PRISM_BRINK_DAMAGE_MULT,
  PRISM_BRINK_FLUX_THRESHOLD,
  PRISM_SACRIFICE_PAYOFF_DAMAGE_MULT,
  resolveEnvoySplinterBasic,
  type EnvoySplinterBasicPlan,
} from './weaponBasicEngine';
import { getVeilRotStacks, VEIL_ROT_STACK_CAP } from './envoyRotEngine';
import { hasSanguineExposure } from './envoySanguineExposureEngine';
import { previewEnvoyCatalystCast } from './envoyCatalystCastEngine';
import type { WeaponFamilyId } from '../types/weapon';
import { resolveWeaponState } from './weaponProgressionEngine';

function scalePct(base: number, pct: number | undefined): number {
  if (!pct) return base;
  return Math.max(0, Math.floor(base * (1 + pct / 100)));
}

export interface EnvoyWeaponActionPlanContext {
  actionId: EnvoyWeaponActionId;
  familyId: WeaponFamilyId | EnvoyWeaponFamilyId;
  classState: ClassCombatEncounterState;
  squad: readonly EnemyCombatProfile[];
  /** Primary target (SINGLE / NONE / DUAL source). */
  targetId: string | null;
  /** DUAL destination for GRAVE_TRANSFER. */
  secondaryTargetId?: string | null;
  veilFlux: number;
  operativeHp: number;
  maxHp: number;
  resolvedWeapon: ResolvedWeaponState | null;
  /** Pre-prime catalyst (= classState.currentCatalyst before cast). */
  previousCatalystForCleanCycle: 'NULL' | 'ECHO' | 'BLOOD' | 'ASH' | null;
}

export type EnvoyWeaponActionRejectReason =
  | 'UNKNOWN_FAMILY'
  | 'WRONG_FAMILY'
  | 'UNKNOWN_ACTION'
  | 'MISSING_TARGET'
  | 'INVALID_DUAL'
  | 'INSUFFICIENT_ROT'
  | 'INSUFFICIENT_FLUX'
  | 'EXECUTOR_UNAVAILABLE';

export interface EnvoyWeaponActionPlan {
  ok: true;
  actionId: EnvoyWeaponActionId;
  familyId: EnvoyWeaponFamilyId;
  def: EnvoyWeaponActionDefinition;
  apCost: number;
  staminaCost: number;
  fluxCost: number;
  fluxGain: number;
  /** Net flux delta after cost/gain (before CLEAN_CYCLE bonus already folded into fluxGain for Action1). */
  fluxDelta: number;
  hpSacrifice: number;
  intendedHpSacrifice: number;
  sacrificePaidFully: boolean;
  brinkAmplified: boolean;
  cleanCatalystCycle: boolean;
  /** Authored occult before Catalyst sequence amp. */
  authoredOccultDamage: number;
  /** Preview occult including conditional Catalyst amp when pair is currently legal. */
  occultDamage: number;
  wardStrip: number;
  rotApply: number;
  rotTransfer: number;
  rotConsume: number;
  sourceUnitId: string | null;
  destUnitId: string | null;
  armSanguineExposure: boolean;
  consumeSanguineExposure: boolean;
  exposureAmplified: boolean;
  apDrain: number;
  smokeArcAccuracyDown: boolean;
  selfHeal: number;
  invokeOccultCastHook: boolean;
  invokeSacrificeHook: boolean;
  invokeDebuffHook: boolean;
  catalystPrime: 'NULL' | 'ECHO' | 'BLOOD' | 'ASH' | null;
  catalystPreview: ReturnType<typeof previewEnvoyCatalystCast>;
  logLines: string[];
  provenanceActionId: EnvoyWeaponActionId;
  /** Action1 splinter plan when used. */
  action1Plan: EnvoySplinterBasicPlan | null;
}

export type EnvoyWeaponActionPlanResult =
  | EnvoyWeaponActionPlan
  | { ok: false; reason: EnvoyWeaponActionRejectReason; message: string; apCost: number };

function reject(
  reason: EnvoyWeaponActionRejectReason,
  message: string,
  apCost = 0,
): EnvoyWeaponActionPlanResult {
  return { ok: false, reason, message, apCost };
}

function unit(
  squad: readonly EnemyCombatProfile[],
  id: string | null | undefined,
): EnemyCombatProfile | null {
  if (!id) return null;
  return squad.find((u) => u.unitId === id) ?? null;
}

export function planEnvoyWeaponAction(
  ctx: EnvoyWeaponActionPlanContext,
): EnvoyWeaponActionPlanResult {
  if (!isEnvoyWeaponFamilyId(ctx.familyId)) {
    return reject('UNKNOWN_FAMILY', `Unknown Envoy family: ${String(ctx.familyId)}`);
  }
  const def = getEnvoyWeaponActionDefinition(ctx.actionId);
  if (!def) {
    return reject('UNKNOWN_ACTION', `Unknown action: ${ctx.actionId}`);
  }
  if (!isEnvoyWeaponActionOnEquippedFamily(ctx.familyId, ctx.actionId)) {
    return reject('WRONG_FAMILY', `${ctx.actionId} not on ${ctx.familyId}`, def.apCost);
  }

  const occultPct = ctx.resolvedWeapon?.statModifiers.occultDamagePct;

  // ---------- Action 1: live basic authority ----------
  if (def.order === 1) {
    if (!ctx.targetId || !unit(ctx.squad, ctx.targetId)) {
      return reject('MISSING_TARGET', `${def.displayName} requires a target.`, def.apCost);
    }
    const catalogDamage = def.baseDamage;
    const catalogFlux = def.fluxCost;
    const weapon = ctx.resolvedWeapon
      ?? resolveWeaponState(ctx.familyId, 1);
    const a1 = resolveEnvoySplinterBasic({
      weapon,
      catalogDamage,
      catalogFluxCost: catalogFlux,
      veilFlux: ctx.veilFlux,
      operativeHp: ctx.operativeHp,
      maxHp: ctx.maxHp,
      previousCatalyst: ctx.previousCatalystForCleanCycle,
    });
    if (ctx.veilFlux < a1.fluxCost) {
      return reject('INSUFFICIENT_FLUX', `Requires at least ${a1.fluxCost}% Veil-Flux.`, def.apCost);
    }
    const target = unit(ctx.squad, ctx.targetId);
    const catalystPreview = previewEnvoyCatalystCast({
      classState: ctx.classState,
      prime: def.catalystPrime,
      target,
    });
    return {
      ok: true,
      actionId: ctx.actionId,
      familyId: ctx.familyId,
      def,
      apCost: def.apCost,
      staminaCost: def.staminaCost,
      fluxCost: a1.fluxCost,
      fluxGain: a1.fluxBonus,
      fluxDelta: a1.fluxBonus - a1.fluxCost,
      hpSacrifice: a1.hpSacrifice,
      intendedHpSacrifice: a1.intendedHpSacrifice,
      sacrificePaidFully: a1.sacrificePaidFully,
      brinkAmplified: a1.brinkAmplified,
      cleanCatalystCycle: a1.cleanCatalystCycle,
      authoredOccultDamage: a1.occultDamage,
      occultDamage: a1.occultDamage,
      wardStrip: def.wardStrip,
      rotApply: a1.rotStacks,
      rotTransfer: 0,
      rotConsume: 0,
      sourceUnitId: ctx.targetId,
      destUnitId: null,
      armSanguineExposure: false,
      consumeSanguineExposure: false,
      exposureAmplified: false,
      apDrain: 0,
      smokeArcAccuracyDown: false,
      selfHeal: 0,
      invokeOccultCastHook: a1.invokeOccultCastHook,
      invokeSacrificeHook: a1.invokeSacrificeHook,
      invokeDebuffHook: a1.invokeDebuffHook,
      catalystPrime: def.catalystPrime,
      catalystPreview,
      logLines: [...a1.logLines],
      provenanceActionId: ctx.actionId,
      action1Plan: a1,
    };
  }

  // ---------- Actions 2–4 ----------
  if (ctx.veilFlux < def.fluxCost) {
    return reject('INSUFFICIENT_FLUX', `Requires at least ${def.fluxCost}% Veil-Flux.`, def.apCost);
  }

  let occultDamage = scalePct(def.baseDamage, occultPct);
  let hpSacrifice = 0;
  let intendedHpSacrifice = 0;
  let sacrificePaidFully = false;
  let brinkAmplified = false;
  let exposureAmplified = false;
  let rotTransfer = 0;
  let rotConsume = 0;
  let sourceUnitId: string | null = ctx.targetId;
  let destUnitId: string | null = null;
  let selfHeal = 0;
  const logLines: string[] = [];

  switch (ctx.actionId) {
    case 'GRAVE_TRANSFER': {
      const source = unit(ctx.squad, ctx.targetId);
      const dest = unit(ctx.squad, ctx.secondaryTargetId ?? null);
      if (!source?.unitId || !dest?.unitId || source.unitId === dest.unitId) {
        return reject('INVALID_DUAL', 'Grave Transfer requires two distinct living targets.', def.apCost);
      }
      const stacks = getVeilRotStacks(ctx.classState, source.unitId);
      if (stacks < 1) {
        return reject('INSUFFICIENT_ROT', 'Grave Transfer requires Veil Rot on the source.', def.apCost);
      }
      rotTransfer = Math.min(2, stacks);
      sourceUnitId = source.unitId;
      destUnitId = dest.unitId;
      occultDamage = scalePct(6, occultPct);
      logLines.push('[VAMBRACE] >> Grave Transfer — Rot relocated.');
      break;
    }
    case 'VEIL_BRAND': {
      if (!ctx.targetId || !unit(ctx.squad, ctx.targetId)) {
        return reject('MISSING_TARGET', 'Veil Brand requires a target.', def.apCost);
      }
      occultDamage = scalePct(5, occultPct);
      logLines.push('[VAMBRACE] >> Veil Brand — curse latched.');
      break;
    }
    case 'ROT_KNELL': {
      if (!ctx.targetId || !unit(ctx.squad, ctx.targetId)) {
        return reject('MISSING_TARGET', 'Rot Knell requires a target.', def.apCost);
      }
      const stacks = getVeilRotStacks(ctx.classState, ctx.targetId);
      if (stacks < 1) {
        return reject('INSUFFICIENT_ROT', 'Rot Knell requires Veil Rot on the target.', def.apCost);
      }
      rotConsume = Math.min(2, stacks);
      occultDamage = rotConsume * LANTERN_FLUX_PURGE_DAMAGE_PER_EXTRA_ROT;
      occultDamage = scalePct(occultDamage, occultPct);
      logLines.push('[VAMBRACE] >> Rot Knell — partial detonation.');
      break;
    }
    case 'SILENT_EDGE': {
      if (!ctx.targetId || !unit(ctx.squad, ctx.targetId)) {
        return reject('MISSING_TARGET', 'Silent Edge requires a target.', def.apCost);
      }
      occultDamage = scalePct(14, occultPct);
      logLines.push('[SCYTHE] >> Silent Edge — echo cut.');
      break;
    }
    case 'VEIN_CUT': {
      if (!ctx.targetId || !unit(ctx.squad, ctx.targetId)) {
        return reject('MISSING_TARGET', 'Vein Cut requires a target.', def.apCost);
      }
      occultDamage = scalePct(10, occultPct);
      logLines.push('[SCYTHE] >> Vein Cut — blood catalyst.');
      break;
    }
    case 'SMOKE_ARC': {
      if (!ctx.targetId || !unit(ctx.squad, ctx.targetId)) {
        return reject('MISSING_TARGET', 'Smoke Arc requires a target.', def.apCost);
      }
      occultDamage = scalePct(8, occultPct);
      logLines.push('[SCYTHE] >> Smoke Arc — ash veil.');
      break;
    }
    case 'EXPOSE_VEIN': {
      if (!ctx.targetId || !unit(ctx.squad, ctx.targetId)) {
        return reject('MISSING_TARGET', 'Expose Vein requires a target.', def.apCost);
      }
      occultDamage = scalePct(9, occultPct);
      if (ctx.veilFlux <= PRISM_BRINK_FLUX_THRESHOLD) {
        occultDamage = Math.floor(occultDamage * PRISM_BRINK_DAMAGE_MULT);
        brinkAmplified = true;
      }
      logLines.push("[HEART'S DUE] >> Expose Vein — blood marked.");
      break;
    }
    case 'CRIMSON_VENT': {
      sourceUnitId = null;
      occultDamage = 0;
      selfHeal = Math.min(6, Math.floor(ctx.maxHp * 0.04));
      logLines.push("[HEART'S DUE] >> Crimson Vent — pressure bled off.");
      break;
    }
    case 'HEART_CLAIM': {
      if (!ctx.targetId || !unit(ctx.squad, ctx.targetId)) {
        return reject('MISSING_TARGET', 'Heart Claim requires a target.', def.apCost);
      }
      intendedHpSacrifice = Math.min(
        PRISM_BASIC_HP_SACRIFICE_MAX,
        Math.max(1, Math.floor(ctx.maxHp * PRISM_BASIC_HP_SACRIFICE_PCT)),
      );
      hpSacrifice = Math.min(intendedHpSacrifice, Math.max(0, ctx.operativeHp - 1));
      sacrificePaidFully = hpSacrifice > 0 && hpSacrifice === intendedHpSacrifice;
      occultDamage = scalePct(22, occultPct);
      if (ctx.veilFlux <= PRISM_BRINK_FLUX_THRESHOLD) {
        occultDamage = Math.floor(occultDamage * PRISM_BRINK_DAMAGE_MULT);
        brinkAmplified = true;
      }
      if (sacrificePaidFully) {
        occultDamage = Math.floor(occultDamage * PRISM_SACRIFICE_PAYOFF_DAMAGE_MULT);
      }
      if (hasSanguineExposure(ctx.classState, ctx.targetId)) {
        occultDamage = Math.floor(occultDamage * 1.1);
        exposureAmplified = true;
      }
      logLines.push("[HEART'S DUE] >> Heart Claim — due collected.");
      break;
    }
    default:
      return reject('UNKNOWN_ACTION', `Unhandled action: ${ctx.actionId}`, def.apCost);
  }

  const target = unit(ctx.squad, destUnitId ?? ctx.targetId);
  const catalystPreview = previewEnvoyCatalystCast({
    classState: ctx.classState,
    prime: def.catalystPrime,
    target,
  });
  let previewDamage = occultDamage;
  if (catalystPreview.payoff?.damageBonusPercent) {
    previewDamage = Math.floor(
      occultDamage * (1 + catalystPreview.payoff.damageBonusPercent / 100),
    );
  }

  const fluxGain = def.fluxGain;
  return {
    ok: true,
    actionId: ctx.actionId,
    familyId: ctx.familyId,
    def,
    apCost: def.apCost,
    staminaCost: def.staminaCost,
    fluxCost: def.fluxCost,
    fluxGain,
    fluxDelta: fluxGain - def.fluxCost,
    hpSacrifice,
    intendedHpSacrifice,
    sacrificePaidFully,
    brinkAmplified,
    cleanCatalystCycle: false,
    authoredOccultDamage: occultDamage,
    occultDamage: previewDamage,
    wardStrip: def.wardStrip,
    rotApply: def.rotApply,
    rotTransfer,
    rotConsume,
    sourceUnitId,
    destUnitId,
    armSanguineExposure: ctx.actionId === 'EXPOSE_VEIN',
    consumeSanguineExposure: ctx.actionId === 'HEART_CLAIM' && exposureAmplified,
    exposureAmplified,
    apDrain: ctx.actionId === 'VEIL_BRAND' ? 1 : 0,
    smokeArcAccuracyDown: ctx.actionId === 'SMOKE_ARC',
    selfHeal,
    invokeOccultCastHook: true,
    invokeSacrificeHook: sacrificePaidFully && ctx.actionId === 'HEART_CLAIM',
    invokeDebuffHook: ctx.actionId === 'VEIL_BRAND',
    catalystPrime: def.catalystPrime,
    catalystPreview,
    logLines,
    provenanceActionId: ctx.actionId,
    action1Plan: null,
  };
}

/** Destination stacks after a planned Grave Transfer (for preview). */
export function previewGraveTransferDestinationStacks(
  classState: ClassCombatEncounterState,
  sourceId: string,
  destId: string,
  transfer: number,
): { sourceAfter: number; destAfter: number } {
  const src = getVeilRotStacks(classState, sourceId);
  const dst = getVeilRotStacks(classState, destId);
  const moved = Math.min(transfer, src);
  return {
    sourceAfter: src - moved,
    destAfter: Math.min(VEIL_ROT_STACK_CAP, dst + moved),
  };
}
