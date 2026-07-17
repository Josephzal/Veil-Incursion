import type { EnemyIntent } from '../types/run';
import {
  isAttackIntent,
  isDefensiveIntent,
  isPressureArchetype,
  isSupportLikeRole,
  type EnemyAiMemory,
  type EnemyAiTacticalRole,
} from './enemyAiMemory';

export interface AiScoringEnemySnapshot {
  hp: number;
  maxHp: number;
  aiMemory?: EnemyAiMemory;
  tacticalRole?: EnemyAiTacticalRole;
  isMarkedOrExposed?: boolean;
  isChargingOrPreparing?: boolean;
  isEliteOrAlpha?: boolean;
  isBoss?: boolean;
}

export interface AiScoringPlayerSnapshot {
  hp: number;
  maxHp: number;
  actionPoints?: number;
}

export interface AiScoringContext {
  enemy: AiScoringEnemySnapshot;
  player: AiScoringPlayerSnapshot;
  combatRound?: number;
  isLastEnemyAlive?: boolean;
  squadHasDefenderPosture?: boolean;
}

export interface WeightedIntentLike {
  intent: EnemyIntent;
  weight: number;
}

const DEFENSIVE_INTENTS: EnemyIntent[] = ['EVADE', 'FORTIFY'];

/**
 * Defense as a response to danger — not a default action.
 * Positive urgency → amplify Fortify/Evade; zero/negative → suppress hard.
 */
export function computeDefenseUrgency(ctx: AiScoringContext): number {
  const { enemy, player } = ctx;
  const memory = enemy.aiMemory;
  const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
  const playerHpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 1;
  const playerAp = player.actionPoints ?? 0;
  let urgency = 0;

  if (hpRatio < 0.4) urgency += 2;
  if (hpRatio < 0.25) urgency += 2;
  if (memory?.recentlyDamaged) urgency += 2;
  if (memory?.targetedLastTurn) urgency += 1;
  if (enemy.isMarkedOrExposed) urgency += 2;
  if (playerAp >= 2) urgency += 1;
  if (playerAp >= 2 && playerHpRatio > 0.55) urgency += 1;
  if (isSupportLikeRole(enemy.tacticalRole)) urgency += 1;
  if (enemy.isChargingOrPreparing) urgency += 2;
  if (ctx.isLastEnemyAlive) urgency += 2;
  if ((enemy.isEliteOrAlpha || enemy.isBoss) && memory?.recentlyDamaged) urgency += 1;

  if (hpRatio >= 0.95) urgency -= 2;
  if (!memory?.recentlyDamaged && hpRatio > 0.75) urgency -= 1;
  if (playerHpRatio < 0.35) urgency -= 2;
  if (isPressureArchetype(enemy.tacticalRole)) urgency -= 1;
  if (ctx.squadHasDefenderPosture) urgency -= 1;
  if ((ctx.combatRound ?? 1) <= 1 && !memory?.recentlyDamaged && hpRatio > 0.75) {
    urgency -= 3;
  }

  return urgency;
}

export function applyDefensiveUrgency(
  weights: WeightedIntentLike[],
  ctx: AiScoringContext,
): WeightedIntentLike[] {
  const urgency = computeDefenseUrgency(ctx);
  const memory = ctx.enemy.aiMemory;

  return weights.map((entry) => {
    if (!DEFENSIVE_INTENTS.includes(entry.intent)) return entry;

    let mult = 1;
    if (urgency <= 0) {
      mult *= 0.25;
    } else if (urgency >= 5) {
      mult *= 4;
    } else if (urgency >= 3) {
      mult *= 2.2;
    } else {
      mult *= 1 + urgency * 0.35;
    }

    if (
      (ctx.combatRound ?? 1) <= 1
      && !memory?.recentlyDamaged
      && (ctx.enemy.maxHp > 0 ? ctx.enemy.hp / ctx.enemy.maxHp : 1) > 0.75
    ) {
      mult *= 0.15;
    }

    if (entry.intent === 'FORTIFY' && (memory?.fortifyDisabledTurns ?? 0) > 0) {
      mult *= 0.05;
    }
    if (entry.intent === 'EVADE' && (memory?.evadeDisabledTurns ?? 0) > 0) {
      mult *= 0.05;
    }

    return { intent: entry.intent, weight: entry.weight * mult };
  });
}

