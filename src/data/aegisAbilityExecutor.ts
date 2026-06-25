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
import { columnSlotsFor, FRONTLINE_SLOTS } from '../types/combatGrid';
import type { CombatGridSlotId } from '../types/combatGrid';
import { getAbilityDefinition } from './aegisAbilities';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import { boonMatchesAction } from './boonEngine';
import type { MutationCombatModifiers } from './boonEngine';
import type { BrandConsumeMode } from './aegisResourceEngine';
import {
  applyDeepLungsOnRestore,
  slipstreamMobilityActive,
} from './aegisBoonHookRunner';
import {
  ashenMantleDuration,
  bloodTitheHealAmount,
  bloodTitheOccultDamage,
  canAffordReserveCost,
  ruinFracturePerBrand,
} from './aegisResourceEngine';

export interface PlayerCombatBuffState {
  demonLungCooldown: number;
  crimsonPactCharges: number;
  bonusApThisTurn: number;
  bonusApNextTurn: number;
  ashenMantleTurnsRemaining: number;
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
  ignoreDefenses?: boolean;
  critBonusPct?: number;
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
  runicBrands: number;
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
  consumeAbyssalFlat?: (amount: number) => boolean;
  imprintBrand: (count: number) => void;
  setRunicBrands: (count: number) => void;
  consumeBrands: (mode: BrandConsumeMode) => number;
  healOperative: (amount: number) => void;
  sacrificeHpPct: (pct: number) => boolean;
  grantBonusAp: (amount: number) => void;
  grantBonusApNextTurn: (amount: number) => void;
  setAegisOvercharged: (active: boolean) => void;
  restoreStaminaPct: (pct: number) => void;
  reduceEnemyAp: (unitId: string, amount: number) => void;
  setShadowStepEvadeActive?: (active: boolean) => void;
  ownedBoons: readonly LeyLineMutationId[];
  mutationMods: MutationCombatModifiers;
  bloodTitheCooldown: number;
  ashenMantleCooldown: number;
  setBloodTitheCooldown: (turns: number) => void;
  setAshenMantleCooldown: (turns: number) => void;
  setVeilTarTurns?: (turns: number) => void;
  activateBloodBoundCarapace?: () => void;
  applyReaveBleed?: (unitId: string, turns: number) => void;
  setAshenMantleActive?: (turns: number) => void;
}

export type AbilityExecutionResult =
  | { ok: true; squad?: EnemyCombatProfile[] }
  | { ok: false; refundAp: number };

function targetUnit(ctx: AbilityExecutionContext): EnemyCombatProfile | null {
  if (!ctx.targetId) return null;
  return getUnitById(ctx.squad, ctx.targetId) ?? null;
}

