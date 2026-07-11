import type { CargoRunState } from '../types/cargoGrid';
import { addLootToContainment } from './cargoGridEngine';
import type { ActiveIncursionState } from '../types/game';
import type { ProceduralRunTree } from '../types/proceduralRunTree';
import type {
  AnchorNeedleMode,
  EchoTuningForkMode,
  RelaySpikeAction,
  RunItemFieldChoice,
  RunItemId,
  RunItemRuntime,
} from '../types/runItem';
import { getAvailableProceduralNodeIds } from './proceduralScannerBridge';
import { patchKeepsakeNodeModifiers } from './expeditionKeepsakeRouteEngine';
import {
  consumeRunItemFromFieldSlot,
  getRunItemInFieldSlot,
} from './runItemInventoryEngine';
import { mergeRunItemRuntime, recordRunItemTrigger } from './runItemRunState';
import { getRunItemDefinition } from './runItemRegistry';

export interface RunItemFieldChoiceCommitOutcome {
  success: boolean;
  logLines: string[];
  runtime?: RunItemRuntime;
  runItems?: ActiveIncursionState['runItems'];
  cargo?: CargoRunState;
  runCredits?: number;
  proceduralRunTree?: ProceduralRunTree;
  revealedSonarNodeIds?: readonly string[];
  resumeEngage?: boolean;
}

export function buildRelaySpikeFieldChoice(nodeId: string): RunItemFieldChoice {
  return {
    kind: 'relay_spike_action',
    nodeId,
    prompt: 'Relay spike anchored — select delayed payoff.',
    options: [
      {
        value: 'BOOST_SIGNAL',
        label: 'Boost Signal',
        detail: '+25 run credits; relay noise may corrupt a future node.',
      },
      {
        value: 'CACHE_ROUTE',
        label: 'Cache Route',
        detail: '+1 bonus stable resource roll on next harvest.',
      },
      {
        value: 'EMERGENCY_PING',
        label: 'Emergency Ping',
        detail: 'Reveal one unknown scanner node; adds scanner noise.',
      },
    ],
  };
}

export function buildEchoTuningForkFieldChoice(nodeId: string): RunItemFieldChoice {
  return {
    kind: 'echo_tuning_fork',
    nodeId,
    prompt: 'Echo node engaged — tune frequency before breach.',
    options: [
      {
        value: 'SOOTHE',
        label: 'Soothe',
        detail: 'Reduce echo hostility; modest reward.',
      },
      {
        value: 'LISTEN',
        label: 'Listen',
        detail: 'Balanced echo read; +15 run credits on resolve.',
      },
      {
        value: 'PROVOKE',
        label: 'Provoke',
        detail: '+30 run credits; adds route risk on resolve.',
      },
    ],
  };
}

export function buildAnchorNeedleFieldChoice(nodeId: string): RunItemFieldChoice {
  return {
    kind: 'anchor_needle',
    nodeId,
    prompt: 'Anchor signal engaged — select needle mode.',
    options: [
      {
        value: 'PIN',
        label: 'Pin',
        detail: 'Stabilize anchor thread; standard operation progress.',
      },
      {
        value: 'PIERCE',
        label: 'Pierce',
        detail: '+2 operation progress on anchor clear.',
      },
      {
        value: 'EXTRACT',
        label: 'Extract',
        detail: '+1 ley-slag salvage; no bonus operation progress.',
      },
    ],
  };
}

function pickRelayNoiseNode(
  tree: ProceduralRunTree,
  excludeNodeId: string,
): string | null {
  const candidates = getAvailableProceduralNodeIds({
    proceduralRunTree: tree,
  } as ActiveIncursionState).filter((id) => {
    const node = tree.nodes[id];
    return id !== excludeNodeId && node?.type !== 'GATEKEEPER';
  });
  return candidates[0] ?? null;
}

