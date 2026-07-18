import type { ActiveIncursionState, PlayerAccount } from '../types/game';
import type { RunResourceLedger } from '../types/runResourceLedger';
import type { ResourceQuantity } from '../types/resourceItem';
import type { CargoRunState } from '../types/cargoGrid';
import type {
  CareerEconomyTelemetry,
  EconomyRunTelemetry,
} from '../types/economyRunTelemetry';
import {
  createDefaultCareerEconomyTelemetry,
  createDefaultEconomyRunTelemetry,
} from '../types/economyRunTelemetry';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import { calculateGridOccupancy } from './cargoGridEngine';
import { ECONOMY_V1_RESOURCE_IDS } from './economyRosterV1';
import { simulateEconomyRuns, formatEconomyRunSimReport } from './economySpineSimulationEngine';

/**
 * Phase 2K — live economy event helpers + debug report.
 * Reuses run ledger for bank/extract/lost; this layer tracks the missing events.
 */

function sumQty(map: ResourceQuantity | undefined): number {
  if (!map) return 0;
  return Object.values(map).reduce((sum, n) => sum + (n ?? 0), 0);
}

export function ensureEconomyRunTelemetry(
  telemetry: EconomyRunTelemetry | undefined,
): EconomyRunTelemetry {
  return telemetry ?? createDefaultEconomyRunTelemetry();
}

export function patchEconomyRunTelemetry(
  prev: ActiveIncursionState,
  patch: Partial<EconomyRunTelemetry> | ((t: EconomyRunTelemetry) => EconomyRunTelemetry),
): ActiveIncursionState {
  const current = ensureEconomyRunTelemetry(prev.economyRunTelemetry);
  const next = typeof patch === 'function' ? patch(current) : { ...current, ...patch };
  return { ...prev, economyRunTelemetry: next };
}

export function recordEconomyGenerated(
  telemetry: EconomyRunTelemetry,
  count: number,
): EconomyRunTelemetry {
  if (count <= 0) return telemetry;
  return { ...telemetry, resourcesGenerated: telemetry.resourcesGenerated + count };
}

export function recordEconomyLeftBehind(
  telemetry: EconomyRunTelemetry,
  count: number,
): EconomyRunTelemetry {
  if (count <= 0) return telemetry;
  return { ...telemetry, resourcesLeftBehind: telemetry.resourcesLeftBehind + count };
}

export function recordEconomyCargoSwap(telemetry: EconomyRunTelemetry): EconomyRunTelemetry {
  return { ...telemetry, cargoSwaps: telemetry.cargoSwaps + 1 };
}

export function recordEconomyCargoJettison(telemetry: EconomyRunTelemetry): EconomyRunTelemetry {
  return { ...telemetry, cargoJettisons: telemetry.cargoJettisons + 1 };
}

export function sampleEconomyCargoOccupancy(
  telemetry: EconomyRunTelemetry,
  cargo: CargoRunState,
): EconomyRunTelemetry {
  const sample = calculateGridOccupancy(cargo);
  const samples = [...telemetry.cargoOccupancySamples, sample].slice(-40);
  return { ...telemetry, cargoOccupancySamples: samples };
}

export function cargoHasUnstableOrContraband(cargo: CargoRunState): boolean {
  const ids = [
    ...cargo.grid.placed.map((p) => p.itemId),
    ...cargo.containment.map((c) => c.itemId),
  ];
  return ids.some((id) => {
    const def = RESOURCE_REGISTRY[id as keyof typeof RESOURCE_REGISTRY];
    return def?.category === 'UNSTABLE' || def?.category === 'CONTRABAND';
  });
}

/** Call when unstable enters cargo — starts carry clock if needed. */
export function noteUnstableCargoPresent(
  telemetry: EconomyRunTelemetry,
  nowMs = Date.now(),
): EconomyRunTelemetry {
  if (telemetry.unstableCarryStartedAtMs != null) return telemetry;
  return { ...telemetry, unstableCarryStartedAtMs: nowMs };
}

/** Call on node advance while carrying unstable. */
export function recordEconomyNodeWithUnstable(
  telemetry: EconomyRunTelemetry,
): EconomyRunTelemetry {
  return {
    ...telemetry,
    nodesWithUnstableCargo: telemetry.nodesWithUnstableCargo + 1,
  };
}

