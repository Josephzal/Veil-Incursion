import type { DistrictId } from './districtPacing';
import type { EnemyClass, EnemyCombatProfile, EnemyIntent } from '../types/run';

/** Operative snapshot for hostile intent selection. */
export interface PlayerAIState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina?: number;
  abyssalReserve: number;
  actionPoints?: number;
  /** e.g. 'RETALIATION', 'WARD' — extend for future AI rules */
  activeBuffs?: readonly string[];
}

/** Hostile unit snapshot for intent selection. */
export interface EnemyAIState {
  hp: number;
  maxHp: number;
  baseDamage: number;
  enemyClass: EnemyClass;
  chargeTurns: number;
  /** Non-stacking posture buffs currently active on the unit. */
  activeBuffs: readonly string[];
  district: DistrictId;
  /** Intent that was just resolved this enemy phase (still on profile at roll time). */
  lastIntent?: EnemyIntent;
  rosterId?: string;
  isEnraged?: boolean;
  queuedAction?: string | null;
  isUntargetable?: boolean;
  rosterAbilityCooldown?: number;
}

export interface AIDecisionContext {
  enemy: EnemyAIState;
  player: PlayerAIState;
  rng?: () => number;
}

export interface WeightedIntent {
  intent: EnemyIntent;
  weight: number;
}

const SIPHON_INTENTS: EnemyIntent[] = ['SIPHON_ABYSSAL'];
const STAMINA_DRAIN_INTENTS: EnemyIntent[] = ['STRIP_STAMINA'];
const DEFENSIVE_INTENTS: EnemyIntent[] = ['EVADE', 'FORTIFY'];
const AGGRESSIVE_INTENTS: EnemyIntent[] = [
  'STRIKE',
  'WORLD_ENDER',
  'OVERDRIVE_DISCHARGE',
  'STRIP_STAMINA',
];
const HEAL_INTENTS: EnemyIntent[] = []; // reserved — no hostile heal intents in roster yet

const LOW_HP_THRESHOLD = 0.3;
const LETHAL_WEIGHT = 100;
const DEFAULT_WEIGHT = 1;
const DEFENSIVE_CRISIS_WEIGHT = 6;

type IntentFilterRule = (pool: EnemyIntent[], ctx: AIDecisionContext) => EnemyIntent[];
type IntentWeightRule = (weights: WeightedIntent[], ctx: AIDecisionContext) => WeightedIntent[];

/** Prune zero-value actions before weighting. Add new filters here. */
export const INTENT_FILTER_RULES: IntentFilterRule[] = [
  pruneSiphonWhenAbyssalEmpty,
  pruneStaminaDrainWhenStaminaEmpty,
  pruneNonStackingBuffs,
  pruneHealAtFullHp,
  // Example future rule: pruneMeleeWhenPlayerRetaliating,
];

/** Adjust weights for tactical priorities. Add new weight rules here. */
export const INTENT_WEIGHT_RULES: IntentWeightRule[] = [
  applyLethalityFinish,
  applySelfPreservation,
];

function roll(rng?: () => number): number {
  return (rng ?? Math.random)();
}

export function buildEnemyActiveBuffs(profile: EnemyCombatProfile): string[] {
  const buffs: string[] = [];
  if (profile.evadeActive || profile.intent === 'EVADE') buffs.push('Evade');
  if ((profile.fortifyTurnsRemaining ?? 0) > 0) buffs.push('Fortify');
  if ((profile.chargeTurns ?? 0) > 0 || profile.intent === 'CHARGE') buffs.push('Charging');
  return buffs;
}

export function enemyAIStateFromProfile(
  profile: EnemyCombatProfile,
  district: DistrictId,
): EnemyAIState {
  return {
    hp: profile.currentHp,
    maxHp: profile.maxHp,
    baseDamage: profile.baseDamage,
    enemyClass: profile.class,
    chargeTurns: profile.chargeTurns ?? 0,
    activeBuffs: buildEnemyActiveBuffs(profile),
    district,
    lastIntent: profile.intent,
    rosterId: profile.rosterId,
    isEnraged: profile.isEnraged,
    queuedAction: profile.queuedAction ?? null,
    isUntargetable: profile.isUntargetable,
    rosterAbilityCooldown: profile.rosterAbilityCooldown ?? 0,
  };
}

export function defaultPlayerAIState(overrides?: Partial<PlayerAIState>): PlayerAIState {
  return {
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    abyssalReserve: 50,
    actionPoints: 3,
    activeBuffs: [],
    ...overrides,
  };
}

/** Class + district skill pool before pruning. */
export function getBaseIntentPool(enemy: EnemyAIState): EnemyIntent[] {
  if (enemy.enemyClass === 'GREMLIN') {
    return ['STRIKE', 'STRIP_STAMINA'];
  }
  if (enemy.enemyClass === 'APPARITION') {
    return ['STRIKE', 'SIPHON_ABYSSAL', 'EVADE'];
  }
  if (enemy.enemyClass === 'ABOMINATION') {
    if (enemy.district >= 2) {
      return ['STRIKE', 'CHARGE'];
    }
    return ['STRIKE', 'FORTIFY'];
  }
  return ['STRIKE'];
}

/** Forced charge / world-ender sequence — bypasses weighted pick. */
export function resolveChargeSequenceIntent(enemy: EnemyAIState): EnemyIntent | null {
  if (enemy.enemyClass !== 'ABOMINATION' || enemy.district < 2) return null;
  if (enemy.chargeTurns >= 2) return 'WORLD_ENDER';
  if (enemy.chargeTurns > 0) return 'CHARGE';
  return null;
}

