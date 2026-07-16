/**
 * Combat Refactor Phase 2 — intent resolution telemetry.
 */

import type { EnemyIntent } from '../../types/run';
import type { EnemyIntentSeverity, EnemyIntentType, IntentCounterQuality } from '../../types/enemyIntentMeta';
import { getIntentCatalogEntry } from '../enemyIntentCatalog';

export interface CombatIntentTelemetry {
  intentGeneratedCountByType: Partial<Record<EnemyIntentType, number>>;
  intentGeneratedCountBySeverity: Partial<Record<EnemyIntentSeverity, number>>;
  intentCounteredCountByType: Partial<Record<EnemyIntentType, number>>;
  intentResolvedCountByType: Partial<Record<EnemyIntentType, number>>;
  intentCounterQuality: Partial<Record<IntentCounterQuality, number>>;
  intentDamageDealt: number;
  intentDamagePrevented: number;
  fractureFromIntentCounterCount: number;
  deathsFromIntentCount: number;
  criticalIntentInDepth1Count: number;
  highTelegraphCount: number;
  ignoredHighIntentCount: number;
  classCounterAttempts: number;
  classCounterSuccesses: number;
}

export function createEmptyIntentTelemetry(): CombatIntentTelemetry {
  return {
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
}

function bump<T extends string>(
  map: Partial<Record<T, number>>,
  key: T,
  amount = 1,
): void {
  map[key] = (map[key] ?? 0) + amount;
}

export function recordIntentGenerated(
  telemetry: CombatIntentTelemetry,
  intent: EnemyIntent,
  opts?: { depth?: number },
): void {
  const meta = getIntentCatalogEntry(intent);
  bump(telemetry.intentGeneratedCountByType, meta.type);
  bump(telemetry.intentGeneratedCountBySeverity, meta.severity);
  if (meta.isTelegraph && (meta.severity === 'HIGH' || meta.severity === 'CRITICAL')) {
    telemetry.highTelegraphCount += 1;
  }
  if (meta.severity === 'CRITICAL' && opts?.depth === 1) {
    telemetry.criticalIntentInDepth1Count += 1;
  }
}

export function recordIntentResolved(
  telemetry: CombatIntentTelemetry,
  intent: EnemyIntent,
  opts?: { damageDealt?: number; causedDeath?: boolean; wasIgnoredHigh?: boolean },
): void {
  const meta = getIntentCatalogEntry(intent);
  bump(telemetry.intentResolvedCountByType, meta.type);
  if (opts?.damageDealt) telemetry.intentDamageDealt += opts.damageDealt;
  if (opts?.causedDeath) telemetry.deathsFromIntentCount += 1;
  if (opts?.wasIgnoredHigh) telemetry.ignoredHighIntentCount += 1;
}

export function recordIntentCountered(
  telemetry: CombatIntentTelemetry,
  intent: EnemyIntent,
  quality: IntentCounterQuality,
  opts?: { damagePrevented?: number; appliedFracture?: boolean },
): void {
  const meta = getIntentCatalogEntry(intent);
  telemetry.classCounterAttempts += 1;
  if (quality === 'NONE') return;
  telemetry.classCounterSuccesses += 1;
  bump(telemetry.intentCounteredCountByType, meta.type);
  bump(telemetry.intentCounterQuality, quality);
  if (opts?.damagePrevented) telemetry.intentDamagePrevented += opts.damagePrevented;
  if (opts?.appliedFracture) telemetry.fractureFromIntentCounterCount += 1;
}

export function formatIntentTelemetrySummary(telemetry: CombatIntentTelemetry): string {
  const topGenerated = Object.entries(telemetry.intentGeneratedCountByType)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 5)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ') || '—';
  const counterRate = telemetry.classCounterAttempts > 0
    ? Math.round((telemetry.classCounterSuccesses / telemetry.classCounterAttempts) * 100)
    : null;
  return [
    'INTENT TELEMETRY (Phase 2)',
    `  Generated (top): ${topGenerated}`,
    `  High telegraphs: ${telemetry.highTelegraphCount} // Critical@D1: ${telemetry.criticalIntentInDepth1Count}`,
    `  Countered: ${telemetry.classCounterSuccesses}/${telemetry.classCounterAttempts}${counterRate != null ? ` (${counterRate}%)` : ''}`,
    `  Dmg dealt by intents: ${telemetry.intentDamageDealt} // Prevented: ${telemetry.intentDamagePrevented}`,
    `  Fracture from counters: ${telemetry.fractureFromIntentCounterCount}`,
    `  Deaths from intents: ${telemetry.deathsFromIntentCount} // Ignored HIGH: ${telemetry.ignoredHighIntentCount}`,
  ].join('\n');
}
