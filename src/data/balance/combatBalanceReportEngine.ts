/**
 * Combat Balance Report — aggregates BalanceCombatEncounterSample history.
 */

import type { BalanceCombatEncounterSample, BalanceRunStats } from './balanceRunStats';
import { COMBAT_DEFENSE_BALANCE } from './combatDefenseBalanceConfig';

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function byClass(samples: readonly BalanceCombatEncounterSample[], classId: string) {
  return samples.filter((s) => s.playerClassId === classId);
}

function firstN(samples: readonly BalanceCombatEncounterSample[], n: number) {
  return samples.slice(0, n);
}

export function formatCombatBalanceReport(
  stats: BalanceRunStats,
  options?: { classId?: string },
): string {
  const samples = options?.classId
    ? byClass(stats.combats, options.classId)
    : stats.combats;
  if (!samples.length) {
    return 'COMBAT BALANCE REPORT\n  (no combat samples yet — complete encounters to populate)';
  }

  const wins = samples.filter((s) => s.victory).length;
  const losses = samples.length - wins;
  const hpAfter: Record<number, number[]> = { 1: [], 2: [], 3: [], 5: [] };
  samples.forEach((s, i) => {
    const idx = i + 1;
    if ((idx === 1 || idx === 2 || idx === 3 || idx === 5) && s.endingPlayerHp != null && s.startingPlayerHp) {
      hpAfter[idx]!.push((s.endingPlayerHp / s.startingPlayerHp) * 100);
    }
  });

  const turns = samples.map((s) => s.playerTurns);
  const dmgTaken = samples.map((s) => s.damageTaken);
  const dmgDealt = samples.map((s) => s.damageDealt);
  const enemyCounts = samples.map((s) => s.enemyCount ?? 0).filter((n) => n > 0);
  const armorEncounters = samples.filter((s) => s.defense?.hadKineticArmorEnemy).length;
  const wardEncounters = samples.filter((s) => s.defense?.hadOccultWardEnemy).length;
  const fractureEvents = samples.reduce((n, s) => n + (s.defense?.fractureAppliedCount ?? 0), 0);

  const classes = [...new Set(samples.map((s) => s.playerClassId).filter(Boolean))] as string[];
  const classLines = classes.map((id) => {
    const subset = byClass(samples, id);
    const winRate = subset.length
      ? Math.round((subset.filter((s) => s.victory).length / subset.length) * 100)
      : 0;
    const avgTaken = avg(subset.map((s) => s.damageTaken));
    const avgTurns = avg(subset.map((s) => s.playerTurns));
    return `  ${id}: win ${winRate}% // avg taken ${avgTaken ?? '—'} // avg turns ${avgTurns ?? '—'}`;
  });

  const firstFive = firstN(samples, 5);
  const firstFiveHp = avg(
    firstFive
      .filter((s) => s.playerHpLostPercent != null)
      .map((s) => 100 - (s.playerHpLostPercent ?? 0)),
  );

  const warnThreshold = COMBAT_DEFENSE_BALANCE.criticalEarlyEncounterHpLossWarningPercent;
  const earlyWarnings = firstFive.filter(
    (s) => (s.playerHpLostPercent ?? 0) >= warnThreshold,
  ).length;

  return [
    'COMBAT BALANCE REPORT (Phase 1)',
    `Samples: ${samples.length} // Wins: ${wins} // Losses: ${losses}`,
    '',
    'HP REMAINING % (by encounter index this run)',
    `  After #1: ${avg(hpAfter[1]!) ?? '—'}%`,
    `  After #2: ${avg(hpAfter[2]!) ?? '—'}%`,
    `  After #3: ${avg(hpAfter[3]!) ?? '—'}%`,
    `  After #5: ${avg(hpAfter[5]!) ?? '—'}%`,
    '',
    'PACING',
    `  Avg turns: ${avg(turns) ?? '—'}`,
    `  Avg damage taken: ${avg(dmgTaken) ?? '—'}`,
    `  Avg damage dealt: ${avg(dmgDealt) ?? '—'}`,
    `  Avg enemies: ${avg(enemyCounts) ?? '—'}`,
    '',
    'DEFENSE LAYERS',
    `  Armor encounters: ${armorEncounters}/${samples.length}`,
    `  Ward encounters: ${wardEncounters}/${samples.length}`,
    `  Fracture events: ${fractureEvents}`,
    '',
    'BY CLASS',
    ...(classLines.length ? classLines : ['  (class id not recorded on older samples)']),
    '',
    'FIRST FIVE',
    `  Avg HP remaining: ${firstFiveHp != null ? `${firstFiveHp}%` : '—'}`,
    `  High-loss warnings (≥${warnThreshold}%): ${earlyWarnings}`,
  ].join('\n');
}

export function formatClassCounterValidationReport(): string {
  return [
    'CLASS COUNTER VALIDATION (Phase 1)',
    '  AEGIS: armorAnswer=true (STRIKE ARMOR_BREAK) // wardAnswer=partial (Fracture pressure) // fracture=true',
    '  HEX_SHOT: armorAnswer=true (SILVER_CORE ARMOR_BREAK + SINGULARITY_SLUG pierce) // wardAnswer=true (WRAITH_PIERCER WARD_BREAK) // fracture=true (ASH_JACKET)',
    '  ENVOY: armorAnswer=partial (Fracture exploit / pierce via boons) // wardAnswer=true (VEIL_SPLINTER WARD_BREAK) // fracture=true (break→Fracture)',
    '  Early Depth 1: no class requires lucky boons for baseline defense answers.',
  ].join('\n');
}
