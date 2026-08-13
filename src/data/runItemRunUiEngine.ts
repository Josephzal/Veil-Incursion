import type {
  RunItemId,
  RunItemRuntime,
} from '../types/runItem';
import type { CargoRunState } from '../types/cargoGrid';
import type { RunStatusCategory, RunStatusEntry } from '../utils/runStatusSnapshot';
import { getRunItemDefinition } from './runItemRegistry';
import { isRunItemId } from './runItemIdAliases';

export interface RunItemLiveCounter {
  key: string;
  label: string;
  value: string;
  tone: 'neutral' | 'warning' | 'accent';
}

function listCarriedSupplyIds(cargo: CargoRunState | null | undefined): RunItemId[] {
  if (!cargo) return [];
  return cargo.grid.placed.flatMap((instance) => (
    isRunItemId(instance.itemId)
      ? [instance.itemId as RunItemId]
      : []
  ));
}

/** Whether the CARGO SUPPLIES chip should show even when slots are empty (live counters / pending offer). */
export function shouldShowRunItemChromeChip(
  runtime: RunItemRuntime | null | undefined,
  cargo?: CargoRunState | null,
): boolean {
  if (listCarriedSupplyIds(cargo).length > 0) return true;
  if (!runtime) return false;
  if (runtime.pendingOffer) return true;
  return buildRunItemLiveCounters(runtime, cargo).length > 0;
}

/** Compact HUD counters surfaced during an active run with supplies equipped. */
export function buildRunItemLiveCounters(
  runtime: RunItemRuntime | null | undefined,
  cargo?: CargoRunState | null,
): RunItemLiveCounter[] {
  if (!runtime && listCarriedSupplyIds(cargo).length === 0) return [];

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
  cargo?: CargoRunState | null,
): string {
  const carried = listCarriedSupplyIds(cargo);
  const shortName = carried.length === 1
    ? getRunItemDefinition(carried[0]).shortName
    : 'SUPPLY';
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
    lines.push(`Incoming Supply pending: ${runtime.pendingOffer.itemId}`);
  }

  return lines;
}

/** Supply effect state; carried instances remain visible in the Cargo manifest. */
export function buildRunItemRunStatusEntries(
  runtime: RunItemRuntime | null | undefined,
  cargo?: CargoRunState | null,
): RunStatusEntry[] {
  if (!runtime) return [];
  const entries: RunStatusEntry[] = [];

  buildRunItemLiveCounters(runtime, cargo).forEach((counter) => {
    entries.push({
      id: `run-item-counter-${counter.key}`,
      label: `${counter.label} ${counter.value}`,
      description: 'Cargo Supply runtime counter.',
      category: counter.tone === 'warning' ? 'HAZARD' : 'MACRO',
    });
  });

  if (runtime) {
    buildRunItemRiskLines(runtime).forEach((risk, index) => {
      entries.push({
        id: `run-item-risk-${index}`,
        label: 'Supply Risk',
        description: risk,
        category: 'HAZARD',
      });
    });
  }

  return entries;
}