function commitRelaySpikeAction(
  inc: ActiveIncursionState,
  action: RelaySpikeAction,
  nodeId: string,
): RunItemFieldChoiceCommitOutcome {
  const relay = inc.itemRuntime.pendingRelayModifier;
  if (!relay || relay.plantedNodeId !== nodeId) {
    return { success: false, logLines: ['[REJECTED] >> No relay spike pending for this node.'] };
  }

  let runtime = mergeRunItemRuntime(inc.itemRuntime, {
    pendingRelayModifier: {
      plantedNodeId: nodeId,
      relayAction: action,
    },
  });
  const logLines: string[] = [];
  let runCredits = 0;
  let tree = inc.proceduralRunTree ?? undefined;
  let revealedSonarNodeIds = inc.revealedSonarNodeIds;

  switch (action) {
    case 'BOOST_SIGNAL':
      runCredits = 25;
      runtime = patchStats(runtime, { creditsSavedByItems: runtime.stats.creditsSavedByItems });
      logLines.push('>> RELAY SPIKE // BOOST SIGNAL — +25 run credits routed.');
      if (tree) {
        const riskNode = pickRelayNoiseNode(tree, nodeId);
        if (riskNode) {
          tree = patchKeepsakeNodeModifiers(tree, riskNode, { highRisk: true });
          runtime = patchStats(runtime, { riskAddedByItems: runtime.stats.riskAddedByItems + 1 });
          logLines.push('>> RELAY NOISE — future node flagged HIGH RISK.');
        }
      }
      break;
    case 'CACHE_ROUTE':
      runtime = mergeRunItemRuntime(runtime, {
        pendingEffects: [
          ...runtime.pendingEffects,
          { kind: 'relay_cache_route', expiresAt: 'next_harvest', payload: { bonusRolls: 1 } },
        ],
      });
      logLines.push('>> RELAY SPIKE // CACHE ROUTE — bonus harvest roll cached.');
      break;
    case 'EMERGENCY_PING':
      if (tree) {
        const candidates = getAvailableProceduralNodeIds({
          proceduralRunTree: tree,
          revealedSonarNodeIds,
        } as ActiveIncursionState).filter((id) => !revealedSonarNodeIds.includes(id));
        const revealId = candidates[0];
        if (revealId) {
          revealedSonarNodeIds = [...revealedSonarNodeIds, revealId];
          const noise = runtime.scannerNoise + 1;
          runtime = mergeRunItemRuntime(runtime, {
            scannerNoise: noise,
            stats: {
              ...runtime.stats,
              scannerRevealsByItems: runtime.stats.scannerRevealsByItems + 1,
            },
          });
          logLines.push('>> RELAY SPIKE // EMERGENCY PING — scanner vector illuminated.');
        } else {
          logLines.push('>> RELAY SPIKE // EMERGENCY PING — no hidden vectors remain.');
        }
      }
      break;
    default:
      return { success: false, logLines: ['[REJECTED] >> Unknown relay action.'] };
  }

  runtime = mergeRunItemRuntime(runtime, { pendingRelayModifier: null });
  runtime = recordRunItemTrigger(runtime, getRunItemDefinition('relay-spike').triggerText);

  return {
    success: true,
    logLines,
    runtime,
    runCredits,
    proceduralRunTree: tree,
    revealedSonarNodeIds,
  };
}

function consumeFieldTool(
  slots: ActiveIncursionState['runItems'],
  itemId: RunItemId,
  runtime: RunItemRuntime,
): { slots: ActiveIncursionState['runItems']; runtime: RunItemRuntime } | null {
  if (getRunItemInFieldSlot(slots, itemId) == null) return null;
  const nextSlots = consumeRunItemFromFieldSlot(slots, itemId);
  if (!nextSlots) return null;
  const def = getRunItemDefinition(itemId);
  return {
    slots: nextSlots,
    runtime: recordRunItemTrigger(runtime, def.triggerText),
  };
}

function commitEchoTuningFork(
  inc: ActiveIncursionState,
  mode: EchoTuningForkMode,
): RunItemFieldChoiceCommitOutcome {
  const consumed = consumeFieldTool(inc.runItems, 'echo-tuning-fork', inc.itemRuntime);
  if (!consumed) {
    return { success: false, logLines: ['[REJECTED] >> No Echo Tuning Fork in Field Tool slots.'] };
  }
  const runtime = mergeRunItemRuntime(consumed.runtime, {
    echoTuningMode: mode,
    pendingFieldChoice: null,
  });
  return {
    success: true,
    logLines: [`>> ECHO TUNING FORK // ${mode} frequency locked.`],
    runtime,
    runItems: consumed.slots,
    resumeEngage: true,
  };
}

function commitAnchorNeedle(
  inc: ActiveIncursionState,
  mode: AnchorNeedleMode,
): RunItemFieldChoiceCommitOutcome {
  const consumed = consumeFieldTool(inc.runItems, 'anchor-needle', inc.itemRuntime);
  if (!consumed) {
    return { success: false, logLines: ['[REJECTED] >> No Anchor Needle in Field Tool slots.'] };
  }
  const runtime = mergeRunItemRuntime(consumed.runtime, {
    anchorNeedleMode: mode,
    pendingFieldChoice: null,
  });
  return {
    success: true,
    logLines: [`>> ANCHOR NEEDLE // ${mode} mode selected.`],
    runtime,
    runItems: consumed.slots,
    resumeEngage: true,
  };
}

