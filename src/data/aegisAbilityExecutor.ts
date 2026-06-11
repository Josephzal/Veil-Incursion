import type { AegisAbilityId } from '../types/aegisCombat';
import type { DamageChannel } from '../types/aegisCombat';
import type { EnemyCombatProfile } from '../types/run';
import type { ResolvedWeaponCombatStats } from './inventory';
import {
  addCombatTag,
  applyFractureDamage,
  applyFracturedState,
  hasCombatTag,
  isEnemyFractured,
  stackDoomedTag,
} from './combatFractureEngine';
import {
  adjacentAliveUnits,
  aliveUnits,
  getUnitById,
  pullBacklineToFrontline,
} from './combatSquadEngine';
import { getAbilityDefinition } from './aegisAbilities';
import type { MutationCombatModifiers } from './leyLineMutationEngine';

export interface PlayerCombatBuffState {
  demonLungCooldown: number;
  crimsonPactCharges: number;
  bonusApThisTurn: number;
  skipNextEnemyTurn: boolean;
}

export interface AbilityHurtOptions {
  channel?: DamageChannel;
  fractureGain?: number;
  targetId?: string;
}

export interface AbilityExecutionContext {
  abilityId: AegisAbilityId;
  squad: EnemyCombatProfile[];
  targetId: string | null;
  strikeStats: ResolvedWeaponCombatStats;
  stamina: number;
  abyssalReserve: number;
  operativeHp: number;
  maxSoulAnchor: number;
  buffState: PlayerCombatBuffState;
  log: (msg: string) => void;
  spendStamina: (cost: number) => boolean;
  spendStaminaPct: (pct: number) => boolean;
  hurtEnemy: (
    raw: number,
    tag: string,
    source?: string,
    options?: AbilityHurtOptions,
    targetId?: string,
  ) => boolean;
  patchUnit: (unitId: string, patch: Partial<EnemyCombatProfile>) => void;
  syncSquad: (squad: EnemyCombatProfile[]) => void;
  chargeAr: (pct: number) => void;
  consumeAbyssalPct: (pct: number) => number;
  healOperative: (amount: number) => void;
  sacrificeHpPct: (pct: number) => boolean;
  grantBonusAp: (amount: number) => void;
  restoreStaminaPct: (pct: number) => void;
  reduceEnemyAp: (unitId: string, amount: number) => void;
  mutationMods: MutationCombatModifiers;
  bloodTitheCooldown: number;
}

export type AbilityExecutionResult =
  | { ok: true; squad?: EnemyCombatProfile[] }
  | { ok: false; refundAp: number };

function targetUnit(ctx: AbilityExecutionContext): EnemyCombatProfile | null {
  if (!ctx.targetId) return null;
  return getUnitById(ctx.squad, ctx.targetId) ?? null;
}

function applyFractureToUnit(
  unit: EnemyCombatProfile,
  amount: number,
  instantIfConcussed: boolean,
): EnemyCombatProfile {
  if (isEnemyFractured(unit)) return unit;
  if (instantIfConcussed && hasCombatTag(unit, 'CONCUSSED')) {
    return applyFracturedState(unit);
  }
  return applyFractureDamage(unit, amount);
}

