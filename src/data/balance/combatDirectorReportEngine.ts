/**
 * Combat Refactor Phase 5 — Combat Director + pressure + feedback reports.
 */

import type { BalanceCombatEncounterSample, BalanceRunStats } from './balanceRunStats';
import { COMBAT_PACING_TARGETS } from './balanceTargets';
import { COMBAT_DIRECTOR_BALANCE } from './combatDirectorBalanceConfig';
import type { CombatJuiceTelemetry } from '../combatJuiceFeedbackEngine';

export function formatCombatDirectorReport(stats: BalanceRunStats): string {
  const samples = stats.combats.filter((s) => s.director);
  const lines = [
    '══════════════════════════════════════',
    'COMBAT DIRECTOR REPORT',
    '══════════════════════════════════════',
    `Directed samples: ${samples.length} / ${stats.combats.length}`,
  ];
  if (samples.length === 0) {
    lines.push('', 'No director metadata yet — engage combat after Phase 5 prep wiring.');
    return lines.join('\n');
  }

  let adjustments = 0;
  let warnings = 0;
  let errors = 0;
  const byLabel: Record<string, number> = {};
  for (const s of samples) {
    const d = s.director!;
    adjustments += d.adjustmentsApplied;
    byLabel[d.pressureLabel] = (byLabel[d.pressureLabel] ?? 0) + 1;
    if (d.severity === 'WARNING') warnings += 1;
    if (d.severity === 'ERROR') errors += 1;
  }
  lines.push(
    `Adjustments applied (sum): ${adjustments}`,
    `Severities: WARNING ${warnings} / ERROR ${errors}`,
    `Pressure labels: ${Object.entries(byLabel).map(([k, v]) => `${k}=${v}`).join(' ')}`,
  );
  const last = samples[samples.length - 1]!.director!;
  lines.push('', 'Last directed encounter:', `  ${last.debugSummary.split('\n').join('\n  ')}`);
  return lines.join('\n');
}

export function formatEncounterPressureReport(stats: BalanceRunStats): string {
  const samples = stats.combats.filter((s) => s.director);
  const lines = [
    '══════════════════════════════════════',
    'ENCOUNTER PRESSURE REPORT',
    '══════════════════════════════════════',
  ];
  if (samples.length === 0) {
    lines.push('No pressure samples.');
    return lines.join('\n');
  }

  const totals = samples.map((s) => s.director!.pressureTotal);
  const avg = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
  const overCap = samples.filter((s) => {
    const depth = (s.depth ?? 1) as 1 | 2 | 3;
    const cap = depth === 1
      ? COMBAT_DIRECTOR_BALANCE.depth1LateMaxPressure
      : depth === 2
        ? COMBAT_DIRECTOR_BALANCE.depth2NormalMaxPressure
        : COMBAT_DIRECTOR_BALANCE.depth3NormalMaxPressure;
    return s.director!.pressureTotal > cap;
  }).length;

  const rewardMismatch = samples.filter((s) => {
    const d = s.director!;
    return (d.pressureLabel === 'HIGH' || d.pressureLabel === 'CRITICAL')
      && d.rewardMultiplier <= 1;
  }).length;

  lines.push(
    `n=${samples.length} avg pressure=${avg}`,
    `Over depth soft-cap: ${overCap}`,
    `Reward/risk mismatches (high pressure, ×1 reward): ${rewardMismatch}`,
  );

  const earlyCrit = samples.filter(
    (s) => (s.depth ?? 1) === 1 && s.director!.pressureLabel === 'CRITICAL',
  ).length;
  lines.push(`Early/Depth1 CRITICAL count: ${earlyCrit}`);

  // Pacing vs targets
  const d1 = samples.filter((s) => s.depth === 1 && s.kind === 'STANDARD' && s.victory);
  if (d1.length) {
    const avgTurns = d1.reduce((a, s) => a + s.playerTurns, 0) / d1.length;
    const [minT, maxT] = COMBAT_PACING_TARGETS.normal[1];
    lines.push(
      `D1 normal avg turns ${avgTurns.toFixed(1)} (target ${minT}–${maxT})`,
    );
  }

  return lines.join('\n');
}

export function formatCombatFeedbackReport(
  stats: BalanceRunStats,
): string {
  const samples = stats.combats.filter((s) => s.juice);
  const lines = [
    '══════════════════════════════════════',
    'COMBAT FEEDBACK REPORT',
    '══════════════════════════════════════',
    `Samples with juice telemetry: ${samples.length}`,
  ];
  if (samples.length === 0) {
    lines.push('No juice events recorded yet.');
    return lines.join('\n');
  }

  const merged: CombatJuiceTelemetry = {
    eventsByType: {},
    highIntensityCount: 0,
    totalHitStopMs: 0,
    screenShakeCount: 0,
  };
  for (const s of samples) {
    const j = s.juice!;
    merged.highIntensityCount += j.highIntensityCount;
    merged.totalHitStopMs += j.totalHitStopMs;
    merged.screenShakeCount += j.screenShakeCount;
    for (const [k, v] of Object.entries(j.eventsByType)) {
      merged.eventsByType[k as keyof typeof merged.eventsByType] =
        (merged.eventsByType[k as keyof typeof merged.eventsByType] ?? 0) + (v ?? 0);
    }
  }

  const top = Object.entries(merged.eventsByType)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 12)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  lines.push(
    `High/Critical intensity events: ${merged.highIntensityCount}`,
    `Total hit-stop ms: ${merged.totalHitStopMs}`,
    `Screen-shake events: ${merged.screenShakeCount}`,
    '',
    'By type:',
    top || '  —',
  );

  const spamWarn = samples.filter((s) => (s.juice?.highIntensityCount ?? 0) > 12);
  if (spamWarn.length) {
    lines.push('', `WARNING: ${spamWarn.length} fight(s) with >12 high-intensity juice events`);
  }

  return lines.join('\n');
}

export function summarizeDirectorSample(
  sample: BalanceCombatEncounterSample,
): string {
  if (!sample.director) return 'no director meta';
  const d = sample.director;
  return `${d.pressureLabel} ${d.pressureTotal} ×${d.rewardMultiplier} adj=${d.adjustmentsApplied}`;
}
