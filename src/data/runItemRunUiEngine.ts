import type {
  RunItemId,
  RunItemRuntime,
  RunItemsSlotState,
} from '../types/runItem';
import type { RunStatusCategory, RunStatusEntry } from '../utils/runStatusSnapshot';
import { countOccupiedRunItemSlots } from './runItemRunState';
import { getRunItemDefinition } from './runItemRegistry';

export interface RunItemLiveCounter {
  key: string;
  label: string;
  value: string;
  tone: 'neutral' | 'warning' | 'accent';
}

function listSlottedRunItemIds(slots: RunItemsSlotState | null | undefined): RunItemId[] {
  if (!slots) return [];
  return [...slots.combatSlots, ...slots.fieldSlots].filter(Boolean) as RunItemId[];
}

/** Whether the RUN ITEMS chip should show even when slots are empty (live counters / pending offer). */
export function shouldShowRunItemChromeChip(
  runtime: RunItemRuntime | null | undefined,
  slots?: RunItemsSlotState | null,
): boolean {
  if (slots && countOccupiedRunItemSlots(slots) > 0) return true;
  if (!runtime) return false;
  if (runtime.pendingOffer) return true;
  return buildRunItemLiveCounters(runtime, slots).length > 0;
}

/** Compact HUD counters surfaced during an active run with run items equipped. */
export function buildRunItemLiveCounters(
  runtime: RunItemRuntime | null | undefined,
  slots?: RunItemsSlotState | null,
): RunItemLiveCounter[] {
  if (!runtime && listSlottedRunItemIds(slots).length === 0) return [];

  const counters: RunItemLiveCounter[] = [];
  const push = (
    key: string,
    label: string,
    value: string,
    tone: RunItemLiveCounter['tone'] = 'neutral',
  ) => {
    counters.push({ key, label, value, tone });
  };

  if (!runtime) return counters;

  const noise = runtime.scannerNoise;
  if (noise > 0) {
    push('noise', 'NOISE', `${noise}`, noise >= 3 ? 'warning' : noise >= 2 ? 'accent' : 'neutral');
  }

  if (runtime.deadDropRiskPending) {
    push('deadDrop', 'DEAD-DROP', 'HOT', 'warning');
  }

  if (runtime.foamedCargoInstanceId) {
    push('foam', 'FOAM', 'ARMED', 'accent');
  }

  if (runtime.ashSeal) {
    push(
      'ashSeal',
      'ASH-SEAL',
      runtime.ashSeal.cracked ? 'CRACKED' : 'ACTIVE',
      runtime.ashSeal.cracked ? 'warning' : 'accent',
    );
  }

  if (runtime.leySlagSplitterArmed) {
    push('splitter', 'SPLITTER', 'ARMED', 'accent');
  }

  if (runtime.pendingRelayModifier) {
    push('relay', 'RELAY', 'PLANTED', 'accent');
  }

  if (runtime.brokerMarkedItemId) {
    push('broker', 'BROKER', 'MARKED', 'accent');
  }

  if (runtime.echoTuningMode) {
    push('echoMode', 'ECHO', runtime.echoTuningMode, 'accent');
  }

  if (runtime.anchorNeedleMode) {
    push('anchorMode', 'ANCHOR', runtime.anchorNeedleMode, 'accent');
  }

  if (runtime.combatItemsUsedThisTurn > 0) {
    push('combatTurn', 'ITEM/TURN', 'USED', 'neutral');
  }

  if (runtime.pendingFieldChoice) {
    push('fieldChoice', 'CHOICE', 'PENDING', 'warning');
  }

  return counters;
}

export function formatRunItemLogLine(shortName: string, message: string): string {
  const trimmed = message.trim();
  if (trimmed.includes('//')) return trimmed;
  return `${shortName.toUpperCase()} // ${trimmed}`;
}

export function formatRunItemTriggerToast(
  runtime: RunItemRuntime,
  message: string,
  slots?: RunItemsSlotState | null,
): string {
  const slotted = listSlottedRunItemIds(slots);
  const shortName = slotted.length === 1
    ? getRunItemDefinition(slotted[0]).shortName
    : 'RUN ITEM';
  return formatRunItemLogLine(shortName, message);
}

/** Active run risks and escalations for debrief + debug simulate. */
export function buildRunItemRiskLines(runtime: RunItemRuntime): string[] {
  const lines: string[] = [];

  if (runtime.scannerNoise > 0) {
    lines.push(`Scanner noise stack: ${runtime.scannerNoise}`);
  }
  if (runtime.deadDropRiskPending) {
    lines.push('Dead-drop routing exposed — next combat may escalate route risk');
  }
  if (runtime.foamedCargoInstanceId) {
    lines.push('Containment foam armed — first cargo-loss event breaks foam instead');
  }
  if (runtime.ashSeal) {
    if (runtime.ashSeal.cracked) {
      lines.push('Ash-Seal cracked — unstable dampening lost');
    } else {
      lines.push(`Ash-Seal active on ${runtime.ashSeal.targetEffectId.replace(/_/g, ' ')}`);
    }
  }
  if (runtime.leySlagSplitterArmed) {
    lines.push('Ley-Slag Splitter armed — harvest bonus pending with extraction scar risk');
  }
  if (runtime.pendingRelayModifier) {
    lines.push(`Relay Spike planted on node ${runtime.pendingRelayModifier.plantedNodeId}`);
  }
  if (runtime.brokerMarkedItemId) {
    lines.push('Broker-Marked shelf item available — discount carries future route corruption');
  }
  if (runtime.echoTuningMode) {
    lines.push(`Echo Tuning Fork mode armed: ${runtime.echoTuningMode}`);
  }
  if (runtime.anchorNeedleMode) {
    lines.push(`Anchor Needle mode armed: ${runtime.anchorNeedleMode}`);
  }
  if (runtime.pendingFieldChoice) {
    lines.push(`Field choice pending: ${runtime.pendingFieldChoice.prompt}`);
  }
  if (runtime.pendingOffer) {
    lines.push(`Run item slot offer pending: ${runtime.pendingOffer.itemId}`);
  }

  return lines;
}

/** Run status manifest entries for slotted run items and live counters. */
export function buildRunItemRunStatusEntries(
  runtime: RunItemRuntime | null | undefined,
  slots?: RunItemsSlotState | null,
): RunStatusEntry[] {
  const slotted = listSlottedRunItemIds(slots);
  if (slotted.length === 0 && !runtime) return [];

  const entries: RunStatusEntry[] = slotted.map((itemId) => {
    const def = getRunItemDefinition(itemId);
    return {
      id: `run-item-${itemId}`,
      label: def.shortName,
      description: def.effectSummary,
      category: 'MACRO' satisfies RunStatusCategory,
    };
  });

  buildRunItemLiveCounters(runtime, slots).forEach((counter) => {
    entries.push({
      id: `run-item-counter-${counter.key}`,
      label: `${counter.label} ${counter.value}`,
      description: 'Run item runtime counter.',
      category: counter.tone === 'warning' ? 'HAZARD' : 'MACRO',
    });
  });

  if (runtime) {
    buildRunItemRiskLines(runtime).forEach((risk, index) => {
      entries.push({
        id: `run-item-risk-${index}`,
        label: 'Item Risk',
        description: risk,
        category: 'HAZARD',
      });
    });
  }

  return entries;
}
