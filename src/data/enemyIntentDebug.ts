/**
 * Combat Refactor Phase 2 — debug helpers for intent inspection / force.
 */

import type { EnemyCombatProfile, EnemyIntent } from '../types/run';
import {
  ENEMY_INTENT_CATALOG,
  estimateTurnsRemaining,
  formatCounterTags,
  getIntentCatalogEntry,
} from './enemyIntentCatalog';
import {
  clearEnemyTelegraphState,
  resolveIntentCounterplay,
} from './enemyIntentCounterplayEngine';
import { formatFullIntentValidationReport } from './balance/combatIntentValidationEngine';
import { formatEnemyIntentBalanceReport } from './balance/combatIntentReportEngine';
import { createDefaultBalanceRunStats } from './balance/balanceRunStats';

const FORCE_PRESETS: Record<string, EnemyIntent> = {
  LOCK_ON: 'LASER_SIGHT',
  CHANNEL: 'ARTILLERY_CHARGE',
  GUARD: 'BINDING_WARD',
  HEAVY_ATTACK: 'PAVEMENT_CRUSHER',
  DETONATE: 'PREMATURE_IGNITION',
  MARK: 'HEX_MARK',
  CHARGE: 'CHARGE',
  TARGET_LOCK: 'TARGET_LOCK',
};

export function debugForceEnemyIntent(
  enemy: EnemyCombatProfile,
  presetOrIntent: string,
): EnemyCombatProfile {
  const upper = presetOrIntent.toUpperCase();
  const intent = (FORCE_PRESETS[upper] ?? upper) as EnemyIntent;
  if (!ENEMY_INTENT_CATALOG[intent]) {
    return enemy;
  }
  const meta = getIntentCatalogEntry(intent);
  return {
    ...enemy,
    intent,
    chargeTurns: intent === 'CHARGE' ? 1 : enemy.chargeTurns,
    isCharging: meta.isTelegraph === true && (
      intent === 'PAVEMENT_CRUSHER_CHARGE'
      || intent === 'ARTILLERY_CHARGE'
      || intent === 'SINKING_INTO_GRID'
    ),
    spotterLockedOn: intent === 'TARGET_LOCK',
    laserLockTurnsRemaining: intent === 'LASER_SIGHT' ? Math.max(1, meta.telegraphTurns) : 0,
  };
}

export function debugCancelAllIntents(
  squad: readonly EnemyCombatProfile[],
): EnemyCombatProfile[] {
  return squad.map((e) => clearEnemyTelegraphState(e, 'STRIKE'));
}

export function debugPrintActiveIntents(
  squad: readonly EnemyCombatProfile[],
): string {
  const lines = ['ACTIVE ENEMY INTENTS'];
  for (const e of squad) {
    if ((e.currentHp ?? 0) <= 0) continue;
    const meta = getIntentCatalogEntry(e.intent);
    const turns = estimateTurnsRemaining(e.intent, e);
    lines.push(
      `  ${e.designation}: ${e.intent} [${meta.type}/${meta.severity}] turns=${turns} counters=[${formatCounterTags(meta.counterTags)}]`,
    );
  }
  if (lines.length === 1) lines.push('  (none)');
  return lines.join('\n');
}

export function debugSimulateCounter(
  intent: EnemyIntent,
  playerTags: readonly string[],
): string {
  const result = resolveIntentCounterplay({
    intent,
    playerActionTags: playerTags,
    incomingDamage: 20,
  });
  return [
    `SIMULATE COUNTER // ${intent}`,
    `  countered=${result.countered} quality=${result.counterQuality}`,
    `  matched=[${result.matchedTags.join(', ')}]`,
    `  cancel=${result.cancelTelegraph} fracture=${result.appliedFracture}`,
    ...result.logMessages.map((m) => `  log: ${m}`),
  ].join('\n');
}

export function debugIntentToolDump(opts?: {
  squad?: readonly EnemyCombatProfile[];
}): string {
  return [
    debugPrintActiveIntents(opts?.squad ?? []),
    '',
    formatFullIntentValidationReport(),
    '',
    formatEnemyIntentBalanceReport(createDefaultBalanceRunStats()),
    '',
    'FORCE PRESETS: ' + Object.keys(FORCE_PRESETS).join(', '),
    'SIM EXAMPLES:',
    debugSimulateCounter('LASER_SIGHT', ['INTERRUPT', 'PARRY']),
    debugSimulateCounter('ARTILLERY_CHARGE', ['WARD_BREAK', 'INTERRUPT']),
    debugSimulateCounter('BINDING_WARD', ['GUARD_BREAK', 'ARMOR_BREAK']),
  ].join('\n');
}
