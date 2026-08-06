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
import { columnSlotsFor, ALL_GRID_SLOTS } from '../types/combatGrid';
import type { CombatGridSlotId } from '../types/combatGrid';
import { getAbilityDefinition, getAbilityTags } from './aegisAbilities';
import { playCombatPresentationCue } from '../utils/combatPresentationAudio';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import { boonMatchesAction } from './boonEngine';
import type { MutationCombatModifiers } from './boonEngine';
import type { BrandConsumeMode } from './aegisResourceEngine';
import {
  applyDeepLungsOnRestore,
  slipstreamMobilityActive,
} from './aegisBoonHookRunner';
import { ruinFracturePerBrand } from './aegisResourceEngine';
import {
  ASHEN_MANTLE_DURATION_TURNS,
  DEVASTATE_KINETIC_DAMAGE,
  devastateTrueDamage,
  finalMercyTrueDamage,
  isFinalMercyEligible,
  isPlayableAegisTechniqueId,
} from './aegisTechniqueCommitEngine';
import {
  AEGIS_TECHNIQUE_STRIKE_POWER_BASE,
  reaveKineticDamage,
  veilPiercerOccultDamage,
} from './aegisTechniquePowerEngine';
import { canAffordGraftResources } from './veilGraftEngine';
import type { GraftCastPlan } from '../types/veilGraft';
import { isAegisTechniqueId } from './aegisTechniqueCatalog';

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
  /** Skip accuracy / evade for deterministic techniques (Final Mercy). */
  skipEvade?: boolean;
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
  /** Brands already deducted at commitment (for scaling / logs). */
  committedBrandsSpent?: number;
  /** True when AP/Brand/HP were already committed atomically. */
  costsCommitted?: boolean;
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
  activateRuneboundCarapace?: () => void;
  applyReaveBleed?: (unitId: string, turns: number) => void;
  setAshenMantleActive?: (turns: number) => void;
}

export type AbilityExecutionResult =
  | { ok: true; squad?: EnemyCombatProfile[]; resolutionBegan?: boolean }
  | { ok: false; refundAp: number; rollbackCommit?: boolean; reason?: string };

/** Prefer technique-owned power; migration fallback to strikeDamage for older callers. */
function techniqueStrikePowerFromCtx(ctx: AbilityExecutionContext): number {
  return ctx.strikeStats.aegisTechniqueStrikePower
    ?? ctx.strikeStats.strikeDamage
    ?? AEGIS_TECHNIQUE_STRIKE_POWER_BASE;
}

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

function fullGridUnits(squad: EnemyCombatProfile[]): EnemyCombatProfile[] {
  return aliveUnits(squad).filter(
    (unit) => unit.gridSlot && ALL_GRID_SLOTS.includes(unit.gridSlot as CombatGridSlotId),
  );
}

function rejectPreResolution(
  ctx: AbilityExecutionContext,
  reason: string,
  defAp: number,
): AbilityExecutionResult {
  ctx.log(`[REJECTED] >> ${reason}`);
  if (ctx.costsCommitted) {
    return { ok: false, refundAp: 0, rollbackCommit: true, reason };
  }
  return { ok: false, refundAp: defAp, reason };
}

