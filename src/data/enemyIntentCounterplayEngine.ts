/**
 * Combat Refactor Phase 2 — intent counterplay resolution.
 * Matches player action tags to intent.counterTags and returns cancel/reduce/Fracture payoffs.
 */

import type { ClassType } from '../types/game';
import type { EnemyCombatProfile, EnemyIntent } from '../types/run';
import type {
  IntentCounterplayResult,
  IntentCounterQuality,
  IntentCounterTag,
} from '../types/enemyIntentMeta';
import {
  getIntentCatalogEntry,
  isHighOrCriticalIntent,
} from './enemyIntentCatalog';
import { resolveAbilityDefenseTags } from './combatAbilityDefenseTags';
import { applyFracturedState, isEnemyFractured } from './combatFractureEngine';

/** Ability / item tags that map onto IntentCounterTag. */
const ABILITY_TAG_TO_COUNTER: Record<string, IntentCounterTag> = {
  INTERRUPT: 'INTERRUPT',
  PARRY: 'PARRY',
  BLIND: 'BLIND',
  BLOCK: 'BLOCK',
  SHIELD: 'SHIELD',
  DECOY: 'DECOY',
  REDIRECT: 'REDIRECT',
  ARMOR_BREAK: 'ARMOR_BREAK',
  WARD_BREAK: 'WARD_BREAK',
  DISPEL: 'DISPEL',
  CLEANSE: 'CLEANSE',
  ROOT: 'ROOT',
  SILENCE: 'SILENCE',
  FRACTURE: 'FRACTURE',
  GUARD_BREAK: 'GUARD_BREAK',
  STAGGER: 'STAGGER',
  BURST_DAMAGE: 'BURST_DAMAGE',
  KILL_SOURCE: 'KILL_SOURCE',
  CONTROL: 'INTERRUPT',
  DEFENSIVE: 'BLOCK',
  TRAP: 'INTERRUPT',
};

const FULL_CANCEL_TAGS: IntentCounterTag[] = [
  'INTERRUPT',
  'BLIND',
  'KILL_SOURCE',
  'SILENCE',
  'PARRY',
  'GUARD_BREAK',
  'DISPEL',
];

const PARTIAL_TAGS: IntentCounterTag[] = [
  'BLOCK',
  'SHIELD',
  'ARMOR_BREAK',
  'WARD_BREAK',
  'DECOY',
  'FRACTURE',
  'STAGGER',
  'BURST_DAMAGE',
  'CLEANSE',
];

export interface ResolveIntentCounterplayInput {
  intent: EnemyIntent;
  playerActionTags: readonly string[];
  sourceCombatant?: EnemyCombatProfile | null;
  /** True when the player action killed the source. */
  killedSource?: boolean;
  /** True when this is a successful Void Ward parry. */
  perfectParry?: boolean;
  /** Optional estimated incoming damage for reduction logging. */
  incomingDamage?: number;
  classId?: ClassType;
  abilityId?: string;
}

export function collectPlayerCounterTags(
  playerActionTags: readonly string[],
  opts?: { classId?: ClassType; abilityId?: string; killedSource?: boolean },
): IntentCounterTag[] {
  const out = new Set<IntentCounterTag>();
  for (const raw of playerActionTags) {
    const mapped = ABILITY_TAG_TO_COUNTER[raw];
    if (mapped) out.add(mapped);
  }
  if (opts?.classId && opts.abilityId) {
    const defense = resolveAbilityDefenseTags(opts.classId, opts.abilityId);
    if (defense.armorBreak > 0) out.add('ARMOR_BREAK');
    if (defense.wardBreak > 0) out.add('WARD_BREAK');
    if (defense.appliesFracture) out.add('FRACTURE');
  }
  if (opts?.killedSource) out.add('KILL_SOURCE');
  return [...out];
}

function pickQuality(
  matched: IntentCounterTag[],
  meta: ReturnType<typeof getIntentCatalogEntry>,
  opts: { killedSource?: boolean; perfectParry?: boolean },
): IntentCounterQuality {
  if (matched.length === 0) return 'NONE';
  if (opts.perfectParry && (meta.canBeParried || matched.includes('PARRY'))) {
    return 'PERFECT';
  }
  if (opts.killedSource || matched.some((t) => FULL_CANCEL_TAGS.includes(t))) {
    return 'FULL';
  }
  if (matched.some((t) => PARTIAL_TAGS.includes(t))) {
    return 'PARTIAL';
  }
  return 'PARTIAL';
}

function shouldApplyFracture(
  quality: IntentCounterQuality,
  intent: EnemyIntent,
  matched: IntentCounterTag[],
): boolean {
  if (quality === 'NONE') return false;
  if (!isHighOrCriticalIntent(intent) && quality !== 'PERFECT' && quality !== 'FULL') {
    return false;
  }
  if (quality === 'PERFECT') return true;
  if (quality === 'FULL') {
    return matched.some((t) =>
      t === 'INTERRUPT'
      || t === 'PARRY'
      || t === 'BLIND'
      || t === 'GUARD_BREAK'
      || t === 'KILL_SOURCE'
      || t === 'SILENCE'
      || t === 'FRACTURE'
    );
  }
  return matched.includes('FRACTURE') || matched.includes('GUARD_BREAK');
}