/** Finalize unstable carry duration at extract/death. */
export function finalizeUnstableCarryDuration(
  telemetry: EconomyRunTelemetry,
  nowMs = Date.now(),
): EconomyRunTelemetry {
  if (telemetry.unstableCarryStartedAtMs == null) return telemetry;
  const delta = Math.max(0, nowMs - telemetry.unstableCarryStartedAtMs);
  return {
    ...telemetry,
    unstableCarryMs: telemetry.unstableCarryMs + delta,
    unstableCarryStartedAtMs: null,
  };
}

export function recordEconomyNewlyCraftable(
  telemetry: EconomyRunTelemetry,
  count: number,
): EconomyRunTelemetry {
  if (count <= 0) return telemetry;
  return {
    ...telemetry,
    recipesNewlyCraftable: telemetry.recipesNewlyCraftable + count,
  };
}

export function averageOccupancyPct(telemetry: EconomyRunTelemetry): number | null {
  const samples = telemetry.cargoOccupancySamples;
  if (samples.length === 0) return null;
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return Math.round(avg * 1000) / 10;
}

export function formatEconomyRunTelemetryBrief(
  telemetry: EconomyRunTelemetry,
  ledger?: RunResourceLedger,
): string {
  const collected = ledger ? sumQty(ledger.collected) : null;
  const extracted = ledger ? sumQty(ledger.extracted) : null;
  const banked = ledger ? sumQty(ledger.bankedAtSafehouse) : null;
  const lost = ledger ? sumQty(ledger.lostOnDeath) : null;
  const occ = averageOccupancyPct(telemetry);
  const carrySec = Math.round(telemetry.unstableCarryMs / 1000);
  return [
    `gen ${telemetry.resourcesGenerated}`,
    `left ${telemetry.resourcesLeftBehind}`,
    collected != null ? `pick ${collected}` : null,
    banked != null ? `bank ${banked}` : null,
    extracted != null ? `ext ${extracted}` : null,
    lost != null ? `lost ${lost}` : null,
    `swap ${telemetry.cargoSwaps}`,
    `jettison ${telemetry.cargoJettisons}`,
    occ != null ? `occ ${occ}%` : null,
    `unstableNodes ${telemetry.nodesWithUnstableCargo}`,
    `unstableCarry ${carrySec}s`,
    `newCraft ${telemetry.recipesNewlyCraftable}`,
  ].filter(Boolean).join(' // ');
}

export function applyCareerCraftSpend(
  career: CareerEconomyTelemetry | undefined,
  resourceUnits: number,
): CareerEconomyTelemetry {
  const base = career ?? createDefaultCareerEconomyTelemetry();
  if (resourceUnits <= 0) return base;
  return {
    ...base,
    resourcesCraftSpent: base.resourcesCraftSpent + resourceUnits,
    craftActions: base.craftActions + 1,
  };
}

export function applyCareerFenceSale(
  career: CareerEconomyTelemetry | undefined,
  resourceUnits: number,
  credits: number,
): CareerEconomyTelemetry {
  const base = career ?? createDefaultCareerEconomyTelemetry();
  if (resourceUnits <= 0) return base;
  return {
    ...base,
    resourcesFenced: base.resourcesFenced + resourceUnits,
    fenceActions: base.fenceActions + 1,
    fenceCreditsEarned: base.fenceCreditsEarned + credits,
  };
}

export function applyCareerContractCompleted(
  career: CareerEconomyTelemetry | undefined,
): CareerEconomyTelemetry {
  const base = career ?? createDefaultCareerEconomyTelemetry();
  return { ...base, contractsCompleted: base.contractsCompleted + 1 };
}

export function finalizeCareerEconomyFromRun(
  career: CareerEconomyTelemetry | undefined,
  run: EconomyRunTelemetry,
  ledger: RunResourceLedger,
  opts?: { contractCompleted?: boolean },
): CareerEconomyTelemetry {
  const base = career ?? createDefaultCareerEconomyTelemetry();
  return {
    ...base,
    recipesNewlyCraftable: base.recipesNewlyCraftable + run.recipesNewlyCraftable,
    contractsCompleted: base.contractsCompleted + (opts?.contractCompleted ? 1 : 0),
    runsSampled: base.runsSampled + 1,
    lastRunSummary: formatEconomyRunTelemetryBrief(run, ledger),
  };
}