export function executeExtendedAbility(ctx: AbilityExecutionContext): AbilityExecutionResult {
  const def = getAbilityDefinition(ctx.abilityId);

  switch (ctx.abilityId) {
    case 'RUIN': {
      const spent = ctx.committedBrandsSpent
        ?? (ctx.costsCommitted ? 0 : ctx.consumeBrands('ALL'));
      if (spent < 1) {
        return rejectPreResolution(ctx, 'Ruin requires at least 1 Runic Brand.', def.apCost);
      }
      const fractureGain = ruinFracturePerBrand(spent);
      let eradicated = false;
      const targets = fullGridUnits(ctx.squad);
      const hitTargets = targets.length > 0 ? targets : aliveUnits(ctx.squad);
      playCombatPresentationCue('sfx.aegis.ruin');
      for (const unit of hitTargets) {
        if (!unit.unitId) continue;
        const instantStun = spent >= 3 && hasCombatTag(unit, 'CONCUSSED');
        const next = applyFractureToUnit(unit, fractureGain, instantStun);
        ctx.patchUnit(unit.unitId, next);
        eradicated = ctx.hurtEnemy(12, '[RUIN]', 'STRIKE', {
          channel: 'KINETIC',
          fractureGain: 0,
          abilityId: 'RUIN',
        }, unit.unitId) || eradicated;
      }
      ctx.log(
        `[RUIN] >> ${spent} Brand(s) spent — full-grid fracture shockwave (+${fractureGain} fracture).`,
      );
      return { ok: true, resolutionBegan: true };
    }

    case 'VEIL_PIERCER': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        return rejectPreResolution(ctx, 'Veil-Piercer requires a target.', def.apCost);
      }
      const hpBefore = unit.currentHp ?? 0;
      const occult = veilPiercerOccultDamage(techniqueStrikePowerFromCtx(ctx));
      const eradicated = ctx.hurtEnemy(occult, '[VEIL-PIERCER]', 'STRIKE', {
        channel: 'OCCULT',
        fractureGain: 15,
        abilityId: 'VEIL_PIERCER',
        ignoreDefenses: true,
        critBonusPct: def.critBonusPct ?? 10,
      }, unit.unitId);
      const after = getUnitById(ctx.squad, unit.unitId);
      const connected = eradicated || (after != null && (after.currentHp ?? 0) < hpBefore);
      if (connected) {
        ctx.chargeAr(def.reserveGain ?? 20);
      }
      ctx.log(
        connected
          ? `[VEIL-PIERCER] >> ${ctx.committedBrandsSpent ?? 1} Brand spent — occult pierce connects.`
          : `[VEIL-PIERCER] >> ${ctx.committedBrandsSpent ?? 1} Brand spent — pierce missed.`,
      );
      return { ok: true, resolutionBegan: true };
    }

    case 'ASHEN_MANTLE': {
      const freeWard = ctx.mutationMods.ashenMantleFree;
      if (!freeWard && ctx.ashenMantleCooldown > 0) {
        return rejectPreResolution(
          ctx,
          `Ashen Mantle on cooldown (${ctx.ashenMantleCooldown} turns).`,
          def.apCost,
        );
      }
      const duration = ASHEN_MANTLE_DURATION_TURNS;
      ctx.buffState.ashenMantleTurnsRemaining = duration;
      ctx.setAshenMantleActive?.(duration);
      if (freeWard) {
        ctx.setAshenMantleCooldown(3);
      }
      playCombatPresentationCue('sfx.aegis.player_buff');
      ctx.log(
        `[ASHEN MANTLE] >> Mantle armed — 50% damage reduction through the next enemy phase.`,
      );
      return { ok: true, resolutionBegan: true };
    }

    case 'GRAVE_BIND': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId || !unit.gridSlot?.startsWith('BL')) {
        return rejectPreResolution(ctx, 'Grave Bind requires a backline target.', def.apCost);
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
      return { ok: true, squad: pulled, resolutionBegan: true };
    }

    case 'SHADOW_STEP': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        return rejectPreResolution(ctx, 'Shadow Step requires a target.', def.apCost);
      }
      const slipstreamCost = ctx.mutationMods.slipstreamReserveCost;
      const useSlipstream = slipstreamCost > 0
        && slipstreamMobilityActive(ctx.ownedBoons, ctx.abilityId, ctx.mutationMods);
      if (useSlipstream) {
        if (ctx.abyssalReserve < slipstreamCost) {
          return rejectPreResolution(ctx, 'Insufficient Reserve for Slipstream mobility.', def.apCost);
        }
        if (!ctx.consumeAbyssalFlat?.(slipstreamCost)) {
          return rejectPreResolution(ctx, 'Slipstream Reserve tithe failed.', def.apCost);
        }
        ctx.log(`[SLIPSTREAM] >> −${slipstreamCost}% Reserve — mobility tax waived.`);
      }
      const next = applyFractureDamage(unit, 50);
      ctx.patchUnit(unit.unitId, next);
      ctx.hurtEnemy(16, '[SHADOW STEP]', 'STRIKE', {
        channel: 'KINETIC',
        abilityId: 'SHADOW_STEP',
      }, unit.unitId);
      ctx.buffState.initiativeQueued = true;
      ctx.setShadowStepEvadeActive?.(true);
      ctx.log('[SHADOW STEP] >> Veil shift queued — end turn to seize initiative (+15% evade).');
      return { ok: true, resolutionBegan: true };
    }

    case 'NAIL_TO_GRID': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        return rejectPreResolution(ctx, 'Nail to Grid requires a target.', def.apCost);
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
      return { ok: true, resolutionBegan: true };
    }

    case 'DEMONS_LUNG': {
      if (ctx.buffState.demonLungCooldown > 0) {
        return rejectPreResolution(
          ctx,
          `Demon's Lung on cooldown (${ctx.buffState.demonLungCooldown} turns).`,
          def.apCost,
        );
      }
      applyDeepLungsOnRestore(ctx.ownedBoons, ctx.abilityId, ctx.chargeAr, ctx.log);
      ctx.chargeAr(def.reserveGain ?? 30);
      ctx.setAegisOvercharged(true);
      ctx.grantBonusApNextTurn(1);
      ctx.buffState.demonLungCooldown = def.cooldownTurns ?? 3;
      ctx.log("[DEMON'S LUNG] >> Reserve surge — Overcharged, +1 AP queued for next turn.");
      return { ok: true, resolutionBegan: true };
    }

    case 'CRIMSON_PACT': {
      // HP already committed atomically when costsCommitted.
      if (!ctx.costsCommitted) {
        const hpPct = ctx.mutationMods.crimsonPactHpCostPct ?? def.hpCostPct ?? 12;
        if (!ctx.sacrificeHpPct(hpPct)) {
          return rejectPreResolution(ctx, 'Insufficient soul anchor for pact.', def.apCost);
        }
      }
      ctx.buffState.crimsonPactCharges = 2;
      ctx.log('[CRIMSON PACT] >> Blood oath sealed — next 2 authored attacks gain a guaranteed critical charge.');
      return { ok: true, resolutionBegan: true };
    }

    case 'DEVASTATE': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        return rejectPreResolution(ctx, 'Devastate requires a Fractured target.', def.apCost);
      }
      if (!isEnemyFractured(unit)) {
        return rejectPreResolution(ctx, 'Devastate requires a Fractured target.', def.apCost);
      }
      const spent = ctx.committedBrandsSpent ?? 3;
      const detonation = devastateTrueDamage(unit);
      // 1–2: damage while still Fractured (True uses Fracture threshold, not live gauge)
      ctx.hurtEnemy(DEVASTATE_KINETIC_DAMAGE, '[DEVASTATE]', 'STRIKE', {
        channel: 'KINETIC',
        fractureGain: 0,
        abilityId: 'DEVASTATE',
      }, unit.unitId);
      ctx.hurtEnemy(detonation, '[DEVASTATE DETONATION]', 'STRIKE', {
        channel: 'TRUE',
        fractureGain: 0,
        abilityId: 'DEVASTATE',
      }, unit.unitId);
      // 3–4: consume Fractured and reset gauge
      const after = getUnitById(ctx.squad, unit.unitId);
      if (after?.unitId) {
        ctx.patchUnit(after.unitId, {
          fractureGauge: 0,
          combatTags: (after.combatTags ?? []).filter((tag) => tag !== 'FRACTURED'),
          fracturedThisRound: false,
        });
      }
      ctx.log(
        `[DEVASTATE] >> ${spent} Brand(s) spent — ${detonation} True (Fracture threshold cashout).`,
      );
      return { ok: true, resolutionBegan: true };
    }

    case 'FINAL_MERCY': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId) {
        return rejectPreResolution(
          ctx,
          'Final Mercy requires a living enemy at or below 25% HP.',
          def.apCost,
        );
      }
      // Threshold snapshotted at commitment; re-check only for death/invalid.
      if ((unit.currentHp ?? 0) <= 0) {
        return rejectPreResolution(ctx, 'Final Mercy target is no longer valid.', def.apCost);
      }
      const trueDmg = finalMercyTrueDamage(unit);
      const eradicated = ctx.hurtEnemy(trueDmg, '[FINAL MERCY]', 'STRIKE', {
        channel: 'TRUE',
        fractureGain: 0,
        abilityId: 'FINAL_MERCY',
        rollCrit: false,
        skipEvade: true,
        ignoreDefenses: true,
      }, unit.unitId);
      if (eradicated) {
        const heal = Math.floor(ctx.maxSoulAnchor * 0.10);
        if (heal > 0) ctx.healOperative(heal);
        ctx.log(
          unit.isBoss
            ? `[FINAL MERCY] >> Boss struck for ${trueDmg} True — mercy heals ${heal} HP.`
            : `[FINAL MERCY] >> Target executed — mercy heals ${heal} HP.`,
        );
      } else {
        ctx.log(
          unit.isBoss
            ? `[FINAL MERCY] >> Boss struck for ${trueDmg} True.`
            : `[FINAL MERCY] >> True judgment delivered (${trueDmg}).`,
        );
      }
      return { ok: true, resolutionBegan: true };
    }

    case 'RUNEBOUND_CARAPACE': {
      ctx.activateRuneboundCarapace?.();
      playCombatPresentationCue('sfx.aegis.player_buff');
      ctx.log(
        '[RUNEBOUND CARAPACE] >> Carapace armed — reflect after the first blockable melee hit that damages you.',
      );
      return { ok: true, resolutionBegan: true };
    }

    case 'REAVE': {
      const unit = targetUnit(ctx);
      if (!unit?.unitId || !unit.gridSlot) {
        return rejectPreResolution(ctx, 'Reave requires a column target.', def.apCost);
      }
      const slots = columnSlotsFor(unit.gridSlot as CombatGridSlotId);
      let eradicated = false;
      for (const slot of slots) {
        const hit = unitAtSlot(ctx.squad, slot);
        if (!hit?.unitId || !isUnitAlive(hit)) continue;
        const kinetic = reaveKineticDamage(techniqueStrikePowerFromCtx(ctx));
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
      return { ok: true, resolutionBegan: true };
    }

    default:
      if (isPlayableAegisTechniqueId(ctx.abilityId) || isAegisTechniqueId(ctx.abilityId)) {
        return rejectPreResolution(ctx, 'Technique resolver unavailable.', def.apCost);
      }
      return { ok: false, refundAp: def.apCost, reason: 'Ability unavailable.' };
  }
}