/**
 * Resolve whether a player action counters the enemy's planned intent.
 * Pure decision helper — callers apply patches / telemetry.
 */
export function resolveIntentCounterplay(
  input: ResolveIntentCounterplayInput,
): IntentCounterplayResult {
  const meta = getIntentCatalogEntry(input.intent);
  const playerTags = collectPlayerCounterTags(input.playerActionTags, {
    classId: input.classId,
    abilityId: input.abilityId,
    killedSource: input.killedSource,
  });
  if (input.perfectParry) {
    playerTags.push('PARRY');
  }

  const matched = playerTags.filter((t) => meta.counterTags.includes(t));
  const uniqueMatched = [...new Set(matched)];
  const quality = pickQuality(uniqueMatched, meta, {
    killedSource: input.killedSource,
    perfectParry: input.perfectParry,
  });

  if (quality === 'NONE') {
    return {
      countered: false,
      counterQuality: 'NONE',
      matchedTags: [],
      cancelTelegraph: false,
      appliedFracture: false,
      logMessages: [],
    };
  }

  const cancelTelegraph = quality === 'FULL'
    || quality === 'PERFECT'
    || (quality === 'PARTIAL' && uniqueMatched.includes('INTERRUPT') && meta.canBeInterrupted);

  let reducedDamageAmount: number | undefined;
  if (quality === 'PARTIAL' && input.incomingDamage != null && input.incomingDamage > 0) {
    const factor = uniqueMatched.includes('SHIELD') || uniqueMatched.includes('BLOCK')
      ? 0.5
      : uniqueMatched.includes('ARMOR_BREAK') || uniqueMatched.includes('WARD_BREAK')
        ? 0.75
        : 0.85;
    reducedDamageAmount = Math.max(0, Math.floor(input.incomingDamage * (1 - factor)));
  }
  if ((quality === 'FULL' || quality === 'PERFECT') && input.incomingDamage != null) {
    reducedDamageAmount = input.incomingDamage;
  }

  const appliedFracture = shouldApplyFracture(quality, input.intent, uniqueMatched)
    && !(input.sourceCombatant && isEnemyFractured(input.sourceCombatant));

  const logMessages: string[] = [];
  const name = meta.displayName;
  if (quality === 'PERFECT') {
    logMessages.push(`${name} perfectly countered — intent canceled.`);
  } else if (quality === 'FULL') {
    logMessages.push(`${name} interrupted — intent canceled.`);
  } else {
    logMessages.push(`${name} partially countered.`);
  }
  if (appliedFracture) {
    logMessages.push(`${name} disrupted — enemy Fractured.`);
  }
  if (reducedDamageAmount != null && reducedDamageAmount > 0) {
    logMessages.push(`Damage prevented: ${reducedDamageAmount}.`);
  }

  return {
    countered: true,
    counterQuality: quality,
    matchedTags: uniqueMatched,
    cancelTelegraph,
    reducedDamageAmount,
    appliedFracture,
    logMessages,
  };
}

/** Clear telegraph / charge / lock fields after a successful interrupt. */
export function clearEnemyTelegraphState(
  enemy: EnemyCombatProfile,
  fallbackIntent: EnemyIntent = 'STRIKE',
): EnemyCombatProfile {
  return {
    ...enemy,
    intent: fallbackIntent,
    chargeTurns: 0,
    isCharging: false,
    queuedAction: undefined,
    spotterLockedOn: false,
    laserLockTurnsRemaining: 0,
  };
}

/** Apply Fracture + optional telegraph clear from a counterplay result. */
export function applyIntentCounterplayToEnemy(
  enemy: EnemyCombatProfile,
  result: IntentCounterplayResult,
): EnemyCombatProfile {
  let next = enemy;
  if (result.cancelTelegraph) {
    next = clearEnemyTelegraphState(next);
  }
  if (result.appliedFracture) {
    next = applyFracturedState(next, { fromDefenseBreak: true });
  }
  return next;
}

export function isIntentParryable(intent: EnemyIntent): boolean {
  return getIntentCatalogEntry(intent).canBeParried;
}

export function enemyIsTelegraphing(enemy: EnemyCombatProfile): boolean {
  const intent = enemy.intent;
  const meta = getIntentCatalogEntry(intent);
  if (meta.isTelegraph) return true;
  if (enemy.isCharging) return true;
  if (enemy.spotterLockedOn) return true;
  if ((enemy.chargeTurns ?? 0) > 0) return true;
  if ((enemy.laserLockTurnsRemaining ?? 0) > 0) return true;
  return false;
}