export function formatEconomyLiveTelemetryReport(opts?: {
  run?: EconomyRunTelemetry | null;
  ledger?: RunResourceLedger | null;
  career?: CareerEconomyTelemetry | null;
  includeSim?: boolean;
}): string {
  const run = opts?.run ?? createDefaultEconomyRunTelemetry();
  const ledger = opts?.ledger;
  const career = opts?.career ?? createDefaultCareerEconomyTelemetry();
  const occ = averageOccupancyPct(run);

  const lines = [
    '=== ECONOMY SPINE // PHASE 2K — LIVE TELEMETRY ===',
    '',
    '-- THIS RUN --',
    `Generated (offered): ${run.resourcesGenerated}`,
    `Left behind: ${run.resourcesLeftBehind}`,
    `Picked up (ledger): ${ledger ? sumQty(ledger.collected) : '—'}`,
    `Banked: ${ledger ? sumQty(ledger.bankedAtSafehouse) : '—'}`,
    `Extracted: ${ledger ? sumQty(ledger.extracted) : '—'}`,
    `Lost on death: ${ledger ? sumQty(ledger.lostOnDeath) : '—'}`,
    `Consumed (in-run): ${ledger ? sumQty(ledger.consumed) : '—'}`,
    `Cargo swaps: ${run.cargoSwaps}`,
    `Cargo jettisons: ${run.cargoJettisons}`,
    `Avg cargo occupancy: ${occ != null ? `${occ}%` : '—'} (${run.cargoOccupancySamples.length} samples)`,
    `Nodes with unstable/contraband: ${run.nodesWithUnstableCargo}`,
    `Unstable carry duration: ${Math.round(run.unstableCarryMs / 1000)}s`,
    `Recipes newly craftable: ${run.recipesNewlyCraftable}`,
    '',
    '-- CAREER (hub) --',
    `Runs sampled: ${career.runsSampled}`,
    `Craft spend (units): ${career.resourcesCraftSpent} across ${career.craftActions} actions`,
    `Fenced (units): ${career.resourcesFenced} across ${career.fenceActions} sales (+${career.fenceCreditsEarned} CR)`,
    `Contracts completed: ${career.contractsCompleted}`,
    `Recipes newly craftable (career): ${career.recipesNewlyCraftable}`,
    career.lastRunSummary ? `Last run: ${career.lastRunSummary}` : 'Last run: —',
    '',
    '-- TUNING QUESTIONS --',
    run.nodesWithUnstableCargo > 0 || run.unstableCarryMs > 0
      ? 'Unstable cargo: players ARE carrying it.'
      : 'Unstable cargo: no carry samples this run.',
    run.resourcesLeftBehind > 0
      ? `Left-behind pressure: ${run.resourcesLeftBehind} abandoned.`
      : 'Left-behind pressure: none recorded this run.',
    career.resourcesFenced > 0
      ? 'Fence: players are selling.'
      : 'Fence: no career fence sales yet.',
    '',
  ];

  if (opts?.includeSim !== false) {
    const sim = simulateEconomyRuns({ runs: 20, breachGrade: 'II', sectorId: 'THE_NULL_ZONE' });
    lines.push('-- OFFLINE SIM PROXY (2H) --');
    lines.push(formatEconomyRunSimReport(sim));
    lines.push('');
  }

  // Coverage smoke: economy roster ids resolve
  const missing = ECONOMY_V1_RESOURCE_IDS.filter((id) => !RESOURCE_REGISTRY[id]);
  lines.push(
    missing.length === 0
      ? 'PASS — live telemetry + sim report ready for tuning.'
      : `FAIL — missing registry ids: ${missing.join(', ')}`,
  );
  lines.push('Rule: tune from live events + sims, not vibes.');

  return lines.join('\n');
}

export function formatEconomyTelemetryFromAccount(account: PlayerAccount): string {
  return formatEconomyLiveTelemetryReport({
    career: account.careerEconomyTelemetry,
    includeSim: true,
  });
}

export {
  createDefaultEconomyRunTelemetry,
  createDefaultCareerEconomyTelemetry,
};
