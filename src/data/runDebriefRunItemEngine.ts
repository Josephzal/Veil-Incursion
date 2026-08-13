import type {
  RunItemDebriefSummary,
  RunItemRuntime,
  RunItemRuntimeStats,
} from '../types/runItem';
import type { CargoRunState } from '../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import { isSupplyCargoItemId } from './cargoSupplyEngine';
import { buildRunItemRiskLines } from './runItemRunUiEngine';

function buildRunItemStatLines(stats: RunItemRuntimeStats): string[] {
  const lines: string[] = [];
  if (stats.hpRestoredByItems > 0) lines.push(`HP restored: ${stats.hpRestoredByItems}`);
  if (stats.damagePreventedByItems > 0) lines.push(`Damage prevented: ${stats.damagePreventedByItems}`);
  if (stats.debuffsClearedByItems > 0) lines.push(`Debuffs cleared: ${stats.debuffsClearedByItems}`);
  if (stats.armorStrippedByItems > 0) lines.push(`Kinetic armor stripped: ${stats.armorStrippedByItems}`);
  if (stats.wardsStrippedByItems > 0) lines.push(`Occult wards stripped: ${stats.wardsStrippedByItems}`);
  if (stats.staminaRestoredByItems > 0) lines.push(`Stamina restored: ${stats.staminaRestoredByItems}`);
  if (stats.apGrantedByItems > 0) lines.push(`Bonus AP granted: ${stats.apGrantedByItems}`);
  if (stats.enemyActionsInterrupted > 0) {
    lines.push(`Enemy actions interrupted: ${stats.enemyActionsInterrupted}`);
  }
  if (stats.scannerRevealsByItems > 0) lines.push(`Scanner reveals: ${stats.scannerRevealsByItems}`);
  if (stats.riskAddedByItems > 0) lines.push(`Route risk added: ${stats.riskAddedByItems}`);
  if (stats.cargoBankedByItems > 0) lines.push(`Cargo banked: ${stats.cargoBankedByItems}`);
  if (stats.cargoPreservedByItems > 0) lines.push(`Cargo preserved: ${stats.cargoPreservedByItems}`);
  if (stats.unstablePenaltiesReducedByItems > 0) {
    lines.push(`Unstable penalties reduced: ${stats.unstablePenaltiesReducedByItems}`);
  }
  if (stats.resourceBonusRollsByItems > 0) {
    lines.push(`Bonus resource rolls: ${stats.resourceBonusRollsByItems}`);
  }
  if (stats.creditsSavedByItems > 0) lines.push(`Credits saved: ${stats.creditsSavedByItems}`);
  return lines;
}

export function buildRunItemDebriefSummary(
  runtime: RunItemRuntime | null | undefined,
  cargo: CargoRunState | null | undefined,
): RunItemDebriefSummary | null {
  const carried = cargo?.grid.placed
    .filter((instance) => isSupplyCargoItemId(instance.itemId))
    .map((instance) => instance.itemId) ?? [];
  const used = runtime?.usedSupplyIds ?? [];
  const triggered = (runtime?.stats.triggerCount ?? 0) > 0;
  if (carried.length === 0 && used.length === 0 && !triggered) return null;

  const statLines = runtime ? buildRunItemStatLines(runtime.stats) : [];
  const riskLines = runtime ? buildRunItemRiskLines(runtime) : [];
  if (carried.length > 0) {
    statLines.push(
      `Unused Supplies carried: ${carried.map((id) => CARGO_ITEM_CATALOG[id].name).join(', ')}`,
    );
  }

  return {
    suppliesUsed: [...used],
    suppliesCarriedAtEnd: carried,
    triggered,
    triggerCount: runtime?.stats.triggerCount ?? 0,
    messages: [...(runtime?.messages ?? [])],
    riskLines,
    statLines,
    note: used.length > 0 ? null : 'No Supplies were used.',
  };
}

export function formatRunItemDebriefPreview(
  runtime: RunItemRuntime | null | undefined,
  cargo: CargoRunState | null | undefined,
): string {
  return simulateRunItemDebriefReport(runtime, cargo);
}

/** Full debrief simulation for dev debug and mid-run inspection. */
export function simulateRunItemDebriefReport(
  runtime: RunItemRuntime | null | undefined,
  cargo: CargoRunState | null | undefined,
): string {
  const summary = buildRunItemDebriefSummary(runtime, cargo);
  if (!summary) return 'SUPPLY DEBRIEF — none carried or used.';
  const lines = [
    'CARGO SUPPLY DEBRIEF SIMULATION',
    `used: ${summary.suppliesUsed.map((id) => CARGO_ITEM_CATALOG[id].name).join(', ') || 'none'}`,
    `carried: ${summary.suppliesCarriedAtEnd.map((id) => CARGO_ITEM_CATALOG[id].name).join(', ') || 'none'}`,
    `triggered: ${summary.triggered ? 'yes' : 'no'}`,
    `trigger count: ${summary.triggerCount}`,
  ];
  if (summary.riskLines.length > 0) {
    lines.push('risks:');
    summary.riskLines.forEach((line) => lines.push(`- ${line}`));
  }
  if (summary.statLines.length > 0) {
    lines.push('stats:');
    summary.statLines.forEach((line) => lines.push(`- ${line}`));
  }
  if (summary.messages.length > 0) {
    lines.push('trigger log:');
    summary.messages.forEach((message) => lines.push(`- ${message}`));
  }
  if (summary.note) lines.push(summary.note);
  return lines.join('\n');
}