function patchStats(
  runtime: RunItemRuntime,
  patch: Partial<RunItemRuntime['stats']>,
): RunItemRuntime {
  return mergeRunItemRuntime(runtime, {
    stats: { ...runtime.stats, ...patch },
  });
}

export function commitRunItemFieldChoice(
  inc: ActiveIncursionState,
  selectedValue: string,
): RunItemFieldChoiceCommitOutcome {
  const choice = inc.itemRuntime.pendingFieldChoice;
  if (!choice) {
    return { success: false, logLines: ['[REJECTED] >> No field-tool choice pending.'] };
  }

  switch (choice.kind) {
    case 'relay_spike_action':
      return commitRelaySpikeAction(
        inc,
        selectedValue as RelaySpikeAction,
        choice.nodeId ?? '',
      );
    case 'echo_tuning_fork':
      return commitEchoTuningFork(inc, selectedValue as EchoTuningForkMode);
    case 'anchor_needle':
      return commitAnchorNeedle(inc, selectedValue as AnchorNeedleMode);
    default:
      return { success: false, logLines: ['[REJECTED] >> Unknown field-tool choice.'] };
  }
}

/** Open relay payoff choice when a planted node is cleared. */
export function tryOpenRelaySpikePayoffChoice(
  runtime: RunItemRuntime,
  clearedNodeId: string,
): RunItemRuntime | null {
  const relay = runtime.pendingRelayModifier;
  if (!relay || relay.plantedNodeId !== clearedNodeId || relay.relayAction != null) {
    return null;
  }
  if (runtime.pendingFieldChoice != null) return null;
  return mergeRunItemRuntime(runtime, {
    pendingFieldChoice: buildRelaySpikeFieldChoice(clearedNodeId),
  });
}

export interface RunItemFieldPayoff {
  runtime: RunItemRuntime;
  cargo?: CargoRunState;
  runCreditsDelta?: number;
  operationProgressDelta?: number;
  logLines: string[];
}

/** Apply echo tuning fork payoff after echo node resolves. */
export function applyRunItemEchoTuningPayoff(runtime: RunItemRuntime): RunItemFieldPayoff {
  const mode = runtime.echoTuningMode;
  if (!mode) return { runtime, logLines: [] };

  let nextRuntime = mergeRunItemRuntime(runtime, { echoTuningMode: null });
  const logLines: string[] = [];
  let runCreditsDelta = 0;

  if (mode === 'LISTEN') {
    runCreditsDelta = 15;
    logLines.push('>> ECHO TUNING FORK // LISTEN — +15 run credits.');
  } else if (mode === 'PROVOKE') {
    runCreditsDelta = 30;
    nextRuntime = mergeRunItemRuntime(nextRuntime, { deadDropRiskPending: true });
    logLines.push('>> ECHO TUNING FORK // PROVOKE — +30 run credits; route volatility increased.');
  } else {
    logLines.push('>> ECHO TUNING FORK // SOOTHE — echo hostility dampened.');
  }

  return { runtime: nextRuntime, runCreditsDelta, logLines };
}

/** Apply anchor needle payoff after anchor signal clears. */
export function applyRunItemAnchorNeedlePayoff(
  runtime: RunItemRuntime,
  cargo: CargoRunState,
  stagedIds: string[],
): RunItemFieldPayoff {
  const mode = runtime.anchorNeedleMode;
  if (!mode) return { runtime, logLines: [] };

  let nextRuntime = mergeRunItemRuntime(runtime, { anchorNeedleMode: null });
  const logLines: string[] = [];
  let operationProgressDelta = 0;
  let nextCargo = cargo;

  if (mode === 'PIERCE') {
    operationProgressDelta = 2;
    logLines.push('>> ANCHOR NEEDLE // PIERCE — +2 operation progress.');
  } else if (mode === 'EXTRACT') {
    nextCargo = addLootToContainment(nextCargo, 'ley-slag', 1, stagedIds);
    logLines.push('>> ANCHOR NEEDLE // EXTRACT — ley-slag salvage routed to containment.');
  } else {
    logLines.push('>> ANCHOR NEEDLE // PIN — anchor thread stabilized.');
  }

  return {
    runtime: nextRuntime,
    cargo: nextCargo,
    operationProgressDelta,
    logLines,
  };
}
