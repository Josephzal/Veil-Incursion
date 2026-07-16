/**
 * Combat Refactor Phase 2 — Enemy Intent 2.0 taxonomy.
 * Layers metadata on the existing EnemyIntent string enum (does not replace it).
 */

export type EnemyIntentType =
  | 'BASIC_ATTACK'
  | 'HEAVY_ATTACK'
  | 'LOCK_ON'
  | 'CHANNEL'
  | 'GUARD'
  | 'BUFF'
  | 'DEBUFF'
  | 'SUMMON'
  | 'CONSUME'
  | 'DETONATE'
  | 'MARK'
  | 'REPOSITION'
  | 'SUPPORT_LINK'
  | 'RITUAL'
  | 'CARGO_THREAT';

export type EnemyIntentSeverity =
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'CRITICAL';

export type IntentTargetMode =
  | 'SELF'
  | 'PLAYER'
  | 'LOWEST_HP_PLAYER'
  | 'RANDOM_PLAYER'
  | 'ALLY'
  | 'ENEMY_ALLY'
  | 'BACKLINE'
  | 'FRONTLINE'
  | 'CARGO'
  | 'ALL_PLAYERS'
  | 'ALL_ENEMIES';

export type IntentCounterTag =
  | 'KILL_SOURCE'
  | 'INTERRUPT'
  | 'FRACTURE'
  | 'STAGGER'
  | 'BLIND'
  | 'PARRY'
  | 'BLOCK'
  | 'SHIELD'
  | 'DECOY'
  | 'REDIRECT'
  | 'ARMOR_BREAK'
  | 'WARD_BREAK'
  | 'DISPEL'
  | 'CLEANSE'
  | 'ROOT'
  | 'SILENCE'
  | 'BURST_DAMAGE'
  | 'GUARD_BREAK';

export type IntentCounterQuality = 'NONE' | 'PARTIAL' | 'FULL' | 'PERFECT';

export type IntentResolvesAt =
  | 'NEXT_ENEMY_TURN'
  | 'START_OF_ENEMY_TURN'
  | 'END_OF_ENEMY_TURN'
  | 'IMMEDIATE';

export interface IntentEffectPreview {
  summary: string;
  estimatedDamage?: number;
  appliesStatus?: string;
}

/** Catalog entry keyed by existing EnemyIntent string. */
export interface EnemyIntentCatalogEntry {
  type: EnemyIntentType;
  severity: EnemyIntentSeverity;
  displayName: string;
  description: string;
  targetMode: IntentTargetMode;
  /** Typical telegraph length in player turns (0 = resolves same enemy turn / immediate). */
  telegraphTurns: number;
  resolvesAt: IntentResolvesAt;
  counterTags: readonly IntentCounterTag[];
  canBeInterrupted: boolean;
  canBeFractured: boolean;
  canBeBlinded: boolean;
  canBeBlocked: boolean;
  canBeParried: boolean;
  canBeRedirected: boolean;
  canBeDispelled: boolean;
  uiPriority: number;
  /** True when this intent is a wind-up / telegraph rather than the payload. */
  isTelegraph?: boolean;
  effectPreview: IntentEffectPreview;
}

export interface IntentCounterplayResult {
  countered: boolean;
  counterQuality: IntentCounterQuality;
  matchedTags: IntentCounterTag[];
  cancelTelegraph: boolean;
  reducedDamageAmount?: number;
  appliedFracture: boolean;
  logMessages: string[];
}
