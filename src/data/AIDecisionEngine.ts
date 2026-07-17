import type { DistrictId } from './districtPacing';
import { canRosterUseFortify } from './enemyPostureConfig';
import { isEvadePostureActive } from './enemyIntentUtils';
import type { EnemyClass, EnemyCombatProfile, EnemyIntent } from '../types/run';
import {
  applyArchetypeOpenerWeights,
  applyDefensiveUrgency,
  applyIntentMemory,
  type AiScoringContext,
} from './enemyAiScoring';
import {
  ensureEnemyAiMemory,
  type EnemyAiMemory,
  type EnemyAiTacticalRole,
} from './enemyAiMemory';
import { ENEMY_COMPOSITION_ROLES } from './enemyCompositionRoleCatalog';
import { ENCOUNTER_KEY_TO_ROSTER } from './enemyCombatConfig';
import type { EncounterEnemyKey } from './enemyCombatConfig';

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
  aiMemory?: EnemyAiMemory;
  tacticalRole?: EnemyAiTacticalRole;
  isMarkedOrExposed?: boolean;
  isChargingOrPreparing?: boolean;
  isEliteOrAlpha?: boolean;
  isBoss?: boolean;
}

export interface AIDecisionContext {
  enemy: EnemyAIState;
  player: PlayerAIState;
  rng?: () => number;
  /** Player turns completed this combat (1 = first player turn / spawn telegraph). */
  combatRound?: number;
  isLastEnemyAlive?: boolean;
  squadHasDefenderPosture?: boolean;
}

export interface WeightedIntent {
  intent: EnemyIntent;
  weight: number;
}

const SIPHON_INTENTS: EnemyIntent[] = ['SIPHON_ABYSSAL'];
/** Hostiles allowed to drain the operative's abyssal reserve. */
export const SIPHON_ELIGIBLE_ROSTER_IDS = new Set([
  'null-shade',
  'ash-weeper',
  'ley-siren',
  'spatial-glitch',
]);
const STAMINA_DRAIN_INTENTS: EnemyIntent[] = ['STRIP_STAMINA'];
const AGGRESSIVE_INTENTS: EnemyIntent[] = [
  'STRIKE',
  'WORLD_ENDER',
  'OVERDRIVE_DISCHARGE',
  'STRIP_STAMINA',
];
const HEAL_INTENTS: EnemyIntent[] = []; // reserved — no hostile heal intents in roster yet

const LETHAL_WEIGHT = 100;
const DEFAULT_WEIGHT = 1;

type IntentFilterRule = (pool: EnemyIntent[], ctx: AIDecisionContext) => EnemyIntent[];
type IntentWeightRule = (weights: WeightedIntent[], ctx: AIDecisionContext) => WeightedIntent[];

const ARTILLERY_ROSTER_IDS = new Set([
  'sapper',
  'coil-spike-sniper',
  'resonance-caster',
  'tar-spitter',
  'splinter',
  'spotter',
]);

const ROSTER_TO_ENCOUNTER_KEY: Partial<Record<string, EncounterEnemyKey>> = (() => {
  const map: Partial<Record<string, EncounterEnemyKey>> = {};
  for (const [key, rosterId] of Object.entries(ENCOUNTER_KEY_TO_ROSTER) as [EncounterEnemyKey, string][]) {
    map[rosterId] = key;
  }
  return map;
})();

export function resolveEnemyTacticalRole(rosterId?: string): EnemyAiTacticalRole {
  if (!rosterId) return 'UNKNOWN';
  const key = ROSTER_TO_ENCOUNTER_KEY[rosterId];
  if (!key) return 'UNKNOWN';
  return ENEMY_COMPOSITION_ROLES[key]?.primaryRole ?? 'UNKNOWN';
}

function pruneArtilleryFortify(pool: EnemyIntent[], ctx: AIDecisionContext): EnemyIntent[] {
  const rosterId = ctx.enemy.rosterId;
  if (!rosterId || !ARTILLERY_ROSTER_IDS.has(rosterId)) return pool;
  return pool.filter((intent) => intent !== 'FORTIFY');
}

