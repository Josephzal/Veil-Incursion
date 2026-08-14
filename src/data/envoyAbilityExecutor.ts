import type { EnvoyAbilityId } from '../types/operativeClass';
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { CombatGridSlotId } from '../types/combatGrid';
import { columnSlotsFor } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import type { ResolvedWeaponState, WeaponRuntimeState } from '../types/weapon';
import { getEnvoyAbilityDefinition } from './envoyAbilities';
import { isEnvoyCastBlockedByVoidSiphon } from '../types/envoyState';
import { addCombatTag } from './combatFractureEngine';
import {
  consumeVeilRotStacks,
  getVeilRotStacks,
  infectVeilRot,
} from './envoyRotEngine';
import {
  aliveUnits,
  getUnitById,
  isUnitAlive,
  unitAtSlot,
} from './combatSquadEngine';
import { resolveClassWardenInterceptTarget } from './combatClassTargeting';
import { resolveLanternFluxPurgePayoff } from './weaponLanternRotPayoff';
import type { CombatSessionExtras } from '../types/combatHooks';
import { executeEnvoyActionOneFromCompat } from './envoyWeaponActionExecutor';
import type { WeaponFamilyId } from '../types/weapon';
import type { ClassGraftCastPlan } from '../types/classGraft';
import { readUniversalUpgradeValue } from './universalGraftRegistry';

export interface EnvoyAbilityHurtOptions {
  channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  fractureGain?: number;
  targetId?: string;
  abilityId?: EnvoyAbilityId;
  rollCrit?: boolean;
  indirectDamage?: boolean;
}

export interface EnvoyExecutionContext {
  abilityId: EnvoyAbilityId;
  squad: EnemyCombatProfile[];
  targetId: string | null;
  veilFlux: number;
  maxSoulAnchor: number;
  classState: ClassCombatEncounterState;
  log: (msg: string) => void;
  apCostOverride?: number;
  fluxRegenOverride?: number;
  fluxCostOverride?: number;
  spendStamina: (cost: number) => boolean;
  applyFluxDelta: (delta: number) => number;
  hurtEnemy: (
    raw: number,
    tag: string,
    options?: EnvoyAbilityHurtOptions,
    targetId?: string,
  ) => boolean;
  patchUnit: (unitId: string, patch: Partial<EnemyCombatProfile>) => void;
  syncSquad: (squad: EnemyCombatProfile[]) => void;
  healOperative: (amount: number) => void;
  setShadowStepEvadeActive?: (active: boolean) => void;
  reduceEnemyAp: (unitId: string, amount: number) => void;
  cancelEnemyPreparedAttack?: (unitId: string) => void;
  ultimatePerformance?: number;
  resolvedWeapon?: ResolvedWeaponState | null;
  weaponRuntime?: WeaponRuntimeState;
  operativeHp?: number;
  applyWeaponRuntimePatch?: (patch: Partial<WeaponRuntimeState>) => void;
  applyVeilFluxBonus?: (delta: number) => void;
  applyHpSacrifice?: (amount: number) => void;
  sessionExtras?: CombatSessionExtras;
  graftPlan?: ClassGraftCastPlan | null;
}

export type EnvoyExecutionResult =
  | { ok: true; fluxDelta?: number }
  | { ok: false; refundAp: number };

function targetUnit(ctx: EnvoyExecutionContext): EnemyCombatProfile | null {
  if (!ctx.targetId) return null;
  return getUnitById(ctx.squad, ctx.targetId) ?? null;
}

function columnUnits(squad: EnemyCombatProfile[], slot: CombatGridSlotId): EnemyCombatProfile[] {
  const slots = columnSlotsFor(slot);
  return slots
    .map((s) => unitAtSlot(squad, s))
    .filter((u): u is EnemyCombatProfile => u != null && isUnitAlive(u));
}

function wardenResolvedUnit(
  ctx: EnvoyExecutionContext,
  unit: EnemyCombatProfile & { unitId: string },
): EnemyCombatProfile & { unitId: string } {
  const resolvedId = resolveClassWardenInterceptTarget(ctx.squad, 'ENVOY', ctx.abilityId, unit.unitId);
  const resolved = getUnitById(ctx.squad, resolvedId);
  return resolved?.unitId ? resolved as EnemyCombatProfile & { unitId: string } : unit;
}

