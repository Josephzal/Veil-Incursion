import type { ActiveIncursionState } from '../types/game';
import type {
  RunItemPendingEffect,
  RunItemRuntime,
  RunItemsSlotState,
} from '../types/runItem';
import {
  createDefaultRunItemRuntime,
  createDefaultRunItemsSlotState,
} from '../types/runItem';
import { cloneRunItemsSlots } from './runItemInventoryEngine';

export {
  createDefaultRunItemRuntime,
  createDefaultRunItemRuntimeStats,
  createDefaultRunItemsSlotState,
} from '../types/runItem';

/** Backfill run-item fields on incursions persisted before Run Items v2. */
export function hydrateRunItemIncursionFields<
  T extends Partial<Pick<ActiveIncursionState, 'runItems' | 'runItemsAtRunStart' | 'itemRuntime'>>,
>(incursion: T): T & Pick<ActiveIncursionState, 'runItems' | 'runItemsAtRunStart' | 'itemRuntime'> {
  const runItems = incursion.runItems ?? createDefaultRunItemsSlotState();
  return {
    ...incursion,
    runItems,
    runItemsAtRunStart: incursion.runItemsAtRunStart ?? cloneRunItemsSlots(runItems),
    itemRuntime: incursion.itemRuntime ?? createDefaultRunItemRuntime(),
  };
}

export function mergeRunItemRuntime(
  runtime: RunItemRuntime | null | undefined,
  patch: Partial<RunItemRuntime>,
): RunItemRuntime {
  const base = runtime ?? createDefaultRunItemRuntime();
  return {
    ...base,
    ...patch,
    messages: patch.messages ?? base.messages,
    pendingEffects: patch.pendingEffects ?? base.pendingEffects,
    stats: patch.stats ? { ...base.stats, ...patch.stats } : base.stats,
    pendingRelayModifier: patch.pendingRelayModifier !== undefined
      ? patch.pendingRelayModifier
      : base.pendingRelayModifier,
    brokerMarkedItemId: patch.brokerMarkedItemId !== undefined
      ? patch.brokerMarkedItemId
      : base.brokerMarkedItemId,
    pendingOffer: patch.pendingOffer !== undefined ? patch.pendingOffer : base.pendingOffer,
    foamedCargoInstanceId: patch.foamedCargoInstanceId !== undefined
      ? patch.foamedCargoInstanceId
      : base.foamedCargoInstanceId,
    ashSeal: patch.ashSeal !== undefined ? patch.ashSeal : base.ashSeal,
    leySlagSplitterArmed: patch.leySlagSplitterArmed !== undefined
      ? patch.leySlagSplitterArmed
      : base.leySlagSplitterArmed,
    deadDropRiskPending: patch.deadDropRiskPending !== undefined
      ? patch.deadDropRiskPending
      : base.deadDropRiskPending,
    echoTuningMode: patch.echoTuningMode !== undefined ? patch.echoTuningMode : base.echoTuningMode,
    anchorNeedleMode: patch.anchorNeedleMode !== undefined
      ? patch.anchorNeedleMode
      : base.anchorNeedleMode,
    pendingFieldChoice: patch.pendingFieldChoice !== undefined
      ? patch.pendingFieldChoice
      : base.pendingFieldChoice,
  };
}

export function recordRunItemTrigger(
  runtime: RunItemRuntime,
  message: string,
): RunItemRuntime {
  const messages = runtime.messages.includes(message)
    ? runtime.messages
    : [...runtime.messages, message];
  return {
    ...runtime,
    messages,
    stats: {
      ...runtime.stats,
      triggerCount: runtime.stats.triggerCount + 1,
    },
  };
}

export function appendRunItemPendingEffect(
  runtime: RunItemRuntime,
  effect: RunItemPendingEffect,
): RunItemRuntime {
  return {
    ...runtime,
    pendingEffects: [...runtime.pendingEffects, effect],
  };
}

export function resetRunItemTurnCounters(runtime: RunItemRuntime): RunItemRuntime {
  return {
    ...runtime,
    combatItemsUsedThisTurn: 0,
    mirrorSaltUsedThisTurn: false,
  };
}

export function resetRunItemCombatCounters(runtime: RunItemRuntime): RunItemRuntime {
  return {
    ...resetRunItemTurnCounters(runtime),
    bloodwireUsedThisCombat: false,
  };
}

export function formatRunItemRuntimeDebugSnapshot(
  runtime: RunItemRuntime | null | undefined,
  slots?: RunItemsSlotState | null,
): string {
  const lines = ['RUN ITEM RUNTIME'];
  if (slots) {
    lines.push(`combat: ${slots.combatSlots.filter(Boolean).join(', ') || '(empty)'}`);
    lines.push(`field: ${slots.fieldSlots.filter(Boolean).join(', ') || '(empty)'}`);
  }
  if (!runtime) {
    lines.push('runtime: none');
    return lines.join('\n');
  }
  lines.push(`combatItemsUsedThisTurn: ${runtime.combatItemsUsedThisTurn}`);
  lines.push(`scannerNoise: ${runtime.scannerNoise}`);
  lines.push(`triggers: ${runtime.stats.triggerCount}`);
  runtime.messages.forEach((message) => lines.push(`- ${message}`));
  return lines.join('\n');
}

export function countOccupiedRunItemSlots(slots: RunItemsSlotState): number {
  return slots.combatSlots.filter(Boolean).length + slots.fieldSlots.filter(Boolean).length;
}

export function findOpenRunItemSlotIndex(
  slots: RunItemsSlotState,
  slotType: 'COMBAT' | 'FIELD',
): number | null {
  const bucket = slotType === 'COMBAT' ? slots.combatSlots : slots.fieldSlots;
  const index = bucket.findIndex((slot) => slot === null);
  return index >= 0 ? index : null;
}

export function isRunItemSlotFull(
  slots: RunItemsSlotState,
  slotType: 'COMBAT' | 'FIELD',
): boolean {
  return findOpenRunItemSlotIndex(slots, slotType) === null;
}
