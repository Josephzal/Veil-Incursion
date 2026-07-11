import type { KeepsakeRuntime } from '../types/expeditionKeepsake';
import type { RunStatusCategory, RunStatusEntry } from '../utils/runStatusSnapshot';
import { formatKeepsakeLogLine, getEquippedKeepsakeShortLabel } from './expeditionKeepsakeEngine';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';

const MATCHBOOK_MAX_MATCHES = 4;

export interface KeepsakeLiveCounter {
  key: string;
  label: string;
  value: string;
  tone: 'neutral' | 'warning' | 'accent';
}

/** Compact HUD counters surfaced during an active relic run. */
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

  const matches = runtime.counters.matches ?? 0;
  if (matches > 0 || runtime.keepsakeId === 'last_light_matchbook') {
    push('matches', 'MATCH', `${matches}/${MATCHBOOK_MAX_MATCHES}`, matches >= MATCHBOOK_MAX_MATCHES ? 'warning' : 'accent');
  }

  if (runtime.nullLedgerDebtCredits > 0) {
    push('debt', 'DEBT', `${runtime.nullLedgerDebtCredits} CR`, 'warning');
  }

  const contamination = runtime.counters.contamination ?? 0;
  if (contamination > 0) {
    push('contamination', 'CONTAM', `${contamination}`, contamination >= 3 ? 'warning' : 'neutral');
  }

  const echoThread = runtime.counters.echoThread ?? 0;
  if (echoThread > 0) {
    push('echoThread', 'THREAD', `${echoThread}`, 'accent');
  }

  const scent = runtime.counters.scent ?? 0;
  if (scent > 0) {
    push('scent', 'SCENT', `${scent}`, scent >= 3 ? 'warning' : 'neutral');
  }

  const hollowKeys = runtime.counters.hollowKeys ?? 0;
  if (hollowKeys > 0 || runtime.keepsakeId === 'hollow_keyring') {
    push('keys', 'KEYS', `${hollowKeys}`, hollowKeys <= 0 ? 'warning' : 'accent');
  }

  return counters;
}

export function formatKeepsakeTriggerToast(
  runtime: KeepsakeRuntime,
  message: string,
): string {
  const shortName = getEquippedKeepsakeShortLabel(runtime) ?? 'RELIC';
  return formatKeepsakeLogLine(shortName, message);
}

/** Active run risks and escalations for debrief + debug simulate. */
export function buildKeepsakeRiskLines(runtime: KeepsakeRuntime): string[] {
  const lines: string[] = [];

  const contamination = runtime.counters.contamination ?? 0;
  if (contamination > 0) {
    lines.push(`Contamination stack: ${contamination}`);
  }
  if (runtime.nullLedgerDebtCredits > 0) {
    lines.push(`Null ledger debt: ${runtime.nullLedgerDebtCredits} CR`);
  }
  if (runtime.leySiphonOverdrawPending) {
    lines.push('Ley overdraw pending — next harvest escalates contamination');
  }
  if (runtime.cargoSealCracked) {
    lines.push('Cargo seal cracked — dampening lost on dirty extract');
  }
  if (runtime.smugglersHunterMarkActive) {
    lines.push('Smuggler hunter mark active — contraband heat elevated');
  }
  if (runtime.overextendedActive) {
    lines.push('Overextended bonus armed — next qualifying clear pays greed reward');
  }
  if (runtime.overextendedDirtyThreatPending) {
    lines.push('Overextended dirty threat pending on next non-safe extract');
  }
  if (runtime.extractionTokenBurns > 0) {
    lines.push(`Extraction token burns: ${runtime.extractionTokenBurns}`);
  }
  const noise = runtime.counters.noise ?? 0;
  if (noise > 0) {
    lines.push(`Hollow noise stack: ${noise}`);
  }
  if (runtime.flags.deadDropTraceActive) {
    lines.push('Dead-drop trace active — route hunters may converge');
  }
  if (runtime.flags.mournersBellHostileBias) {
    lines.push('Mourner bell hostile bias — echo encounters skew violent');
  }
  if (runtime.flags.gutterLaunderActive) {
    lines.push('Gutter launder active — safehouse scent scrub in effect');
  }
  if (runtime.flags.gutterCrownResourcePending) {
    lines.push('Gutter crown resource pending at next safehouse');
  }
  if (runtime.stats.debtWarningsTriggered > 0) {
    lines.push(`Debt threshold warnings: ${runtime.stats.debtWarningsTriggered}`);
  }

  return lines;
}

/** Run status manifest entries for the equipped expedition relic and live counters. */
export function buildKeepsakeRunStatusEntries(
  runtime: KeepsakeRuntime | null | undefined,
): RunStatusEntry[] {
  if (!runtime) return [];

  const def = getKeepsakeDefinition(runtime.keepsakeId);
  const entries: RunStatusEntry[] = [{
    id: `relic-${runtime.keepsakeId}`,
    label: def.shortName,
    description: def.effectSummary,
    category: 'MACRO' satisfies RunStatusCategory,
  }];

  buildKeepsakeLiveCounters(runtime).forEach((counter) => {
    entries.push({
      id: `relic-counter-${counter.key}`,
      label: `${counter.label} ${counter.value}`,
      description: `Expedition relic runtime counter — ${def.shortName}.`,
      category: counter.tone === 'warning' ? 'HAZARD' : 'MACRO',
    });
  });

  buildKeepsakeRiskLines(runtime).forEach((risk, index) => {
    entries.push({
      id: `relic-risk-${runtime.keepsakeId}-${index}`,
      label: 'Relic Risk',
      description: risk,
      category: 'HAZARD',
    });
  });

  if (runtime.pendingChoice) {
    entries.push({
      id: 'relic-pending-choice',
      label: 'Relic Choice Pending',
      description: runtime.pendingChoice.prompt,
      category: 'HAZARD',
    });
  }

  return entries;
}
