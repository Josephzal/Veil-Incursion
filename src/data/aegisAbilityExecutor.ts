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
  isUnitAlive,
  pullBacklineToFrontline,
  unitAtSlot,
} from './combatSquadEngine';
import { columnSlotsFor } from '../types/combatGrid';
import type { CombatGridSlotId } from '../types/combatGrid';
import { getAbilityDefinition } from './aegisAbilities';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import { boonMatchesAction } from './boonEngine';
import type { MutationCombatModifiers } from './boonEngine';

export interface PlayerCombatBuffState {
  demonLungCooldown: number;
  crimsonPactCharges: number;
  bonusApThisTurn: number;
  /** Shadow Step queues initiative hijack until the operative ends their turn. */
  initiativeQueued: boolean;
}

export interface AbilityHurtOptions {
  channel?: DamageChannel;
  fractureGain?: number;
  targetId?: string;
  abilityId?: AegisAbilityId;
  rollCrit?: boolean;
  echoHit?: boolean;
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
  setShadowStepEvadeActive?: (active: boolean) => void;
  ownedBoons: readonly LeyLineMutationId[];
  mutationMods: MutationCombatModifiers;
  bloodTitheCooldown: number;
  setVeilTarTurns?: (turns: number) => void;
  activateBloodBoundCarapace?: () => void;
  applyReaveBleed?: (unitId: string, turns: number) => void;
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
        eradicated = ctx.hurtEnemy(12, '[RUIN]', 'STRIKE', {
          channel: 'KINETIC',
          fractureGain: 0,
          abilityId: 'RUIN',
        }, unit.unitId) || eradicated;
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
        if (
          boonMatchesAction(ctx.ownedBoons, 'EXECUTIONERS_GRIP', ctx.abilityId)
          && ctx.mutationMods.graveBindArmorShred > 0
        ) {
          exposed = {
            ...exposed,
            kineticArmor: Math.max(0, (exposed.kineticArmor ?? 0) - ctx.mutationMods.graveBindArmorShred),
          };
        }
        ctx.syncSquad(
          pulled.map((u) => (u.unitId === exposed.unitId ? exposed : u)),
        );
        if (
          boonMatchesAction(ctx.ownedBoons, 'HEAVY_CALIBER', ctx.abilityId)
          && ctx.mutationMods.graveBindDamage > 0
        ) {
          ctx.hurtEnemy(
            ctx.mutationMods.graveBindDamage,
            '[GRAVE BIND]',
            'STRIKE',
            { channel: 'KINETIC', abilityId: ctx.abilityId },
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
      const eradicated = ctx.hurtEnemy(16, '[SHADOW STEP]', 'STRIKE', {
        channel: 'KINETIC',
        abilityId: 'SHADOW_STEP',
      }, unit.unitId);
      ctx.buffState.initiativeQueued = true;
      ctx.setShadowStepEvadeActive?.(true);
      ctx.log('[SHADOW STEP] >> Veil shift queued — end turn to seize initiative (+15% evade).');
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
      if (
        boonMatchesAction(ctx.ownedBoons, 'NECROTIC_ATROPHY', ctx.abilityId)
        && ctx.mutationMods.necroticAtrophyPct > 0
      ) {
        const reduced = Math.max(1, Math.floor(unit.baseDamage * (1 - ctx.mutationMods.necroticAtrophyPct / 100)));
        ctx.patchUnit(unit.unitId, { baseDamage: reduced });
        ctx.log('[NECROTIC ATROPHY] >> Debuff shaves target base damage.');
      }
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
      const eradicated = ctx.hurtEnemy(occult, '[BLOOD-TITHE]', 'STRIKE', {
        channel: 'OCCULT',
        fractureGain: 10,
        abilityId: 'BLOOD_TITHE',
      }, unit.unitId);
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
      ctx.log('[CRIMSON PACT] >> Blood oath sealed — next 2 attacks are guaranteed critical hits.');
      return { ok: true };
    }

    case 'DEVASTATE': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Devastate requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      if (!ctx.spendStamina(def.staminaCost)) {
        ctx.log('[REJECTED] >> Insufficient stamina.');
        return { ok: false, refundAp: def.apCost };
      }
      const fracturePool = unit.fractureGauge ?? 0;
      ctx.patchUnit(unit.unitId, {
        fractureGauge: 0,
        combatTags: (unit.combatTags ?? []).filter((tag) => tag !== 'FRACTURED'),
        fracturedThisRound: false,
      });
      ctx.hurtEnemy(4, '[DEVASTATE]', 'STRIKE', {
        channel: 'KINETIC',
        fractureGain: 0,
        abilityId: 'DEVASTATE',
      }, unit.unitId);
      if (fracturePool > 0) {
        const detonation = Math.max(8, Math.floor(fracturePool));
        ctx.hurtEnemy(detonation, '[DEVASTATE DETONATION]', 'STRIKE', {
          channel: 'TRUE',
          fractureGain: 0,
          abilityId: 'DEVASTATE',
        }, unit.unitId);
        ctx.log(`[DEVASTATE] >> Fracture detonated — ${detonation} True damage.`);
      } else {
        ctx.log('[DEVASTATE] >> Minimal crush — no latent fracture to detonate.');
      }
      return { ok: true };
    }