function pruneSiphonWhenAbyssalEmpty(pool: EnemyIntent[], ctx: AIDecisionContext): EnemyIntent[] {
  if (ctx.player.abyssalReserve > 0) return pool;
  return pool.filter((intent) => !SIPHON_INTENTS.includes(intent));
}

function pruneStaminaDrainWhenStaminaEmpty(pool: EnemyIntent[], ctx: AIDecisionContext): EnemyIntent[] {
  if (ctx.player.stamina > 0) return pool;
  return pool.filter((intent) => !STAMINA_DRAIN_INTENTS.includes(intent));
}

function pruneNonStackingBuffs(pool: EnemyIntent[], ctx: AIDecisionContext): EnemyIntent[] {
  const active = new Set(ctx.enemy.activeBuffs);
  return pool.filter((intent) => {
    if (intent === 'FORTIFY' && active.has('Fortify')) return false;
    if (intent === 'EVADE' && active.has('Evade')) return false;
    if (intent === 'CHARGE' && active.has('Charging')) return false;
    return true;
  });
}

function pruneHealAtFullHp(pool: EnemyIntent[], ctx: AIDecisionContext): EnemyIntent[] {
  if (ctx.enemy.hp < ctx.enemy.maxHp) return pool;
  return pool.filter((intent) => !HEAL_INTENTS.includes(intent));
}

/** Example future filter — wire into INTENT_FILTER_RULES when retaliation exists on player buffs. */
export function pruneMeleeWhenPlayerRetaliating(pool: EnemyIntent[], ctx: AIDecisionContext): EnemyIntent[] {
  if (!ctx.player.activeBuffs?.includes('RETALIATION')) return pool;
  return pool.filter((intent) => intent !== 'STRIKE' && intent !== 'WORLD_ENDER');
}

function estimateStrikeDamage(enemy: EnemyAIState, intent: EnemyIntent): number {
  if (intent === 'WORLD_ENDER') return Math.floor(enemy.baseDamage * 2.5);
  if (intent === 'OVERDRIVE_DISCHARGE') return 18;
  if (AGGRESSIVE_INTENTS.includes(intent)) return enemy.baseDamage;
  return 0;
}

function canFinishPlayer(ctx: AIDecisionContext): boolean {
  return AGGRESSIVE_INTENTS.some(
    (intent) => estimateStrikeDamage(ctx.enemy, intent) >= ctx.player.hp,
  );
}

function applyLethalityFinish(weights: WeightedIntent[], ctx: AIDecisionContext): WeightedIntent[] {
  if (!canFinishPlayer(ctx)) return weights;

  const lethalIntents = weights.filter(({ intent }) => {
    const dmg = estimateStrikeDamage(ctx.enemy, intent);
    return dmg > 0 && dmg >= ctx.player.hp;
  });
  if (lethalIntents.length === 0) return weights;

  const killPool = new Set(lethalIntents.map((entry) => entry.intent));
  return weights.map((entry) => ({
    intent: entry.intent,
    weight: killPool.has(entry.intent) ? LETHAL_WEIGHT : 0,
  }));
}

function applySelfPreservation(weights: WeightedIntent[], ctx: AIDecisionContext): WeightedIntent[] {
  const hpRatio = ctx.enemy.maxHp > 0 ? ctx.enemy.hp / ctx.enemy.maxHp : 1;
  if (hpRatio >= LOW_HP_THRESHOLD) return weights;

  return weights.map((entry) => {
    if (DEFENSIVE_INTENTS.includes(entry.intent) || HEAL_INTENTS.includes(entry.intent)) {
      return { intent: entry.intent, weight: entry.weight * DEFENSIVE_CRISIS_WEIGHT };
    }
    return entry;
  });
}

export function filterValidIntents(pool: EnemyIntent[], ctx: AIDecisionContext): EnemyIntent[] {
  return INTENT_FILTER_RULES.reduce(
    (current, rule) => rule(current, ctx),
    [...pool],
  );
}

export function weightValidIntents(valid: EnemyIntent[], ctx: AIDecisionContext): WeightedIntent[] {
  let weights: WeightedIntent[] = valid.map((intent) => ({
    intent,
    weight: DEFAULT_WEIGHT,
  }));
  for (const rule of INTENT_WEIGHT_RULES) {
    weights = rule(weights, ctx);
  }
  return weights.filter((entry) => entry.weight > 0);
}

export function selectWeightedIntent(
  weights: WeightedIntent[],
  rng?: () => number,
): EnemyIntent {
  if (weights.length === 0) return 'STRIKE';

  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return weights[0]?.intent ?? 'STRIKE';

  let cursor = roll(rng) * total;
  for (const entry of weights) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.intent;
  }
  return weights[weights.length - 1]?.intent ?? 'STRIKE';
}

/** Primary entry — conditional priority pick for the next hostile intent. */
export function decideEnemyIntent(ctx: AIDecisionContext): EnemyIntent {
  const forced = resolveChargeSequenceIntent(ctx.enemy);
  if (forced) return forced;

  const basePool = getBaseIntentPool(ctx.enemy);
  const valid = filterValidIntents(basePool, ctx);
  const pool = valid.length > 0 ? valid : ['STRIKE' as const];
  const weights = weightValidIntents(pool, ctx);
  const weightedPool = weights.length > 0
    ? weights
    : pool.map((intent) => ({ intent, weight: DEFAULT_WEIGHT }));

  return selectWeightedIntent(weightedPool, ctx.rng);
}