/** Stop Fortify/Evade loops and push units that stall back into pressure. */
export function applyIntentMemory(
  weights: WeightedIntentLike[],
  ctx: AiScoringContext,
): WeightedIntentLike[] {
  const memory = ctx.enemy.aiMemory;
  if (!memory) return weights;

  return weights.map((entry) => {
    let mult = 1;
    if (memory.lastIntent === 'EVADE' && entry.intent === 'EVADE') mult *= 0.1;
    if (memory.lastIntent === 'FORTIFY' && entry.intent === 'FORTIFY') mult *= 0.1;
    if (
      memory.turnsSinceAttack >= 2
      && isAttackIntent(entry.intent)
    ) {
      mult *= 2;
    }
    if (
      memory.turnsSinceDefensive === 0
      && isDefensiveIntent(entry.intent)
      && memory.lastIntent
      && isDefensiveIntent(memory.lastIntent)
    ) {
      mult *= 0.2;
    }
    return { intent: entry.intent, weight: entry.weight * mult };
  });
}

const BRUISER_OPENERS = new Set<EnemyIntent>(['STRIKE', 'CHARGE', 'PAVEMENT_CRUSHER_CHARGE', 'DOUBLE_STRIKE']);
const ASSASSIN_OPENERS = new Set<EnemyIntent>(['STRIKE', 'HEX_MARK', 'SWARM_BITE', 'STAMINA_DRAIN_LEAP']);
const ARTILLERY_OPENERS = new Set<EnemyIntent>([
  'ARTILLERY_CHARGE',
  'LASER_SIGHT',
  'TARGET_LOCK',
  'TAR_BIND',
]);
const DISRUPTOR_OPENERS = new Set<EnemyIntent>([
  'SINKING_INTO_GRID',
  'SENSORY_JAM',
  'VEIL_STATIC',
  'JAM_AUGMENT',
  'OCCULT_TETHER',
  'STAMINA_TETHER',
  'ASHEN_ROT',
  'VEIL_BARRIER',
]);

/**
 * First-telegraph personality: teach the player what this enemy is before it turtles.
 * Only applies on early combat rounds while the unit is healthy and unpressured.
 */
export function applyArchetypeOpenerWeights(
  weights: WeightedIntentLike[],
  ctx: AiScoringContext,
): WeightedIntentLike[] {
  const round = ctx.combatRound ?? 1;
  const memory = ctx.enemy.aiMemory;
  if (round > 1) return weights;
  if (memory?.recentlyDamaged) return weights;
  const hpRatio = ctx.enemy.maxHp > 0 ? ctx.enemy.hp / ctx.enemy.maxHp : 1;
  if (hpRatio < 0.75) return weights;

  const role = ctx.enemy.tacticalRole;
  return weights.map((entry) => {
    let mult = 1;
    if (isDefensiveIntent(entry.intent)) {
      mult *= 0.2;
    }
    if (role === 'BRUISER' || role === 'PRESSURE') {
      if (BRUISER_OPENERS.has(entry.intent)) mult *= 3;
    } else if (role === 'ASSASSIN') {
      if (ASSASSIN_OPENERS.has(entry.intent)) mult *= 2.5;
      if (entry.intent === 'EVADE') mult *= 0.35;
    } else if (role === 'ARTILLERY') {
      if (ARTILLERY_OPENERS.has(entry.intent)) mult *= 3.5;
    } else if (role === 'DISRUPTOR' || role === 'SUPPORT') {
      if (DISRUPTOR_OPENERS.has(entry.intent)) mult *= 3;
      if (entry.intent === 'FIELD_REPAIR') mult *= 0.15;
    } else if (role === 'SWARM') {
      if (ASSASSIN_OPENERS.has(entry.intent) || entry.intent === 'STRIKE') mult *= 2.5;
    }
    return { intent: entry.intent, weight: entry.weight * mult };
  });
}