    case 'ABYSSAL_FAULT': {
      if (!ctx.spendStamina(def.staminaCost)) {
        ctx.log('[REJECTED] >> Insufficient stamina.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.setVeilTarTurns?.(3);
      for (const unit of aliveUnits(ctx.squad)) {
        if (!unit.unitId) continue;
        ctx.patchUnit(unit.unitId, {
          evadeChance: 0,
          evadeActive: false,
        });
      }
      ctx.log('[ABYSSAL FAULT] >> Veil-tar boils across the grid — 3-turn hazard seeded.');
      return { ok: true };
    }

    case 'BLOOD_BOUND_CARAPACE': {
      if (!ctx.sacrificeHpPct(def.hpCostPct ?? 10)) {
        ctx.log('[REJECTED] >> Insufficient soul anchor for carapace rite.');
        return { ok: false, refundAp: def.apCost };
      }
      ctx.activateBloodBoundCarapace?.();
      ctx.log('[BLOOD-BOUND CARAPACE] >> Calcified spikes extruded — full damage until next operative turn.');
      return { ok: true };
    }

    case 'REAVE': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId || !unit.gridSlot) {
        ctx.log('[REJECTED] >> Reave requires a column target.');
        return { ok: false, refundAp: def.apCost };
      }
      if (!ctx.spendStaminaPct(def.staminaCostPct ?? 15)) {
        ctx.log('[REJECTED] >> Insufficient stamina.');
        return { ok: false, refundAp: def.apCost };
      }
      const slots = columnSlotsFor(unit.gridSlot as CombatGridSlotId);
      let eradicated = false;
      for (const slot of slots) {
        const hit = unitAtSlot(ctx.squad, slot);
        if (!hit?.unitId || !isUnitAlive(hit)) continue;
        const kinetic = Math.max(14, Math.floor(ctx.strikeStats.strikeDamage * 1.15));
        const hadArmor = (hit.kineticArmor ?? 0) > 0;
        if (hadArmor) {
          ctx.patchUnit(hit.unitId, {
            kineticArmor: Math.max(0, (hit.kineticArmor ?? 0) - 1),
          });
        } else {
          ctx.applyReaveBleed?.(hit.unitId, 2);
        }
        eradicated = ctx.hurtEnemy(kinetic, '[REAVE]', 'STRIKE', {
          channel: 'KINETIC',
          fractureGain: 12,
          abilityId: 'REAVE',
        }, hit.unitId) || eradicated;
      }
      ctx.log('[REAVE] >> Void-pressure line — armor shattered or bleed inflicted.');
      if (eradicated) return { ok: true };
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
    case 'DEVASTATE':
      return stamina >= def.staminaCost;
    case 'ABYSSAL_FAULT':
      return stamina >= def.staminaCost;
    case 'BLOOD_BOUND_CARAPACE': {
      const cost = Math.ceil(maxSoulAnchor * ((def.hpCostPct ?? 0) / 100));
      return operativeHp > cost;
    }
    case 'REAVE': {
      const cost = Math.floor(stamina * ((def.staminaCostPct ?? 0) / 100));
      return cost > 0 && stamina >= cost;
    }
    default:
      return false;
  }
}
