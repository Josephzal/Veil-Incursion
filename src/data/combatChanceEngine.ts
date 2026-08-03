import {
  COMBAT_CHANCE,
  type CombatHitResolution,
  type EnemyCritContext,
  type EnemyEvadeContext,
  type PlayerCritContext,
  type PlayerEvadeContext,
} from '../types/combatChance';
import { isEnemyFractured, hasCombatTag } from './combatFractureEngine';

function clampChance(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function resolveEnemyStatEvadeChance(ctx: EnemyEvadeContext): number {
  if (ctx.bypassAllEvade) return 0;
  if (ctx.defender.isBoss) return 0;
  const statEvade = clampChance(ctx.defender.evadeChance ?? COMBAT_CHANCE.ENEMY_BASE_EVADE);
  const postureEvade = ctx.defender.evadeActive && !ctx.bypassPostureEvade
    ? COMBAT_CHANCE.EVADE_POSTURE_MISS_BONUS
    : 0;
  return clampChance(statEvade + postureEvade);
}

export function resolvePlayerEvadeChance(ctx: PlayerEvadeContext): number {
  if (ctx.momentumShiftEvadeDisabled) return 0;
  let total = COMBAT_CHANCE.PLAYER_BASE_EVADE;
  if (ctx.shadowStepEvadeActive) total += COMBAT_CHANCE.SHADOW_STEP_EVADE_BONUS;
  total += ctx.gridGhostEvadeStacks * COMBAT_CHANCE.GRID_GHOST_EVADE_PER_STACK;
  return clampChance(total);
}

export function resolvePlayerCritChance(ctx: PlayerCritContext): { chance: number; guaranteed: boolean } {
  if (ctx.guaranteedCrits > 0) {
    return { chance: 1, guaranteed: true };
  }
  let total = COMBAT_CHANCE.PLAYER_BASE_CRIT + ctx.factionCritBonus;
  if (ctx.abilityId === 'VEIL_PIERCER') {
    total += COMBAT_CHANCE.VEIL_PIERCER_CRIT_BONUS;
  }
  if (
    ctx.hasShatterPoint
    && (isEnemyFractured(ctx.target) || hasCombatTag(ctx.target, 'FRACTURED'))
  ) {
    total += COMBAT_CHANCE.SHATTER_POINT_CRIT_BONUS;
  }
  return { chance: clampChance(total), guaranteed: false };
}

export function resolveEnemyCritChance(ctx: EnemyCritContext): number {
  if (ctx.attacker.isBoss) return 0;
  return clampChance(ctx.attacker.critChance ?? COMBAT_CHANCE.ENEMY_BASE_CRIT);
}

export function rollEvade(chance: number): boolean {
  return chance > 0 && Math.random() < chance;
}

export function rollCrit(chance: number): boolean {
  return chance > 0 && Math.random() < chance;
}

export function resolvePlayerAttackHit(
  evadeCtx: EnemyEvadeContext,
  critCtx: PlayerCritContext,
): CombatHitResolution {
  if (rollEvade(resolveEnemyStatEvadeChance(evadeCtx))) {
    return { evaded: true, critical: false, ignoreDefenses: false, critMultiplier: 1 };
  }
  const { chance, guaranteed } = resolvePlayerCritChance(critCtx);
  const critical = guaranteed || rollCrit(chance);
  return {
    evaded: false,
    critical,
    ignoreDefenses: guaranteed,
    critMultiplier: critical ? COMBAT_CHANCE.CRIT_DAMAGE_MULTIPLIER : 1,
  };
}

export function resolveEnemyAttackHit(
  evadeCtx: PlayerEvadeContext,
  critCtx: EnemyCritContext,
): CombatHitResolution {
  if (rollEvade(resolvePlayerEvadeChance(evadeCtx))) {
    return { evaded: true, critical: false, ignoreDefenses: false, critMultiplier: 1 };
  }
  const critChance = resolveEnemyCritChance(critCtx);
  const critical = rollCrit(critChance);
  return {
    evaded: false,
    critical,
    ignoreDefenses: false,
    critMultiplier: critical ? COMBAT_CHANCE.CRIT_DAMAGE_MULTIPLIER : 1,
  };
}

export function applyCritMultiplier(damage: number, multiplier: number): number {
  if (multiplier <= 1 || damage <= 0) return damage;
  return Math.max(1, Math.floor(damage * multiplier));
}