function spendAbilityReserveCost(
  ctx: AbilityExecutionContext,
  def: ReturnType<typeof getAbilityDefinition>,
): boolean {
  if (def.reserveCost != null && def.reserveCost > 0) {
    if (!ctx.consumeAbyssalFlat?.(def.reserveCost)) {
      ctx.log('[REJECTED] >> Insufficient Abyssal Reserve.');
      return false;
    }
    return true;
  }
  if (def.reserveCostPct != null && def.reserveCostPct > 0) {
    const consumed = ctx.consumeAbyssalPct(def.reserveCostPct);
    if (consumed <= 0) {
      ctx.log('[REJECTED] >> Insufficient Abyssal Reserve.');
      return false;
    }
    return true;
  }
  return true;
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

function frontlineUnits(squad: EnemyCombatProfile[]): EnemyCombatProfile[] {
  return aliveUnits(squad).filter(
    (unit) => unit.gridSlot && FRONTLINE_SLOTS.includes(unit.gridSlot as CombatGridSlotId),
  );
}

export function executeExtendedAbility(ctx: AbilityExecutionContext): AbilityExecutionResult {
  const def = getAbilityDefinition(ctx.abilityId);

  switch (ctx.abilityId) {
    case 'RUIN': {
      const brandsSpent = ctx.consumeBrands('ALL');
      const fractureGain = ruinFracturePerBrand(brandsSpent);
      let eradicated = false;
      const targets = frontlineUnits(ctx.squad);
      const hitTargets = targets.length > 0 ? targets : aliveUnits(ctx.squad);
      for (const unit of hitTargets) {
        if (!unit.unitId) continue;
        const instantStun = brandsSpent >= 3 && hasCombatTag(unit, 'CONCUSSED');
        let next = applyFractureToUnit(unit, fractureGain, instantStun);
        ctx.patchUnit(unit.unitId, next);
        eradicated = ctx.hurtEnemy(12, '[RUIN]', 'STRIKE', {
          channel: 'KINETIC',
          fractureGain: 0,
          abilityId: 'RUIN',
        }, unit.unitId) || eradicated;
      }
      ctx.log(
        brandsSpent > 0
          ? `[RUIN] >> ${brandsSpent} Brand(s) spent — frontline fracture shockwave (+${fractureGain} fracture).`
          : '[RUIN] >> Fracture shockwave — no Brands imprinted.',
      );
      if (eradicated) return { ok: true };
      return { ok: true };
    }

    case 'ASHEN_MANTLE': {
      const freeWard = ctx.mutationMods.ashenMantleFree;
      if (!freeWard && ctx.ashenMantleCooldown > 0) {
        ctx.log(`[REJECTED] >> Ashen Mantle on cooldown (${ctx.ashenMantleCooldown} turns).`);
        return { ok: false, refundAp: def.apCost };
      }
      const brandsSpent = ctx.consumeBrands('ALL');
      const duration = ashenMantleDuration(brandsSpent);
      ctx.buffState.ashenMantleTurnsRemaining = duration;
      ctx.setAshenMantleActive?.(duration);
      if (freeWard) {
        ctx.setAshenMantleCooldown(3);
      }
      ctx.log(
        `[ASHEN MANTLE] >> ${brandsSpent} Brand(s) consumed — ${duration}-turn mantle (50% damage reduction).`,
      );
      return { ok: true };
    }

    case 'GRAVE_BIND': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId || !unit.gridSlot?.startsWith('BL')) {
        ctx.log('[REJECTED] >> Grave Bind requires a backline target.');
        return { ok: false, refundAp: def.apCost };
      }
      if (!spendAbilityReserveCost(ctx, def)) {
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
      const slipstreamCost = ctx.mutationMods.slipstreamReserveCost;
      const useSlipstream = slipstreamCost > 0
        && slipstreamMobilityActive(ctx.ownedBoons, ctx.abilityId, ctx.mutationMods);
      if (useSlipstream) {
        if (ctx.abyssalReserve < slipstreamCost) {
          ctx.log('[REJECTED] >> Insufficient Reserve for Slipstream mobility.');
          return { ok: false, refundAp: def.apCost };
        }
        if (!ctx.consumeAbyssalFlat?.(slipstreamCost)) {
          ctx.log('[REJECTED] >> Slipstream Reserve tithe failed.');
          return { ok: false, refundAp: def.apCost };
        }
        ctx.log(`[SLIPSTREAM] >> −${slipstreamCost}% Reserve — mobility tax waived.`);
      } else if (!spendAbilityReserveCost(ctx, def)) {
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
      if (!spendAbilityReserveCost(ctx, def)) {
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
      applyDeepLungsOnRestore(ctx.ownedBoons, ctx.abilityId, ctx.setRunicBrands, ctx.log);
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        ctx.log('[REJECTED] >> Blood-Tithe requires a target.');
        return { ok: false, refundAp: def.apCost };
      }
      if (ctx.bloodTitheCooldown > 0) {
        ctx.log(`[REJECTED] >> Blood-Tithe on cooldown (${ctx.bloodTitheCooldown} turns).`);
        return { ok: false, refundAp: def.apCost };
      }
      const minReserve = def.minReservePct ?? 30;
      if (!ctx.mutationMods.bloodTitheFree && ctx.abyssalReserve < minReserve) {
        ctx.log(`[REJECTED] >> Abyssal Reserve below ${minReserve}% — tithe refused.`);
        return { ok: false, refundAp: def.apCost };
      }
      const brandsSpent = ctx.consumeBrands('ALL');
      const consumed = ctx.mutationMods.bloodTitheFree ? 0 : ctx.consumeAbyssalPct(minReserve);
      if (!ctx.mutationMods.bloodTitheFree && consumed <= 0) {
        ctx.log('[REJECTED] >> Abyssal Reserve too low for tithe.');
        return { ok: false, refundAp: def.apCost };
      }
      const titheBase = consumed > 0 ? consumed : minReserve;
      const heal = bloodTitheHealAmount(
        ctx.maxSoulAnchor,
        titheBase,
        ctx.mutationMods.bloodTitheHealPctPer10Ar,
      );
      if (ctx.mutationMods.bloodTitheCooldown > 0) {
        ctx.setBloodTitheCooldown(ctx.mutationMods.bloodTitheCooldown);
      }
      if (heal > 0) ctx.healOperative(heal);
      const occult = bloodTitheOccultDamage(titheBase, brandsSpent);
      const eradicated = ctx.hurtEnemy(occult, '[BLOOD-TITHE]', 'STRIKE', {
        channel: 'OCCULT',
        fractureGain: 10,
        abilityId: 'BLOOD_TITHE',
      }, unit.unitId);
      ctx.log(
        `[BLOOD-TITHE] >> ${titheBase} AR tithed, ${brandsSpent} Brand(s) spent — ${heal} HP restored.`,
      );
      if (eradicated) return { ok: true };
      return { ok: true };
    }

    case 'DEMONS_LUNG': {
      if (ctx.buffState.demonLungCooldown > 0) {
        ctx.log(`[REJECTED] >> Demon's Lung on cooldown (${ctx.buffState.demonLungCooldown} turns).`);
        return { ok: false, refundAp: def.apCost };
      }
      applyDeepLungsOnRestore(ctx.ownedBoons, ctx.abilityId, ctx.setRunicBrands, ctx.log);
      ctx.chargeAr((def.reserveGain ?? 30) + ctx.mutationMods.demonLungReserveBonus);
      ctx.setAegisOvercharged(true);
      ctx.grantBonusApNextTurn(1);
      ctx.buffState.demonLungCooldown = def.cooldownTurns ?? 3;
      ctx.log("[DEMON'S LUNG] >> Reserve surge — Overcharged, +1 AP queued for next turn.");
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
      const required = def.requiredBrands ?? 3;
      if (ctx.runicBrands < required) {
        ctx.log(`[REJECTED] >> Devastate requires ${required} Runic Brands.`);
        return { ok: false, refundAp: def.apCost };
      }
      const brandsSpent = ctx.consumeBrands(def.brandsConsumed ?? required);
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
        ctx.log(`[DEVASTATE] >> ${brandsSpent} Brand(s) spent — ${detonation} True damage detonation.`);
      } else {
        ctx.log('[DEVASTATE] >> Brands spent — no latent fracture to detonate.');
      }
      return { ok: true };
    }

    case 'ABYSSAL_FAULT': {
      if (!spendAbilityReserveCost(ctx, def)) {
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
      if (!spendAbilityReserveCost(ctx, def)) {
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
  _stamina: number,
  abyssalReserve: number,
  operativeHp: number,
  maxSoulAnchor: number,
  buffState: PlayerCombatBuffState,
  runicBrands: number,
  options?: {
    ashenMantleCooldown?: number;
    ashenMantleFree?: boolean;
  },
): boolean {
  const def = getAbilityDefinition(abilityId);
  switch (abilityId) {
    case 'RUIN':
      return true;
    case 'ASHEN_MANTLE':
      if (options?.ashenMantleFree) {
        return (options.ashenMantleCooldown ?? 0) <= 0;
      }
      return true;
    case 'GRAVE_BIND':
    case 'NAIL_TO_GRID':
    case 'ABYSSAL_FAULT':
      return canAffordReserveCost(def, abyssalReserve);
    case 'SHADOW_STEP':
      return canAffordReserveCost(def, abyssalReserve);
    case 'BLOOD_TITHE':
      return abyssalReserve >= (def.minReservePct ?? 30);
    case 'DEMONS_LUNG':
      return buffState.demonLungCooldown <= 0;
    case 'CRIMSON_PACT': {
      const cost = Math.ceil(maxSoulAnchor * ((def.hpCostPct ?? 0) / 100));
      return operativeHp > cost;
    }
    case 'DEVASTATE':
      return runicBrands >= (def.requiredBrands ?? 3);
    case 'BLOOD_BOUND_CARAPACE': {
      const cost = Math.ceil(maxSoulAnchor * ((def.hpCostPct ?? 0) / 100));
      return operativeHp > cost;
    }
    case 'REAVE':
      return canAffordReserveCost(def, abyssalReserve);
    default:
      return false;
  }
}
