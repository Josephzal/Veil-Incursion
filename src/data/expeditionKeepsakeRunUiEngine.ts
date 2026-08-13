import type { RequisitionRuntime as KeepsakeRuntime } from '../types/expeditionRequisition';
import type { RunStatusCategory, RunStatusEntry } from '../utils/runStatusSnapshot';
import { formatKeepsakeLogLine, getEquippedKeepsakeShortLabel } from './expeditionKeepsakeEngine';
import { EXPEDITION_REQUISITION_REGISTRY } from './expeditionRequisitionRegistry';

export interface KeepsakeLiveCounter {
  key: string;
  label: string;
  value: string;
  tone: 'neutral' | 'warning' | 'accent';
}

/** Compact HUD counters surfaced during an active Requisition run. */
export function buildKeepsakeLiveCounters(
  runtime: KeepsakeRuntime | null | undefined,
): KeepsakeLiveCounter[] {
  if (!runtime) return [];

  const counters: KeepsakeLiveCounter[] = [];
  const push = (
    key: string,
    label: string,
    value: string,
    tone: KeepsakeLiveCounter['tone'] = 'neutral',
  ) => {
    counters.push({ key, label, value, tone });
  };

  if (runtime.nullLedgerDebtCredits > 0) {
    push('debt', 'DEBT', `${runtime.nullLedgerDebtCredits} CR`, 'warning');
  }

  const combat = runtime.combatPreparation;
  if (combat?.kind === 'adrenaline_primer') {
    push('primer', 'PRIMER', `${Math.max(0, 3 - combat.consumedEncounterIds.length)} LEFT`, 'accent');
  } else if (combat?.kind === 'reinforced_trench_coat') {
    push(
      'trench-coat',
      'TRENCH-COAT',
      combat.protectionSpent
        ? 'SPENT'
        : combat.protectedEncounterId
          ? 'ACTIVE'
          : 'READY',
      combat.protectionSpent ? 'neutral' : 'accent',
    );
  } else if (combat?.kind === 'hollow_point_requisition') {
    push('hollow-point', 'HOLLOW-POINT', combat.depthOneExpired ? 'EXPIRED' : 'DEPTH 1', 'accent');
  } else if (combat?.kind === 'kinetic_battery') {
    push('battery', 'BATTERY', `${Math.max(0, 3 - combat.empoweredActionIds.length)} LEFT`, 'accent');
  } else if (combat?.kind === 'chalk_line_ward') {
    push(
      'chalk-line',
      'CHALK-LINE',
      combat.currentEncounterId
        ? combat.currentWardAvailable
          ? 'WARD READY'
          : 'WARD SPENT'
        : `${Math.max(0, 3 - combat.protectedEncounterIds.length)} LEFT`,
      'accent',
    );
  }

  return counters;
}

export function formatKeepsakeTriggerToast(
  runtime: KeepsakeRuntime,
  message: string,
): string {
  const shortName = getEquippedKeepsakeShortLabel(runtime) ?? 'REQUISITION';
  return formatKeepsakeLogLine(shortName, message);
}

/** Active run risks and escalations for debrief + debug simulate. */
export function buildKeepsakeRiskLines(runtime: KeepsakeRuntime): string[] {
  const lines: string[] = [];

  if (runtime.nullLedgerDebtCredits > 0) {
    lines.push(`Null ledger debt: ${runtime.nullLedgerDebtCredits} CR`);
  }
  if (runtime.cargoSealCracked) {
    lines.push('Cargo seal cracked — dampening lost on dirty extract');
  }
  if (runtime.smugglersHunterMarkActive) {
    lines.push('Smuggler hunter mark active — contraband heat elevated');
  }
  if (runtime.extractionTokenBurns > 0) {
    lines.push(`Extraction token burns: ${runtime.extractionTokenBurns}`);
  }
  if (runtime.flags.deadDropTraceActive) {
    lines.push('Dead-drop trace active — route hunters may converge');
  }
  if (runtime.stats.debtWarningsTriggered > 0) {
    lines.push(`Debt threshold warnings: ${runtime.stats.debtWarningsTriggered}`);
  }

  return lines;
}

/** Run status manifest entries for the equipped Expedition Requisition and live counters. */
export function buildKeepsakeRunStatusEntries(
  runtime: KeepsakeRuntime | null | undefined,
): RunStatusEntry[] {
  if (!runtime) return [];

  const def = EXPEDITION_REQUISITION_REGISTRY[runtime.requisitionId];
  const entries: RunStatusEntry[] = [{
    id: `requisition-${runtime.requisitionId}`,
    label: def.shortName,
    description: def.effectSummary,
    category: 'MACRO' satisfies RunStatusCategory,
  }];

  buildKeepsakeLiveCounters(runtime).forEach((counter) => {
    entries.push({
      id: `requisition-counter-${counter.key}`,
      label: `${counter.label} ${counter.value}`,
      description: `Expedition Requisition runtime counter — ${def.shortName}.`,
      category: counter.tone === 'warning' ? 'HAZARD' : 'MACRO',
    });
  });

  buildKeepsakeRiskLines(runtime).forEach((risk, index) => {
    entries.push({
      id: `requisition-risk-${runtime.requisitionId}-${index}`,
      label: 'Requisition Risk',
      description: risk,
      category: 'HAZARD',
    });
  });

  if (runtime.pendingChoice) {
    entries.push({
      id: 'requisition-pending-choice',
      label: 'Requisition Choice Pending',
      description: runtime.pendingChoice.prompt,
      category: 'HAZARD',
    });
  }

  return entries;
}
