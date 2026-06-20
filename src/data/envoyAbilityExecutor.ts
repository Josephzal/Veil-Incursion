import type { EnvoyAbilityId } from '../types/operativeClass';
import type { ClassCombatEncounterState } from '../types/classCombatAbility';
import type { CombatGridSlotId } from '../types/combatGrid';
import { columnSlotsFor } from '../types/combatGrid';
import type { EnemyCombatProfile } from '../types/run';
import { getEnvoyAbilityDefinition } from './envoyAbilities';
import {
  addCombatTag,
  applyFractureDamage,
} from './combatFractureEngine';
import {
  aliveUnits,
  getUnitById,
  isUnitAlive,
  pullBacklineToFrontline,
  unitAtSlot,
} from './combatSquadEngine';

export interface EnvoyAbilityHurtOptions {
  channel?: 'KINETIC' | 'OCCULT' | 'TRUE';
  fractureGain?: number;
  targetId?: string;
  abilityId?: EnvoyAbilityId;
  rollCrit?: boolean;
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
  fluxGenOverride?: number;
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

export function executeEnvoyAbility(ctx: EnvoyExecutionContext): EnvoyExecutionResult {
  const def = getEnvoyAbilityDefinition(ctx.abilityId);

  if (def.id === 'RIFT_WARD') {
    ctx.log('[REJECTED] >> Rift-Ward is an intrinsic reactive defense.');
    return { ok: false, refundAp: def.apCost };
  }

  if (def.minFluxRequired != null && ctx.veilFlux < def.minFluxRequired) {
    ctx.log(`[REJECTED] >> Requires at least ${def.minFluxRequired} Veil-Flux.`);
    return { ok: false, refundAp: def.apCost };
  }

  if (def.staminaCost > 0 && !ctx.spendStamina(def.staminaCost)) {
    ctx.log('[REJECTED] >> Insufficient stamina.');
    return { ok: false, refundAp: def.apCost };
  }

  const netFlux = (ctx.fluxGenOverride ?? def.fluxGen) - (ctx.fluxCostOverride ?? def.fluxCost);

  switch (ctx.abilityId) {
    case 'VEIL_SPLINTER': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Veil-Splinter requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.hurtEnemy(def.baseDamage, '[VEIL-SPLINTER]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      return { ok: true, fluxDelta: netFlux };
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
        ctx.hurtEnemy(def.baseDamage, '[ASTRAL LANCE]', {
          channel: 'OCCULT',
          abilityId: ctx.abilityId,
          targetId: hit.unitId,
        }, hit.unitId);
      }
      return { ok: true, fluxDelta: netFlux };
    }

    case 'SPATIAL_COLLAPSE': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId || !unit.gridSlot) {
        ctx.log('[REJECTED] >> Spatial Collapse requires a focal target.');
        return { ok: false, refundAp: def.apCost };
      }
      const hits = columnUnits(ctx.squad, unit.gridSlot as CombatGridSlotId);
      for (const hit of hits) {
        if (!hit.unitId) continue;
        ctx.patchUnit(hit.unitId, {
          kineticArmor: 0,
          occultWards: 0,
          veilBarrierCharges: undefined,
        });
        ctx.hurtEnemy(def.baseDamage, '[SPATIAL COLLAPSE]', {
          channel: 'OCCULT',
          abilityId: ctx.abilityId,
          targetId: hit.unitId,
        }, hit.unitId);
      }
      ctx.log('[SPATIAL COLLAPSE] >> Cover and wards shredded.');
      return { ok: true, fluxDelta: netFlux };
    }

    case 'FLUX_PURGE': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Flux-Purge requires a melee target.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.hurtEnemy(def.baseDamage, '[FLUX-PURGE]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'DIMENSIONAL_SHEAR': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Dimensional Shear requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.patchUnit(unit.unitId, {
        occultWards: 0,
        veilBarrierCharges: undefined,
      });
      ctx.hurtEnemy(def.baseDamage, '[DIMENSIONAL SHEAR]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'PHASE_STEP': {
      ctx.setShadowStepEvadeActive?.(true);
      ctx.log('[PHASE-STEP] >> Rift slip — next hostile strike will miss.');
      return { ok: true, fluxDelta: netFlux };
    }

    case 'AETHERIC_TRANSFUSION': {
      const heal = Math.floor(ctx.maxSoulAnchor * 0.25);
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
      ctx.log(`[SOUL-TETHER] >> Mirrored pain linked to ${unit.designation}.`);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'ENTROPY_HEX': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Entropy Hex requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.classState.enemyApDrainNextTurn[unit.unitId] = 1;
      ctx.classState.entropyHexTurns[unit.unitId] = 2;
      ctx.hurtEnemy(def.baseDamage, '[ENTROPY HEX]', {
        channel: 'OCCULT',
        abilityId: ctx.abilityId,
        targetId: unit.unitId,
      }, unit.unitId);
      return { ok: true, fluxDelta: netFlux };
    }

    case 'FLESH_WARP': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Flesh-Warp requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      const reducedMax = Math.max(1, Math.floor(unit.maxHp * 0.85));
      ctx.classState.fleshWarpUnits[unit.unitId] = true;
      ctx.patchUnit(unit.unitId, {
        maxHp: reducedMax,
        currentHp: Math.min(unit.currentHp, reducedMax),
      });
      ctx.log('[FLESH-WARP] >> Anatomy warped — max HP −15%, healing blocked.');
      return { ok: true, fluxDelta: netFlux };
    }

    case 'GRAVITY_WELL': {
      let squad = ctx.squad;
      for (const unit of aliveUnits(squad)) {
        if (!unit.unitId || !unit.gridSlot?.startsWith('BL')) continue;
        squad = pullBacklineToFrontline(squad, unit.unitId);
      }
      ctx.syncSquad(squad);
      for (const unit of aliveUnits(squad)) {
        if (!unit.unitId) continue;
        let next = applyFractureDamage(unit, 10);
        next = { ...next, evadeChance: 0, evadeActive: false };
        ctx.patchUnit(unit.unitId, addCombatTag(next, 'CONCUSSED'));
        ctx.hurtEnemy(def.baseDamage, '[GRAVITY WELL]', {
          channel: 'OCCULT',
          abilityId: ctx.abilityId,
          targetId: unit.unitId,
        }, unit.unitId);
      }
      ctx.log('[GRAVITY WELL] >> Hostiles pulled and rooted.');
      return { ok: true, fluxDelta: netFlux };
    }

    case 'MIND_SUNDER': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Mind-Sunder requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
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
      for (const unit of aliveUnits(ctx.squad)) {
        if (!unit.unitId) continue;
        ctx.hurtEnemy(Math.floor(def.baseDamage * 1.4), '[CATACLYSM SIGIL]', {
          channel: 'TRUE',
          abilityId: ctx.abilityId,
          rollCrit: false,
          targetId: unit.unitId,
        }, unit.unitId);
      }
      ctx.log('[CATACLYSM SIGIL] >> Sigil traced — grid-wide true rupture.');
      return { ok: true, fluxDelta: -ctx.veilFlux };
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
  envoySilenced: boolean,
  fluxCostOverride?: number,
): boolean {
  const def = getEnvoyAbilityDefinition(abilityId);
  const fluxCost = fluxCostOverride ?? def.fluxCost;
  if (def.id === 'RIFT_WARD') return false;
  if (def.minFluxRequired != null && veilFlux < def.minFluxRequired) return false;
  if (envoySilenced && def.tags.includes('FLUX_GEN')) return false;
  if (def.staminaCost > 0 && stamina < def.staminaCost) return false;
  if (fluxCost > 0 && veilFlux < fluxCost) return false;
  return true;
}

export function applyEntropyHexDot(
  squad: EnemyCombatProfile[],
  turns: Record<string, number>,
  hurtEnemy: EnvoyExecutionContext['hurtEnemy'],
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [unitId, remaining] of Object.entries(turns)) {
    const unit = getUnitById(squad, unitId);
    if (!unit?.unitId || !isUnitAlive(unit)) continue;
    hurtEnemy(8, '[ENTROPY HEX — DOT]', {
      channel: 'OCCULT',
      abilityId: 'ENTROPY_HEX',
      targetId: unitId,
      rollCrit: false,
    }, unitId);
    if (remaining > 1) next[unitId] = remaining - 1;
  }
  return next;
}
