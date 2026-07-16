/**
 * Combat Refactor Phase 4 — encounter objective balance report.
 */

import type { BalanceCombatEncounterSample, BalanceRunStats } from './balanceRunStats';
import type { EncounterObjectiveTelemetry } from './encounterObjectiveTelemetryEngine';
import { formatObjectiveTelemetrySummary } from './encounterObjectiveTelemetryEngine';
import { listEncounterObjectiveTemplates } from '../encounterObjectiveCatalog';

function withObjective(
  samples: readonly BalanceCombatEncounterSample[],
): BalanceCombatEncounterSample[] {
  return samples.filter((s) => s.objective?.objectivePresented);
}

export function formatEncounterObjectiveBalanceReport(
  stats: BalanceRunStats,
): string {
  const samples = withObjective(stats.combats);
  const lines = [
    '══════════════════════════════════════',
    'ENCOUNTER OBJECTIVE BALANCE REPORT',
    '══════════════════════════════════════',
    `Combats with objective: ${samples.length} / ${stats.combats.length}`,
  ];

  if (samples.length === 0) {
    lines.push('', 'No objective samples this run.');
    lines.push('', 'Templates available:');
    for (const t of listEncounterObjectiveTemplates()) {
      lines.push(`  ${t.id} — ${t.label}${t.isSoft ? ' (soft)' : ''}`);
    }
    return lines.join('\n');
  }

  const byKind: Record<string, { n: number; wins: number; completes: number }> = {};
  for (const s of samples) {
    const kind = s.objective?.primaryKind ?? 'UNKNOWN';
    const bucket = byKind[kind] ?? { n: 0, wins: 0, completes: 0 };
    bucket.n += 1;
    if (s.victory) bucket.wins += 1;
    if (s.objective?.completed) bucket.completes += 1;
    byKind[kind] = bucket;
  }

  lines.push('', 'By primary kind:');
  for (const [kind, b] of Object.entries(byKind)) {
    lines.push(
      `  ${kind}: n=${b.n} win=${b.wins} objectiveComplete=${b.completes}`,
    );
  }

  const last = samples[samples.length - 1]?.objective;
  if (last) {
    lines.push('', 'Last sample:');
    lines.push(formatObjectiveTelemetrySummary(last));
  }

  return lines.join('\n');
}

export function summarizeObjectiveSamples(
  samples: readonly EncounterObjectiveTelemetry[],
): string {
  const presented = samples.filter((s) => s.objectivePresented);
  return `objectives presented ${presented.length}/${samples.length}; completed ${presented.filter((s) => s.completed).length}`;
}