export function executeEnvoyAbility(ctx: EnvoyExecutionContext): EnvoyExecutionResult {
  const def = getEnvoyAbilityDefinition(ctx.abilityId);

  if (def.id === 'RIFT_WARD') {
    ctx.log('[REJECTED] >> Rift-Ward is an intrinsic reactive defense.');
    return { ok: false, refundAp: def.apCost };
  }

  const fluxCost = ctx.fluxCostOverride ?? def.fluxCost;
  if (fluxCost > 0 && ctx.veilFlux < fluxCost) {
    ctx.log(`[REJECTED] >> Requires at least ${fluxCost}% Veil-Flux.`);
    return { ok: false, refundAp: def.apCost };
  }

  if (def.staminaCost > 0 && !ctx.spendStamina(def.staminaCost)) {
    ctx.log('[REJECTED] >> Insufficient stamina.');
    return { ok: false, refundAp: def.apCost };
  }

  const netFlux = (ctx.fluxRegenOverride ?? def.fluxRegen) - fluxCost;

  switch (ctx.abilityId) {
    case 'VEIL_SPLINTER': {
      // E.4 — consolidate Action 1 through canonical weapon-action executor.
      const familyId = (ctx.resolvedWeapon?.familyId ?? 'envoy-vambrace') as WeaponFamilyId;
      const wa = executeEnvoyActionOneFromCompat({
        ingressId: 'VEIL_SPLINTER',
        familyId,
        squad: ctx.squad,
        targetId: ctx.targetId,
        veilFlux: ctx.veilFlux,
        maxHp: ctx.maxSoulAnchor,
        operativeHp: ctx.operativeHp ?? 1,
        classState: ctx.classState,
        log: ctx.log,
        resolvedWeapon: ctx.resolvedWeapon ?? null,
        weaponRuntime: ctx.weaponRuntime,
        sessionExtras: ctx.sessionExtras,
        // Stamina already committed by executeEnvoyAbility pre-switch validation.
        spendStamina: () => true,
        applyHpSacrifice: ctx.applyHpSacrifice,
        applyVeilFluxBonus: ctx.applyVeilFluxBonus,
        applyWeaponRuntimePatch: ctx.applyWeaponRuntimePatch,
        hurtEnemy: (raw, tag, options, targetId) =>
          ctx.hurtEnemy(raw, tag, {
            channel: options?.channel,
            targetId: options?.targetId,
            abilityId: ctx.abilityId,
            rollCrit: options?.rollCrit,
            indirectDamage: options?.indirectDamage,
          }, targetId),
        patchUnit: ctx.patchUnit,
        healOperative: ctx.healOperative,
      });
      if (!wa.ok) {
        return { ok: false, refundAp: wa.refundAp || def.apCost };
      }
      // Preserve historical log tag for live projection period (E.5 cleans copy).
      if (wa.plan.sourceUnitId) {
        // Damage already dealt by WA executor with Action1 display tag.
      }
      return { ok: true, fluxDelta: wa.fluxDelta };
    }

    case 'ASTRAL_LANCE': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId || !unit.gridSlot) {
        ctx.log('[REJECTED] >> Astral Lance requires a column target.');
        return { ok: false, refundAp: def.apCost };
      }
      const hits = columnUnits(ctx.squad, unit.gridSlot as CombatGridSlotId);
      for (const hit of hits) {
        if (!hit.unitId) continue;
        const resolved = wardenResolvedUnit(ctx, hit as EnemyCombatProfile & { unitId: string });
        ctx.hurtEnemy(def.baseDamage, '[ASTRAL LANCE]', {
          channel: 'OCCULT',
          abilityId: ctx.abilityId,
          targetId: resolved.unitId,
        }, resolved.unitId);
        infectVeilRot(ctx.classState, resolved, 1, ctx.log);
      }
      return { ok: true, fluxDelta: netFlux };
    }

    case 'NECROTIC_BLOOM': {
      const targets = aliveUnits(ctx.squad);
      if (targets.length === 0) {
        ctx.log('[REJECTED] >> No hostiles on grid.');
        return { ok: false, refundAp: def.apCost };
      }
      for (const hit of targets) {
        if (!hit.unitId) continue;
        const resolved = wardenResolvedUnit(ctx, hit as EnemyCombatProfile & { unitId: string });
        ctx.hurtEnemy(def.baseDamage, '[NECROTIC BLOOM]', {
          channel: 'OCCULT',
          abilityId: ctx.abilityId,
          targetId: resolved.unitId,
        }, resolved.unitId);
        infectVeilRot(ctx.classState, resolved, 2, ctx.log);
      }
      ctx.log('[NECROTIC BLOOM] >> Bloom detonated across the hostile grid.');
      return { ok: true, fluxDelta: netFlux };
    }

    case 'FLUX_PURGE': {
      const raw = targetUnit(ctx);
      if (!raw?.unitId) {
        ctx.log('[REJECTED] >> Flux-Purge requires a melee target.');
        return { ok: false, refundAp: def.apCost };
      }
      const unit = wardenResolvedUnit(ctx, raw as EnemyCombatProfile & { unitId: string });
      if (getVeilRotStacks(ctx.classState, unit.unitId) <= 0) {
        ctx.log('[REJECTED] >> Flux-Purge requires a Veil Rot stack on the target.');
        return { ok: false, refundAp: def.apCost };
      }
      const lantern = resolveLanternFluxPurgePayoff({
        familyId: ctx.resolvedWeapon?.familyId,
        classState: ctx.classState,
        targetId: unit.unitId,
        baseDamage: def.baseDamage,
      });
      lantern.logLines.forEach((line) => ctx.log(line));
      consumeVeilRotStacks(ctx.classState, unit.unitId, lantern.rotConsume);
      ctx.hurtEnemy(lantern.damage, '[FLUX-PURGE]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      ctx.log(`[FLUX-PURGE] >> Rot siphoned from ${unit.designation} — flux reservoir vented.`);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'DIMENSIONAL_SHEAR': {
      const raw = targetUnit(ctx);
      if (!raw?.unitId) {
        ctx.log('[REJECTED] >> Dimensional Shear requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      const unit = wardenResolvedUnit(ctx, raw as EnemyCombatProfile & { unitId: string });
      ctx.patchUnit(unit.unitId, {
        occultWards: 0,
        veilBarrierCharges: undefined,
      });
      ctx.hurtEnemy(def.baseDamage, '[DIMENSIONAL SHEAR]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      infectVeilRot(ctx.classState, unit, 1, ctx.log);
      ctx.log('[DIMENSIONAL SHEAR] >> Occult wards sheared.');
      return { ok: true, fluxDelta: netFlux };
    }

    case 'PHASE_STEP': {
      ctx.setShadowStepEvadeActive?.(true);
      ctx.log('[PHASE-STEP] >> Rift slip — next hostile strike will miss.');
      return { ok: true, fluxDelta: netFlux };
    }

    case 'AETHERIC_TRANSFUSION': {
      const healPct = readUniversalUpgradeValue(ctx.graftPlan, 'HEAL_PERCENT', 25);
      const heal = Math.floor(ctx.maxSoulAnchor * (healPct / 100));
      ctx.healOperative(heal);
      ctx.log(`[AETHERIC TRANSFUSION] >> ${heal} HP restored via flux tithe.`);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'SOUL_TETHER': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Soul-Tether requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.classState.soulTetherUnitId = unit.unitId;
      ctx.classState.soulTetherReflectPercent = readUniversalUpgradeValue(
        ctx.graftPlan,
        'REFLECT_PERCENT',
        50,
      );
      ctx.log(`[SOUL-TETHER] >> Mirrored pain linked to ${unit.designation}.`);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'ENTROPY_HEX': {
      const raw = targetUnit(ctx);
      if (!raw?.unitId) {
        ctx.log('[REJECTED] >> Entropy Hex requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      const unit = wardenResolvedUnit(ctx, raw as EnemyCombatProfile & { unitId: string });
      ctx.classState.enemyApDrainNextTurn[unit.unitId] = 1;
      ctx.hurtEnemy(def.baseDamage, '[ENTROPY HEX]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      infectVeilRot(ctx.classState, unit, 1, ctx.log);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'FLESH_WARP': {
      const raw = targetUnit(ctx);
      if (!raw?.unitId) {
        ctx.log('[REJECTED] >> Flesh-Warp requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      const unit = wardenResolvedUnit(ctx, raw as EnemyCombatProfile & { unitId: string });
      const reductionPct = readUniversalUpgradeValue(
        ctx.graftPlan,
        'MAX_HP_REDUCTION',
        15,
      );
      const reducedMax = Math.max(1, Math.floor(unit.maxHp * (1 - reductionPct / 100)));
      ctx.classState.fleshWarpUnits[unit.unitId] = true;
      ctx.patchUnit(unit.unitId, {
        maxHp: reducedMax,
        currentHp: Math.min(unit.currentHp, reducedMax),
      });
      infectVeilRot(ctx.classState, unit, 1, ctx.log);
      ctx.log(`[FLESH-WARP] >> Anatomy warped — max HP −${reductionPct}%, healing blocked.`);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'PARALYTIC_MIASMA': {
      const raw = targetUnit(ctx);
      if (!raw?.unitId) {
        ctx.log('[REJECTED] >> Paralytic Miasma requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      const unit = wardenResolvedUnit(ctx, raw as EnemyCombatProfile & { unitId: string });
      ctx.patchUnit(unit.unitId, { evadeChance: 0, evadeActive: false });
      ctx.classState.paralyticMiasmaDoubleRotNextTurn[unit.unitId] = true;
      infectVeilRot(ctx.classState, unit, 1, ctx.log);
      ctx.log(`[PARALYTIC MIASMA] >> ${unit.designation} rooted — next Veil Rot tick doubled.`);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'MIND_SUNDER': {
      const raw = targetUnit(ctx);
      if (!raw?.unitId) {
        ctx.log('[REJECTED] >> Mind-Sunder requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      const unit = wardenResolvedUnit(ctx, raw as EnemyCombatProfile & { unitId: string });
      ctx.patchUnit(unit.unitId, addCombatTag(unit, 'CONCUSSED'));
      ctx.cancelEnemyPreparedAttack?.(unit.unitId);
      ctx.hurtEnemy(def.baseDamage, '[MIND-SUNDER]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'CATACLYSM_SIGIL': {
      const performance = ctx.ultimatePerformance ?? 1;
      const perTarget = Math.floor(def.baseDamage * 1.4 * (0.55 + performance * 0.45));
      for (const unit of aliveUnits(ctx.squad)) {
        if (!unit.unitId) continue;
        ctx.hurtEnemy(perTarget, '[CATACLYSM SIGIL]', {
          channel: 'TRUE',
          abilityId: ctx.abilityId,
          rollCrit: false,
          targetId: unit.unitId,
        }, unit.unitId);
      }
      ctx.log('[CATACLYSM SIGIL] >> Sigil traced — grid-wide true rupture.');
      return { ok: true, fluxDelta: 0 };
    }

    default:
      ctx.log('[REJECTED] >> Spell channel not wired.');
      return { ok: false, refundAp: def.apCost };
  }
}

export function isEnvoyAbilityEnabled(
  abilityId: EnvoyAbilityId,
  veilFlux: number,
  stamina: number,
  isVoidSiphoned: boolean,
  masochisticChannel: boolean,
  fluxCostOverride?: number,
): boolean {
  const def = getEnvoyAbilityDefinition(abilityId);
  const fluxCost = fluxCostOverride ?? def.fluxCost;
  if (def.id === 'RIFT_WARD') return false;
  if (isEnvoyCastBlockedByVoidSiphon(def.tags, isVoidSiphoned, masochisticChannel)) return false;
  if (def.staminaCost > 0 && stamina < def.staminaCost) return false;
  if (fluxCost > 0 && veilFlux < fluxCost) return false;
  return true;
}