export function executeExtendedAbility(ctx: AbilityExecutionContext): AbilityExecutionResult {
  const def = getAbilityDefinition(ctx.abilityId);

  switch (ctx.abilityId) {
    case 'RUIN': {
      if (!ctx.spendStamina(def.staminaCost)) {
        ctx.log('[REJECTED] >> Insufficient stamina.');
        return { ok: false, refundAp: def.apCost };
      }
      let eradicated = false;
      for (const unit of aliveUnits(ctx.squad)) {
        if (!unit.unitId) continue;
        let next = applyFractureToUnit(unit, 20, true);
        ctx.patchUnit(unit.unitId, next);
        eradicated = ctx.hurtEnemy(8, '[RUIN]', 'STRIKE', { channel: 'KINETIC', fractureGain: 0 }, unit.unitId) || eradicated;
      }
      ctx.log('[RUIN] >> Fracture shockwave — all hostiles stressed.');
      if (eradicated) return { ok: true };
      return { ok: true };
    }

    case 'GRAVE_BIND': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId || !unit.gridSlot?.startsWith('BL')) {
        ctx.log('[REJECTED] >> Grave Bind requires a backline target.');
        return { ok: false, refundAp: def.apCost };
      }
      if (!ctx.spendStamina(def.staminaCost)) {
        ctx.log('[REJECTED] >> Insufficient stamina.');
        return { ok: false, refundAp: def.apCost };
      }
      const pulled = pullBacklineToFrontline(ctx.squad, unit.unitId);
      const pulledUnit = getUnitById(pulled, unit.unitId);
      if (pulledUnit?.unitId) {
        let exposed = addCombatTag(pulledUnit, 'EXPOSED');
        if (ctx.mutationMods.graveBindArmorShred > 0) {
          exposed = {
            ...exposed,
            kineticArmor: Math.max(0, (exposed.kineticArmor ?? 0) - ctx.mutationMods.graveBindArmorShred),
          };
        }
        ctx.syncSquad(
          pulled.map((u) => (u.unitId === exposed.unitId ? exposed : u)),
        );
        if (ctx.mutationMods.graveBindDamage > 0) {
          ctx.hurtEnemy(
            ctx.mutationMods.graveBindDamage,
            '[GRAVE BIND]',
            'STRIKE',
            { channel: 'KINETIC' },
            pulledUnit.unitId,
          );
        }
      } else {
        ctx.syncSquad(pulled);
      }
      ctx.log('[GRAVE BIND] >> Backline dragged to melee — target Exposed.');
      return { ok: true, squad: pulled };
    }

    case 'SHADOW_STEP': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Shadow Step requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      if (!ctx.spendStaminaPct(def.staminaCostPct ?? 50)) {
        ctx.log('[REJECTED] >> Insufficient stamina.');
        return { ok: false, refundAp: def.apCost };
      }
      const next = applyFractureDamage(unit, 50);
      ctx.patchUnit(unit.unitId, next);
      const eradicated = ctx.hurtEnemy(12, '[SHADOW STEP]', 'STRIKE', { channel: 'KINETIC' }, unit.unitId);
      ctx.buffState.skipNextEnemyTurn = true;
      ctx.grantBonusAp(1);
      ctx.log('[SHADOW STEP] >> Initiative seized — hostile cycle skipped next pass.');
      if (eradicated) return { ok: true };
      return { ok: true };
    }

    case 'NAIL_TO_GRID': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Nail to Grid requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      if (!ctx.spendStamina(def.staminaCost)) {
        ctx.log('[REJECTED] >> Insufficient stamina.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.reduceEnemyAp(unit.unitId, ctx.mutationMods.nailApDrain);
      ctx.patchUnit(unit.unitId, stackDoomedTag(unit));
      for (const adj of adjacentAliveUnits(ctx.squad, unit.unitId)) {
        if (!adj.unitId) continue;
        ctx.patchUnit(adj.unitId, stackDoomedTag(adj));
      }
      ctx.log('[NAIL TO GRID] >> Shadow pinned — AP drained, Doomed spreads.');
      return { ok: true };
    }

    case 'BLOOD_TITHE': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Blood-Tithe requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      if (!ctx.spendStamina(def.staminaCost)) {
        ctx.log('[REJECTED] >> Insufficient stamina.');
        return { ok: false, refundAp: def.apCost };
      }
      if (ctx.bloodTitheCooldown > 0) {
        ctx.log(`[REJECTED] >> Blood-Tithe on cooldown (${ctx.bloodTitheCooldown} turns).`);
        return { ok: false, refundAp: def.apCost };
      }
      const consumed = ctx.mutationMods.bloodTitheFree ? 0 : ctx.consumeAbyssalPct(30);
      if (!ctx.mutationMods.bloodTitheFree && consumed <= 0) {
        ctx.log('[REJECTED] >> Abyssal Reserve too low for tithe.');
        return { ok: false, refundAp: def.apCost };
      }
      const titheBase = consumed > 0 ? consumed : 30;
      const heal = Math.floor(
        ctx.maxSoulAnchor * (ctx.mutationMods.bloodTitheHealPctPer10Ar / 100) * Math.floor(titheBase / 10),
      );
      if (ctx.mutationMods.bloodTitheCooldown > 0) {
        ctx.bloodTitheCooldown = ctx.mutationMods.bloodTitheCooldown;
      }
      if (heal > 0) ctx.healOperative(heal);
      const occult = Math.max(10, Math.floor(consumed * 0.4));
      const eradicated = ctx.hurtEnemy(occult, '[BLOOD-TITHE]', 'STRIKE', { channel: 'OCCULT', fractureGain: 10 }, unit.unitId);
      ctx.log(`[BLOOD-TITHE] >> Reserve tithed (${consumed} AR) — ${heal} HP restored.`);
      if (eradicated) return { ok: true };
      return { ok: true };
    }

    case 'DEMONS_LUNG': {
      if (ctx.buffState.demonLungCooldown > 0) {
        ctx.log(`[REJECTED] >> Demon's Lung on cooldown (${ctx.buffState.demonLungCooldown} turns).`);
        return { ok: false, refundAp: def.apCost };
      }
      ctx.restoreStaminaPct(ctx.mutationMods.demonLungStaminaPct);
      ctx.grantBonusAp(1);
      ctx.buffState.demonLungCooldown = def.cooldownTurns ?? 3;
      ctx.log("[DEMON'S LUNG] >> Stamina surge — +1 AP this turn.");
      return { ok: true };
    }

    case 'CRIMSON_PACT': {
      if (!ctx.sacrificeHpPct(ctx.mutationMods.crimsonPactHpCostPct)) {
        ctx.log('[REJECTED] >> Insufficient soul anchor for pact.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.buffState.crimsonPactCharges = 2;
      ctx.log('[CRIMSON PACT] >> Blood oath sealed — next 2 attacks empowered.');
      return { ok: true };
    }

    default:
      return { ok: false, refundAp: def.apCost };
  }
}

export function isExtendedAbilityEnabled(
  abilityId: AegisAbilityId,
  stamina: number,
  abyssalReserve: number,
  operativeHp: number,
  maxSoulAnchor: number,
  buffState: PlayerCombatBuffState,
): boolean {
  const def = getAbilityDefinition(abilityId);
  switch (abilityId) {
    case 'RUIN':
      return stamina >= def.staminaCost;
    case 'GRAVE_BIND':
      return stamina >= def.staminaCost;
    case 'SHADOW_STEP': {
      const cost = Math.floor(stamina * ((def.staminaCostPct ?? 0) / 100));
      return cost > 0 && stamina >= cost;
    }
    case 'NAIL_TO_GRID':
      return stamina >= def.staminaCost;
    case 'BLOOD_TITHE':
      return stamina >= def.staminaCost && abyssalReserve > 0;
    case 'DEMONS_LUNG':
      return buffState.demonLungCooldown <= 0;
    case 'CRIMSON_PACT': {
      const cost = Math.ceil(maxSoulAnchor * ((def.hpCostPct ?? 0) / 100));
      return operativeHp > cost;
    }
    default:
      return false;
  }
}