export function isExtendedAbilityEnabled(
  abilityId: AegisAbilityId,
  _stamina: number,
  _abyssalReserve: number,
  operativeHp: number,
  maxSoulAnchor: number,
  buffState: PlayerCombatBuffState,
  runicBrands: number,
  options?: {
    ashenMantleCooldown?: number;
    ashenMantleFree?: boolean;
    target?: EnemyCombatProfile | null;
    hpCostPct?: number;
  },
): boolean {
  const def = getAbilityDefinition(abilityId);
  switch (abilityId) {
    case 'RUIN':
      return runicBrands >= (def.requiredBrands ?? 1);
    case 'VEIL_PIERCER':
    case 'DEMONS_LUNG':
      if (abilityId === 'DEMONS_LUNG' && buffState.demonLungCooldown > 0) return false;
      return runicBrands >= (def.requiredBrands ?? 1);
    case 'FINAL_MERCY':
      return runicBrands >= (def.requiredBrands ?? 2)
        && !!options?.target
        && isFinalMercyEligible(options.target);
    case 'ASHEN_MANTLE':
      if (options?.ashenMantleFree) {
        return (options.ashenMantleCooldown ?? 0) <= 0;
      }
      return true;
    case 'GRAVE_BIND':
    case 'NAIL_TO_GRID':
    case 'SHADOW_STEP':
    case 'REAVE':
    case 'RUNEBOUND_CARAPACE':
      return true;
    case 'CRIMSON_PACT': {
      if (runicBrands < (def.requiredBrands ?? 1)) return false;
      const hpPct = options?.hpCostPct ?? def.hpCostPct ?? 12;
      const cost = Math.ceil(maxSoulAnchor * (hpPct / 100));
      return operativeHp - cost >= 1;
    }
    case 'DEVASTATE':
      return runicBrands >= (def.requiredBrands ?? 3)
        && !!options?.target
        && isEnemyFractured(options.target);
    default:
      return false;
  }
}