function pruneBlockedRosterFortify(pool: EnemyIntent[], ctx: AIDecisionContext): EnemyIntent[] {
  if (canRosterUseFortify(ctx.enemy.rosterId)) return pool;
  return pool.filter((intent) => intent !== 'FORTIFY');
}

/** Prune zero-value actions before weighting. Add new filters here. */
export const INTENT_FILTER_RULES: IntentFilterRule[] = [
  pruneSiphonByRoster,
  pruneSiphonWhenAbyssalEmpty,
  pruneStaminaDrainWhenStaminaEmpty,
  pruneNonStackingBuffs,
  pruneArtilleryFortify,
  pruneBlockedRosterFortify,
  pruneHealAtFullHp,
];

function toScoringContext(ctx: AIDecisionContext): AiScoringContext {
  return {
    enemy: {
      hp: ctx.enemy.hp,
      maxHp: ctx.enemy.maxHp,
      aiMemory: ctx.enemy.aiMemory,
      tacticalRole: ctx.enemy.tacticalRole,
      isMarkedOrExposed: ctx.enemy.isMarkedOrExposed,
      isChargingOrPreparing: ctx.enemy.isChargingOrPreparing,
      isEliteOrAlpha: ctx.enemy.isEliteOrAlpha,
      isBoss: ctx.enemy.isBoss,
    },
    player: {
      hp: ctx.player.hp,
      maxHp: ctx.player.maxHp,
      actionPoints: ctx.player.actionPoints,
    },
    combatRound: ctx.combatRound,
    isLastEnemyAlive: ctx.isLastEnemyAlive,
    squadHasDefenderPosture: ctx.squadHasDefenderPosture,
  };
}

function wrapScoringRule(
  rule: (weights: WeightedIntent[], scoring: AiScoringContext) => WeightedIntent[],
): IntentWeightRule {
  return (weights, ctx) => rule(weights, toScoringContext(ctx));
}

/** Adjust weights for tactical priorities. Add new weight rules here. */
export const INTENT_WEIGHT_RULES: IntentWeightRule[] = [
  applyLethalityFinish,
  wrapScoringRule(applyDefensiveUrgency),
  wrapScoringRule(applyIntentMemory),
  wrapScoringRule(applyArchetypeOpenerWeights),
];

function roll(rng?: () => number): number {
  return (rng ?? Math.random)();
}

export function buildEnemyActiveBuffs(profile: EnemyCombatProfile): string[] {
  const buffs: string[] = [];
  if (isEvadePostureActive(profile)) buffs.push('Evade');
  if ((profile.fortifyTurnsRemaining ?? 0) > 0) buffs.push('Fortify');
  if ((profile.chargeTurns ?? 0) > 0 || profile.intent === 'CHARGE') buffs.push('Charging');
  return buffs;
}

function isMarkedOrExposedUnit(profile: EnemyCombatProfile): boolean {
  const tags = profile.combatTags ?? [];
  return tags.includes('EXPOSED')
    || tags.includes('VULNERABLE')
    || tags.includes('DOOMED')
    || (profile.doomedStacks ?? 0) > 0;
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
    aiMemory: ensureEnemyAiMemory(profile.aiMemory),
    tacticalRole: resolveEnemyTacticalRole(profile.rosterId),
    isMarkedOrExposed: isMarkedOrExposedUnit(profile),
    isChargingOrPreparing: Boolean(
      profile.isCharging
      || (profile.chargeTurns ?? 0) > 0
      || (profile.laserLockTurnsRemaining ?? 0) > 0
      || profile.queuedAction,
    ),
    isEliteOrAlpha: Boolean(profile.isAlpha || profile.isApex),
    isBoss: Boolean(profile.isBoss),
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
    return ['STRIKE', 'EVADE'];
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

function pruneSiphonByRoster(pool: EnemyIntent[], ctx: AIDecisionContext): EnemyIntent[] {
  const rosterId = ctx.enemy.rosterId;
  if (rosterId && SIPHON_ELIGIBLE_ROSTER_IDS.has(rosterId)) return pool;
  return pool.filter((intent) => !SIPHON_INTENTS.includes(intent));
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
