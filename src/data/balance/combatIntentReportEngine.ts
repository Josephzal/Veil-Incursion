/**
 * Combat Refactor Phase 2 — Enemy Intent Balance Report.
 */

import type { BalanceCombatEncounterSample, BalanceRunStats } from './balanceRunStats';
import type { CombatIntentTelemetry } from './combatIntentTelemetryEngine';
import { formatFullIntentValidationReport } from './combatIntentValidationEngine';
import { formatCombatIntentBalanceSummary } from './combatIntentBalanceConfig';
import { ENEMY_INTENT_CATALOG } from '../enemyIntentCatalog';

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function mergeIntentTelemetry(
  samples: readonly BalanceCombatEncounterSample[],
): CombatIntentTelemetry | null {
  const withIntent = samples.filter((s) => s.intent != null);
  if (!withIntent.length) return null;
  const merged: CombatIntentTelemetry = {
    intentGeneratedCountByType: {},
    intentGeneratedCountBySeverity: {},
    intentCounteredCountByType: {},
    intentResolvedCountByType: {},
    intentCounterQuality: {},
    intentDamageDealt: 0,
    intentDamagePrevented: 0,
    fractureFromIntentCounterCount: 0,
    deathsFromIntentCount: 0,
    criticalIntentInDepth1Count: 0,
    highTelegraphCount: 0,
    ignoredHighIntentCount: 0,
    classCounterAttempts: 0,
    classCounterSuccesses: 0,
  };
  for (const s of withIntent) {
    const t = s.intent!;
    for (const [k, v] of Object.entries(t.intentGeneratedCountByType)) {
      merged.intentGeneratedCountByType[k as keyof typeof merged.intentGeneratedCountByType] =
        (merged.intentGeneratedCountByType[k as keyof typeof merged.intentGeneratedCountByType] ?? 0) + (v ?? 0);
    }
    for (const [k, v] of Object.entries(t.intentCounteredCountByType)) {
      merged.intentCounteredCountByType[k as keyof typeof merged.intentCounteredCountByType] =
        (merged.intentCounteredCountByType[k as keyof typeof merged.intentCounteredCountByType] ?? 0) + (v ?? 0);
    }
    for (const [k, v] of Object.entries(t.intentResolvedCountByType)) {
      merged.intentResolvedCountByType[k as keyof typeof merged.intentResolvedCountByType] =
        (merged.intentResolvedCountByType[k as keyof typeof merged.intentResolvedCountByType] ?? 0) + (v ?? 0);
    }
    merged.intentDamageDealt += t.intentDamageDealt;
    merged.intentDamagePrevented += t.intentDamagePrevented;
    merged.fractureFromIntentCounterCount += t.fractureFromIntentCounterCount;
    merged.deathsFromIntentCount += t.deathsFromIntentCount;
    merged.criticalIntentInDepth1Count += t.criticalIntentInDepth1Count;
    merged.highTelegraphCount += t.highTelegraphCount;
    merged.ignoredHighIntentCount += t.ignoredHighIntentCount;
    merged.classCounterAttempts += t.classCounterAttempts;
    merged.classCounterSuccesses += t.classCounterSuccesses;
  }
  return merged;
}

export function formatEnemyIntentBalanceReport(
  stats: BalanceRunStats,
): string {
  const samples = stats.combats;
  const merged = mergeIntentTelemetry(samples);
  const lines = [
    'ENEMY INTENT BALANCE REPORT (Phase 2)',
    `Samples: ${samples.length} // With intent telemetry: ${samples.filter((s) => s.intent).length}`,
    '',
    formatCombatIntentBalanceSummary(),
    '',
  ];

  if (!merged) {
    lines.push('(no intent telemetry yet — complete encounters after Phase 2 wiring)');
    lines.push('');
    lines.push(formatFullIntentValidationReport());
    lines.push('');
    lines.push(`Catalog size: ${Object.keys(ENEMY_INTENT_CATALOG).length} intents`);
    return lines.join('\n');
  }

  const dangerous = Object.entries(merged.intentResolvedCountByType)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 5)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ') || '—';
  const countered = Object.entries(merged.intentCounteredCountByType)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 5)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ') || '—';
  const rate = merged.classCounterAttempts > 0
    ? Math.round((merged.classCounterSuccesses / merged.classCounterAttempts) * 100)
    : null;

  const classRates = (['AEGIS', 'HEX_SHOT', 'ENVOY'] as const).map((id) => {
    const subset = samples.filter((s) => s.playerClassId === id && s.intent);
    const attempts = subset.reduce((n, s) => n + (s.intent?.classCounterAttempts ?? 0), 0);
    const successes = subset.reduce((n, s) => n + (s.intent?.classCounterSuccesses ?? 0), 0);
    const pct = attempts > 0 ? Math.round((successes / attempts) * 100) : null;
    return `  ${id}: ${pct != null ? `${pct}%` : '—'} (${successes}/${attempts})`;
  });

  const earlyDepth1 = samples.filter((s) => s.depth === 1).slice(0, 5);
  const earlyTelegraphs = avg(earlyDepth1.map((s) => s.intent?.highTelegraphCount ?? 0));

  lines.push(
    'MOST RESOLVED (dangerous)',
    `  ${dangerous}`,
    '',
    'MOST COUNTERED',
    `  ${countered}`,
    '',
    'DAMAGE',
    `  Intent dmg dealt: ${merged.intentDamageDealt}`,
    `  Damage prevented: ${merged.intentDamagePrevented}`,
    `  Deaths from intents: ${merged.deathsFromIntentCount}`,
    `  Fracture from counters: ${merged.fractureFromIntentCounterCount}`,
    '',
    'COUNTER RATES',
    `  Overall: ${rate != null ? `${rate}%` : '—'}`,
    ...classRates,
    '',
    'DEPTH 1 EARLY',
    `  Avg high telegraphs (first 5 D1): ${earlyTelegraphs ?? '—'}`,
    `  Critical@D1 events: ${merged.criticalIntentInDepth1Count}`,
    `  Ignored HIGH: ${merged.ignoredHighIntentCount}`,
    '',
    formatFullIntentValidationReport(),
  );

  return lines.join('\n');
}

export function formatClassIntentCounterValidationReport(): string {
  return [
    'CLASS INTENT COUNTER VALIDATION (Phase 2)',
    '  AEGIS: PARRY (Void Ward) + ARMOR_BREAK (Strike) + FRACTURE — answers HEAVY_ATTACK / LOCK_ON / GUARD',
    '  HEX_SHOT: INTERRUPT (Panopticon) + ARMOR_BREAK (Sidearm) + WARD_BREAK (Wraith Piercer) — answers LOCK_ON / CHANNEL',
    '  ENVOY: WARD_BREAK (Veil-Splinter) + BLOCK (Rift-Ward) + INTERRUPT tags — answers CHANNEL / RITUAL; defensive vs direct threats',
    '  Universal: KILL_SOURCE always available; telegraphs grant ≥1 player turn on HIGH intents',
  ].join('\n');
}