export interface AegisAbilityDisableContext {
  isPlayerTurn: boolean;
  cycleState: string;
  shadowstepProc: boolean;
  encounterUltimateDisabled: boolean;
  playerAp: number;
  graftPlan: GraftCastPlan;
  graftCooldown: number;
  jammedSlots: readonly number[];
  loadout: readonly string[];
  rooted: boolean;
  voidWardPrimed: boolean;
  abyssalReserve: number;
  operativeHp: number;
  maxSoulAnchor: number;
  runicBrands: number;
  buffState: PlayerCombatBuffState;
  ashenMantleCooldown?: number;
  ashenMantleFree?: boolean;
  target?: EnemyCombatProfile | null;
  hpCostPct?: number;
}

function getExtendedAbilityDisableReason(
  abilityId: AegisAbilityId,
  operativeHp: number,
  maxSoulAnchor: number,
  buffState: PlayerCombatBuffState,
  runicBrands: number,
  options?: {
    ashenMantleCooldown?: number;
    ashenMantleFree?: boolean;
    target?: EnemyCombatProfile | null;
    hpCostPct?: number;
  },
): string | null {
  const def = getAbilityDefinition(abilityId);
  switch (abilityId) {
    case 'RUIN':
      if (runicBrands < (def.requiredBrands ?? 1)) {
        return `Requires at least ${def.requiredBrands ?? 1} Runic Brand (have ${runicBrands}).`;
      }
      return null;
    case 'VEIL_PIERCER':
      if (runicBrands < (def.requiredBrands ?? 1)) {
        return `Requires ${def.requiredBrands ?? 1} Runic Brand (have ${runicBrands}).`;
      }
      return null;
    case 'ASHEN_MANTLE':
      if (options?.ashenMantleFree && (options.ashenMantleCooldown ?? 0) > 0) {
        return `Ashen Mantle cooling down (${options.ashenMantleCooldown} turn${options.ashenMantleCooldown === 1 ? '' : 's'}).`;
      }
      return null;
    case 'GRAVE_BIND':
    case 'NAIL_TO_GRID':
    case 'SHADOW_STEP':
    case 'REAVE':
    case 'RUNEBOUND_CARAPACE':
      return null;
    case 'DEMONS_LUNG':
      if (buffState.demonLungCooldown > 0) {
        return `Demon's Lung cooling down (${buffState.demonLungCooldown} turn${buffState.demonLungCooldown === 1 ? '' : 's'}).`;
      }
      if (runicBrands < (def.requiredBrands ?? 1)) {
        return `Requires ${def.requiredBrands ?? 1} Runic Brand (have ${runicBrands}).`;
      }
      return null;
    case 'CRIMSON_PACT': {
      if (runicBrands < (def.requiredBrands ?? 1)) {
        return `Requires ${def.requiredBrands ?? 1} Runic Brand (have ${runicBrands}).`;
      }
      const hpPct = options?.hpCostPct ?? def.hpCostPct ?? 12;
      const cost = Math.ceil(maxSoulAnchor * (hpPct / 100));
      if (operativeHp - cost < 1) {
        return `Requires ${cost} HP while remaining at 1+ HP (have ${operativeHp}).`;
      }
      return null;
    }
    case 'DEVASTATE':
      if (runicBrands < (def.requiredBrands ?? 3)) {
        return `Requires ${def.requiredBrands ?? 3} Runic Brands (have ${runicBrands}).`;
      }
      if (!options?.target || !isEnemyFractured(options.target)) {
        return 'Requires a Fractured target.';
      }
      return null;
    case 'FINAL_MERCY':
      if (runicBrands < (def.requiredBrands ?? 2)) {
        return `Requires ${def.requiredBrands ?? 2} Runic Brands (have ${runicBrands}).`;
      }
      if (!options?.target || !isFinalMercyEligible(options.target)) {
        return 'Requires a living enemy at or below 25% maximum HP.';
      }
      return null;
    default:
      return 'Ability unavailable.';
  }
}

