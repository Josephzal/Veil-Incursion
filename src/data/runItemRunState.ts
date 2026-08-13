import type { ActiveIncursionState } from '../types/game';
import type {
  RunItemPendingEffect,
  RunItemOfferSource,
  RunItemRuntime,
} from '../types/runItem';
import {
  createDefaultRunItemRuntime,
} from '../types/runItem';

export {
  createDefaultRunItemRuntime,
  createDefaultRunItemRuntimeStats,
} from '../types/runItem';

/** Backfill supply effect state; legacy slot-shaped active runs are invalidated elsewhere. */
export function hydrateRunItemIncursionFields<
  T extends Partial<Pick<ActiveIncursionState, 'supplyRuntime'>>,
>(incursion: T): T & Pick<ActiveIncursionState, 'supplyRuntime'> {
  return {
    ...incursion,
    supplyRuntime: mergeRunItemRuntime(undefined, incursion.supplyRuntime ?? {}),
  };
}

export function mergeRunItemRuntime(
  runtime: RunItemRuntime | null | undefined,
  patch: Partial<RunItemRuntime>,
): RunItemRuntime {
  const defaults = createDefaultRunItemRuntime();
  const base = runtime
    ? {
        ...defaults,
        ...runtime,
        stats: { ...defaults.stats, ...runtime.stats },
      }
    : defaults;
  return {
    ...base,
    ...patch,
    messages: patch.messages ?? base.messages,
    usedSupplyIds: patch.usedSupplyIds ?? base.usedSupplyIds,
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

export function recordSupplyUse(
  runtime: RunItemRuntime,
  itemId: import('../types/cargoGrid').CargoItemId,
): RunItemRuntime {
  return {
    ...runtime,
    usedSupplyIds: [...runtime.usedSupplyIds, itemId],
    stats: {
      ...runtime.stats,
      suppliesUsed: runtime.stats.suppliesUsed + 1,
    },
  };
}

export function recordSupplyAcquisition(
  runtime: RunItemRuntime,
  source: RunItemOfferSource,
): RunItemRuntime {
  if (source !== 'FIND' && source !== 'BUY') return runtime;
  return {
    ...runtime,
    stats: {
      ...runtime.stats,
      suppliesFound: runtime.stats.suppliesFound + (source === 'FIND' ? 1 : 0),
      suppliesPurchased: runtime.stats.suppliesPurchased + (source === 'BUY' ? 1 : 0),
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
): string {
  const lines = ['SUPPLY RUNTIME'];
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
