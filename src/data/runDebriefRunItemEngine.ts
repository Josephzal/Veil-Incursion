import type {
  RunItemDebriefSummary,
  RunItemId,
  RunItemRuntime,
  RunItemRuntimeStats,
  RunItemsSlotState,
} from '../types/runItem';
import { getRunItemDefinition } from './runItemRegistry';
import { buildRunItemRiskLines } from './runItemRunUiEngine';

function listSlottedRunItemIds(slots: RunItemsSlotState | null | undefined): RunItemId[] {
  if (!slots) return [];
  return [...slots.combatSlots, ...slots.fieldSlots].filter(Boolean) as RunItemId[];
}

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

function buildRunItemLoadoutLines(slots: RunItemsSlotState | null | undefined): string[] {
  const slotted = listSlottedRunItemIds(slots);
  if (slotted.length === 0) return [];
  return slotted.map((itemId) => getRunItemDefinition(itemId).name);
}

export function buildRunItemDebriefSummary(
  runtime: RunItemRuntime | null | undefined,
  slots: RunItemsSlotState | null | undefined,
  broughtAtStart?: RunItemsSlotState | null,
): RunItemDebriefSummary | null {
  const slotted = listSlottedRunItemIds(slots);
  const brought = listSlottedRunItemIds(broughtAtStart);
  const triggered = (runtime?.stats.triggerCount ?? 0) > 0;
  if (slotted.length === 0 && brought.length === 0 && !triggered) return null;

  const combatSlotted = (slots?.combatSlots.filter(Boolean) ?? []) as RunItemId[];
  const fieldSlotted = (slots?.fieldSlots.filter(Boolean) ?? []) as RunItemId[];
  const combatBrought = (broughtAtStart?.combatSlots.filter(Boolean) ?? []) as RunItemId[];
  const fieldBrought = (broughtAtStart?.fieldSlots.filter(Boolean) ?? []) as RunItemId[];
  const statLines = runtime ? buildRunItemStatLines(runtime.stats) : [];
  const riskLines = runtime ? buildRunItemRiskLines(runtime) : [];
  const loadoutLines = buildRunItemLoadoutLines(slots);
  if (loadoutLines.length > 0 && statLines.length === 0) {
    statLines.unshift(`Items remaining: ${loadoutLines.join(', ')}`);
  }

  return {
    itemsSlotted: slotted,
    itemsBrought: brought,
    combatSlotted,
    fieldSlotted,
    combatBrought,
    fieldBrought,
    triggered,
    triggerCount: runtime?.stats.triggerCount ?? 0,
    messages: [...(runtime?.messages ?? [])],
    riskLines,
    statLines,
    note: triggered ? null : 'Run items were not used.',
  };
}

export function formatRunItemDebriefPreview(
  runtime: RunItemRuntime | null | undefined,
  slots: RunItemsSlotState | null | undefined,
  broughtAtStart?: RunItemsSlotState | null,
): string {
  return simulateRunItemDebriefReport(runtime, slots, broughtAtStart);
}

/** Full debrief simulation for dev debug and mid-run inspection. */
export function simulateRunItemDebriefReport(
  runtime: RunItemRuntime | null | undefined,
  slots: RunItemsSlotState | null | undefined,
  broughtAtStart?: RunItemsSlotState | null,
): string {
  const summary = buildRunItemDebriefSummary(runtime, slots, broughtAtStart);
  if (!summary) return 'RUN ITEM DEBRIEF — none slotted or triggered.';
  const lines = [
    'RUN ITEM DEBRIEF SIMULATION',
    `combat brought: ${summary.combatBrought.map((id) => getRunItemDefinition(id).shortName).join(', ') || 'none'}`,
    `field brought: ${summary.fieldBrought.map((id) => getRunItemDefinition(id).shortName).join(', ') || 'none'}`,
    `combat remaining: ${summary.combatSlotted.map((id) => getRunItemDefinition(id).shortName).join(', ') || 'none'}`,
    `field remaining: ${summary.fieldSlotted.map((id) => getRunItemDefinition(id).shortName).join(', ') || 'none'}`,
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
