/**
 * Career ring buffer of completed-run balance summaries (last N runs).
 */

import type { RunBalanceTelemetry } from '../runIntegration/runBalanceTelemetryEngine';
import { BALANCE_TARGET_EARLY } from './balanceTargets';

export const CAREER_BALANCE_RUN_HISTORY_LIMIT = 10;

export interface CareerBalanceRunEntry {
  recordedAt: number;
  classId: string | null;
  weaponFamilyId: string | null;
  keepsakeId: string | null;
  sectorId: string | null;
  extractionType: 'EXTRACT' | 'DEATH';
  districtLayer: 1 | 2 | 3;
  nodesCleared: number;
  bossesDefeated: number;
  contractCompleted: boolean;
  cargoValueExtracted: number;
  cargoValueLost: number;
  avgCombatTurns: number | null;
  operationProgressGained: number;
}

export interface CareerBalanceHistory {
  runs: CareerBalanceRunEntry[];
}

export function createDefaultCareerBalanceHistory(): CareerBalanceHistory {
  return { runs: [] };
}

export function pushCareerBalanceRun(
  history: CareerBalanceHistory | null | undefined,
  entry: CareerBalanceRunEntry,
  limit = CAREER_BALANCE_RUN_HISTORY_LIMIT,
): CareerBalanceHistory {
  const prev = history?.runs ?? [];
  const next = [...prev, entry].slice(-limit);
  return { runs: next };
}

export function careerEntryFromTelemetry(telemetry: RunBalanceTelemetry): CareerBalanceRunEntry {
  return {
    recordedAt: Date.now(),
    classId: telemetry.classId,
    weaponFamilyId: telemetry.weaponFamilyId,
    keepsakeId: telemetry.keepsakeId,
    sectorId: telemetry.sectorId,
    extractionType: telemetry.extractionType,
    districtLayer: telemetry.districtLayer,
    nodesCleared: telemetry.nodesCleared,
    bossesDefeated: telemetry.bossesDefeated,
    contractCompleted: telemetry.contractCompleted,
    cargoValueExtracted: telemetry.cargoValueExtracted,
    cargoValueLost: telemetry.cargoValueLost,
    avgCombatTurns: telemetry.avgCombatTurns,
    operationProgressGained: telemetry.operationProgressGained,
  };
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function formatBalanceDashboard(history: CareerBalanceHistory | null | undefined): string {
  const runs = history?.runs ?? [];
  if (runs.length === 0) {
    return [
      'BALANCE DASHBOARD',
      'No recorded runs yet — complete a run to populate last-10 averages.',
      `Early targets: reach D2 ${BALANCE_TARGET_EARLY.reachDepth2.min * 100}–${BALANCE_TARGET_EARLY.reachDepth2.max * 100}% // any extract ${BALANCE_TARGET_EARLY.anyExtraction.min * 100}–${BALANCE_TARGET_EARLY.anyExtraction.max * 100}%`,
    ].join('\n');
  }

  const n = runs.length;
  const extracts = runs.filter((r) => r.extractionType === 'EXTRACT').length;
  const deaths = n - extracts;
  const reachD2 = runs.filter((r) => r.districtLayer >= 2 || r.nodesCleared >= 10).length;
  const reachD3 = runs.filter((r) => r.districtLayer >= 3).length;
  const bossClears = runs.filter((r) => r.bossesDefeated > 0).length;
  const contractsOk = runs.filter((r) => r.contractCompleted).length;

  const weaponHits = new Map<string, number>();
  const classHits = new Map<string, number>();
  const relicHits = new Map<string, number>();
  runs.forEach((r) => {
    if (r.weaponFamilyId) weaponHits.set(r.weaponFamilyId, (weaponHits.get(r.weaponFamilyId) ?? 0) + 1);
    if (r.classId) classHits.set(r.classId, (classHits.get(r.classId) ?? 0) + 1);
    if (r.keepsakeId) relicHits.set(r.keepsakeId, (relicHits.get(r.keepsakeId) ?? 0) + 1);
  });
  const top = (map: Map<string, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  const last = runs[runs.length - 1]!;

  return [
    'BALANCE DASHBOARD',
    `Sample: last ${n} run(s)`,
    '',
    'RATES',
    `  extract: ${Math.round((extracts / n) * 100)}% (${extracts}/${n}) // death: ${Math.round((deaths / n) * 100)}%`,
    `  reach D2+: ${Math.round((reachD2 / n) * 100)}% // reach D3: ${Math.round((reachD3 / n) * 100)}%`,
    `  any boss kill: ${Math.round((bossClears / n) * 100)}% // contracts completed: ${Math.round((contractsOk / n) * 100)}%`,
    '',
    'AVERAGES',
    `  nodes cleared: ${avg(runs.map((r) => r.nodesCleared)) ?? '—'}`,
    `  cargo value extracted: ${avg(runs.map((r) => r.cargoValueExtracted)) ?? '—'} CR`,
    `  cargo value lost: ${avg(runs.map((r) => r.cargoValueLost)) ?? '—'} CR`,
    `  combat turns (avg when reported): ${avg(runs.map((r) => r.avgCombatTurns).filter((v): v is number => v != null)) ?? '—'}`,
    `  op progress / run: ${avg(runs.map((r) => r.operationProgressGained)) ?? '—'}`,
    '',
    'MOST USED',
    `  class: ${top(classHits)} // weapon: ${top(weaponHits)} // relic: ${top(relicHits)}`,
    '',
    'LAST RUN',
    `  ${last.extractionType} // district ${last.districtLayer} // nodes ${last.nodesCleared} // bosses ${last.bossesDefeated}`,
    `  cargo out ${last.cargoValueExtracted} CR / lost ${last.cargoValueLost} CR`,
    '',
    `Early targets (guide): D2 ${BALANCE_TARGET_EARLY.reachDepth2.min * 100}–${BALANCE_TARGET_EARLY.reachDepth2.max * 100}% // extract ${BALANCE_TARGET_EARLY.anyExtraction.min * 100}–${BALANCE_TARGET_EARLY.anyExtraction.max * 100}%`,
  ].join('\n');
}