export function getAegisAbilityDisableReason(
  abilityId: AegisAbilityId,
  ctx: AegisAbilityDisableContext,
): string | null {
  if (!ctx.isPlayerTurn || ctx.cycleState !== 'TEXT_COMBAT' || ctx.shadowstepProc) {
    return 'Wait for your combat phase.';
  }
  if (ctx.encounterUltimateDisabled && getAbilityTags(abilityId).includes('ULTIMATE')) {
    return 'Ultimate channel sealed by Apex Graft.';
  }
  if (ctx.rooted && (abilityId === 'WRAITH_PARRY' || abilityId === 'SHADOW_STEP')) {
    return 'Rooted — parry and mobility blocked.';
  }
  if (ctx.jammedSlots.some((slot) => ctx.loadout[slot] === abilityId)) {
    return 'Augment slot jammed this encounter.';
  }
  if (ctx.graftCooldown > 0) {
    return `Graft cooling down (${ctx.graftCooldown} turn${ctx.graftCooldown === 1 ? '' : 's'}).`;
  }
  if (ctx.playerAp < ctx.graftPlan.apCost) {
    return `Requires ${ctx.graftPlan.apCost} AP (have ${ctx.playerAp}).`;
  }
  const graftAfford = canAffordGraftResources(ctx.graftPlan, ctx.abyssalReserve, ctx.runicBrands);
  if (!graftAfford.ok) return graftAfford.reason;

  switch (abilityId) {
    case 'STRIKE':
      return null;
    case 'WRAITH_PARRY':
      return ctx.voidWardPrimed ? 'Void Ward already primed.' : null;
    case 'VEIL_PIERCER':
    case 'RUIN':
    case 'ASHEN_MANTLE':
    case 'GRAVE_BIND':
    case 'SHADOW_STEP':
    case 'NAIL_TO_GRID':
    case 'DEMONS_LUNG':
    case 'CRIMSON_PACT':
    case 'DEVASTATE':
    case 'FINAL_MERCY':
    case 'RUNEBOUND_CARAPACE':
    case 'REAVE':
      return getExtendedAbilityDisableReason(
        abilityId,
        ctx.operativeHp,
        ctx.maxSoulAnchor,
        ctx.buffState,
        ctx.runicBrands,
        {
          ashenMantleCooldown: ctx.ashenMantleCooldown,
          ashenMantleFree: ctx.ashenMantleFree,
          target: ctx.target,
          hpCostPct: ctx.hpCostPct,
        },
      );
    default:
      return 'Ability unavailable.';
  }
}
