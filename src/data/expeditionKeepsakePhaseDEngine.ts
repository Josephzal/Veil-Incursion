import type { ActiveRunContract } from '../types/contract';
import type { CargoRunState } from '../types/cargoGrid';
import type { ActiveIncursionState } from '../types/game';
import type {
  KeepsakeMirrorCategory,
  KeepsakeRuntime,
} from '../types/expeditionKeepsake';
import type { ProceduralRunTree } from '../types/proceduralRunTree';
import type { ResourceItemId } from '../types/resourceItem';
import { createEchoOverlay } from './echoEncounterEngine';
import {
  formatKeepsakeLogLine,
  tryKeepsakeTrigger,
} from './expeditionKeepsakeEngine';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';
import {
  buildFalseEvacBeaconChoice,
  buildGutterServiceChoice,
  buildHollowKeyUnlockChoice,
  buildMournersBellChoice,
  queueKeepsakePendingChoice,
} from './expeditionKeepsakeChoiceEngine';
import {
  patchKeepsakeNodeModifiers,
  pickFutureKeepsakeNode,
  rankNodeIdsByScore,
} from './expeditionKeepsakeRouteEngine';
import {
  incrementKeepsakeCounter,
  patchKeepsakeStats,
  setKeepsakeFlag,
} from './keepsakeRunState';
import { localProceduralDepth } from './proceduralScannerBridge';
import type { KeepsakeScannerApplyResult } from './expeditionKeepsakeScannerEngine';

const HOLLOW_KEYS_START = 3;
const ECHO_THREAD_INTEL_COST = 1;
const QUARRY_CLEAR_CREDITS = 35;
const OUTSIDE_HOOK_ITEM: ResourceItemId = 'ley-slag';

function pickDeterministicNodeId(
  candidates: readonly string[],
  treeSeed: number,
  depth: number,
  salt: string,
): string | null {
  if (candidates.length === 0) return null;
  let hash = (treeSeed + depth * 1319) >>> 0;
  for (let i = 0; i < salt.length; i += 1) {
    hash = (hash * 41 + salt.charCodeAt(i)) >>> 0;
  }
  return candidates[hash % candidates.length] ?? null;
}

export interface KeepsakePhaseDApplyResult {
  runtime: KeepsakeRuntime | null;
  incursionPatch?: Partial<ActiveIncursionState>;
  contract?: ActiveRunContract | null;
  logLines: string[];
  runCreditsDelta?: number;
}

/** Run-start hooks for relics 13–20. */
export function applyKeepsakePhaseDOnRunStart(
  runtime: KeepsakeRuntime | null,
  contract: ActiveRunContract | null,
): KeepsakePhaseDApplyResult {
  if (!runtime) return { runtime, contract, logLines: [] };

  let nextRuntime = runtime;
  const logLines: string[] = [];
  let nextContract = contract;

  if (runtime.keepsakeId === 'hollow_keyring') {
    nextRuntime = incrementKeepsakeCounter(nextRuntime, 'hollowKeys', HOLLOW_KEYS_START);
    logLines.push(formatKeepsakeLogLine('Keyring', `Hollow Keyring armed — ${HOLLOW_KEYS_START} keys.`));
  }

  if (runtime.keepsakeId === 'bent_nail') {
    const trigger = tryKeepsakeTrigger(runtime, getKeepsakeDefinition('bent_nail').primaryTriggerKey, 'run');
    if (trigger.triggered && trigger.runtime) {
      nextRuntime = patchKeepsakeStats(trigger.runtime, {
        outsideCargoNodesCarried: 1,
      });
      logLines.push(formatKeepsakeLogLine('Nail', getKeepsakeDefinition('bent_nail').triggerMessage));
    }
  }

  if (runtime.keepsakeId === 'mirror_writ' && contract?.contractId) {
    const mirror = applyKeepsakeMirrorWritObjective(runtime, contract);
    if (mirror.runtime) nextRuntime = mirror.runtime;
    if (mirror.contract) nextContract = mirror.contract;
    logLines.push(...mirror.logLines);
  }

  return { runtime: nextRuntime, contract: nextContract, logLines };
}

function mirrorObjectiveText(category: KeepsakeMirrorCategory): string {
  switch (category) {
    case 'CREDITS':
      return 'Earn +50 run credits before extract.';
    case 'SPONSOR_REP':
      return 'Meet the sponsor bonus objective.';
    case 'OPERATION_PROGRESS':
      return 'Clear 1 operation target before extract.';
    case 'RESOURCE_PAYOUT':
      return 'Secure 2 cargo items before extract.';
    default:
      return 'Complete the mirrored side promise.';
  }
}

function mirrorTargetValue(category: KeepsakeMirrorCategory): number {
  switch (category) {
    case 'CREDITS': return 50;
    case 'SPONSOR_REP': return 1;
    case 'OPERATION_PROGRESS': return 1;
    case 'RESOURCE_PAYOUT': return 2;
    default: return 1;
  }
}

export function applyKeepsakeMirrorWritObjective(
  runtime: KeepsakeRuntime,
  contract: ActiveRunContract,
): KeepsakePhaseDApplyResult {
  const category = runtime.deployment.mirrorCategory;
  if (!category) {
    return { runtime, contract, logLines: [] };
  }
  const trigger = tryKeepsakeTrigger(runtime, getKeepsakeDefinition('mirror_writ').primaryTriggerKey, 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, contract, logLines: [] };
  }

  const text = mirrorObjectiveText(category);
  return {
    runtime: trigger.runtime,
    contract: {
      ...contract,
      keepsakeMirroredObjective: {
        category,
        text,
        targetValue: mirrorTargetValue(category),
        progressValue: 0,
      },
    },
    logLines: [
      formatKeepsakeLogLine('Writ', getKeepsakeDefinition('mirror_writ').triggerMessage),
      `>> MIRRORED OBJECTIVE — ${text}`,
    ],
  };
}

/** Attach Bent Nail outside hook to cargo on run start. */
export function attachKeepsakeBentNailOutsideHook(cargo: CargoRunState): CargoRunState {
  if (cargo.outsideHook) return cargo;
  return {
    ...cargo,
    outsideHook: {
      instanceId: `bent-nail-hook:${Date.now()}`,
      itemId: OUTSIDE_HOOK_ITEM,
      currentValue: 25,
      scent: 0,
    },
  };
}

/** Scanner-layer hooks for Phase D relics. */
export function applyKeepsakePhaseDScannerLayerEffects(
  inc: ActiveIncursionState,
  tree: ProceduralRunTree,
  depth: number,
  layerIds: readonly string[],
  runtime: KeepsakeRuntime,
  logLines: string[],
): KeepsakeScannerApplyResult {
  let nextInc = inc;
  let nextTree = tree;
  let nextRuntime = runtime;

  if (runtime.keepsakeId === 'mourners_bell' && depth === 1) {
    const result = applyMournersBellD1Bias(nextInc, nextTree, depth, layerIds, nextRuntime, logLines);
    nextInc = result.incursion;
    nextTree = result.incursion.proceduralRunTree ?? nextTree;
    nextRuntime = result.runtime ?? nextRuntime;
  }

  if (runtime.keepsakeId === 'hollow_keyring') {
    const result = applyHollowKeyringOccultLock(nextInc, nextTree, depth, layerIds, nextRuntime, logLines);
    nextInc = result.incursion;
    nextTree = result.incursion.proceduralRunTree ?? nextTree;
    nextRuntime = result.runtime ?? nextRuntime;
  }

  if (runtime.keepsakeId === 'bloodhound_tag') {
    const result = applyBloodhoundQuarryTag(nextInc, nextTree, depth, layerIds, nextRuntime, logLines);
    nextInc = result.incursion;
    nextTree = result.incursion.proceduralRunTree ?? nextTree;
    nextRuntime = result.runtime ?? nextRuntime;
  }

  if (runtime.keepsakeId === 'mirror_writ' && !runtime.flags.mirroredNodePlanted) {
    const targetId = pickFutureKeepsakeNode(nextTree, inc.nodesCleared);
    if (targetId) {
      nextTree = patchKeepsakeNodeModifiers(nextTree, targetId, { keepsakeMirrored: true, highRisk: true });
      nextRuntime = setKeepsakeFlag(nextRuntime, 'mirroredNodePlanted', true);
      logLines.push(formatKeepsakeLogLine('Writ', 'Mirrored node planted on future vector.'));
      nextInc = { ...nextInc, proceduralRunTree: nextTree, keepsakeRuntime: nextRuntime };
    }
  }

  return {
    incursion: { ...nextInc, proceduralRunTree: nextTree, keepsakeRuntime: nextRuntime },
    runtime: nextRuntime,
    logLines,
  };
}

function applyMournersBellD1Bias(
  inc: ActiveIncursionState,
  tree: ProceduralRunTree,
  depth: number,
  layerIds: readonly string[],
  runtime: KeepsakeRuntime,
  logLines: string[],
): KeepsakeScannerApplyResult {
  if (runtime.triggersUsed.mourners_bell_d1_bias) {
    return { incursion: inc, runtime, logLines };
  }
  const trigger = tryKeepsakeTrigger(runtime, 'mourners_bell_d1_bias', 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { incursion: inc, runtime, logLines };
  }

  const candidates = layerIds.filter((id) => {
    const node = tree.nodes[id];
    return node && node.type !== 'GATEKEEPER' && node.type !== 'EXTRACTION' && !node.echoOverlay;
  });
  const targetId = pickDeterministicNodeId(candidates, tree.rollSeed ?? 0, depth, 'mourners_bell');
  if (!targetId) {
    return { incursion: inc, runtime: trigger.runtime, logLines };
  }

  const node = tree.nodes[targetId]!;
  const nextTree: ProceduralRunTree = {
    ...tree,
    nodes: {
      ...tree.nodes,
      [targetId]: {
        ...node,
        echoOverlay: createEchoOverlay(`mourners_bell:${targetId}`),
      },
    },
  };

  logLines.push(formatKeepsakeLogLine('Bell', getKeepsakeDefinition('mourners_bell').triggerMessage));

  return {
    incursion: { ...inc, proceduralRunTree: nextTree },
    runtime: patchKeepsakeStats(trigger.runtime, {
      echoSignalsGenerated: trigger.runtime.stats.echoSignalsGenerated + 1,
    }),
    logLines,
  };
}

function applyHollowKeyringOccultLock(
  inc: ActiveIncursionState,
  tree: ProceduralRunTree,
  depth: number,
  layerIds: readonly string[],
  runtime: KeepsakeRuntime,
  logLines: string[],
): KeepsakeScannerApplyResult {
  const trigger = tryKeepsakeTrigger(
    runtime,
    `${getKeepsakeDefinition('hollow_keyring').primaryTriggerKey}:${depth}`,
    'depth',
    depth,
  );
  if (!trigger.triggered || !trigger.runtime) {
    return { incursion: inc, runtime, logLines };
  }

  const candidates = layerIds.filter((id) => {
    const node = tree.nodes[id];
    return node
      && node.type !== 'GATEKEEPER'
      && node.type !== 'EXTRACTION'
      && !node.contextModifiers?.keepsakeOccultLock;
  });
  const targetId = pickDeterministicNodeId(candidates, tree.rollSeed ?? 0, depth, 'hollow_keyring');
  if (!targetId) {
    return { incursion: inc, runtime: trigger.runtime, logLines };
  }

  const nextTree = patchKeepsakeNodeModifiers(tree, targetId, { keepsakeOccultLock: true, highRisk: true });
  logLines.push(formatKeepsakeLogLine('Keyring', 'Occult lock staged on scanner layer.'));

  return {
    incursion: { ...inc, proceduralRunTree: nextTree },
    runtime: trigger.runtime,
    logLines,
  };
}

function applyBloodhoundQuarryTag(
  inc: ActiveIncursionState,
  tree: ProceduralRunTree,
  depth: number,
  layerIds: readonly string[],
  runtime: KeepsakeRuntime,
  logLines: string[],
): KeepsakeScannerApplyResult {
  const trigger = tryKeepsakeTrigger(
    runtime,
    `${getKeepsakeDefinition('bloodhound_tag').primaryTriggerKey}:${depth}`,
    'depth',
    depth,
  );
  if (!trigger.triggered || !trigger.runtime) {
    return { incursion: inc, runtime, logLines };
  }

  const scoreQuarry = (nodeId: string): number => {
    const node = tree.nodes[nodeId];
    if (!node) return 0;
    if (node.type === 'ELITE') return 100;
    if (node.type === 'COMBAT') return 70;
    if (node.contextModifiers?.highRisk) return 40;
    return 0;
  };
  const pool = layerIds.filter((id) => scoreQuarry(id) > 0);
  const targetId = rankNodeIdsByScore(pool.length > 0 ? pool : layerIds, tree, scoreQuarry)[0]
    ?? pickDeterministicNodeId(layerIds, tree.rollSeed ?? 0, depth, 'bloodhound_tag');
  if (!targetId) {
    return { incursion: inc, runtime: trigger.runtime, logLines };
  }

  const nextTree = patchKeepsakeNodeModifiers(tree, targetId, {
    keepsakeTaggedQuarry: true,
    highRisk: true,
  });
  logLines.push(formatKeepsakeLogLine('Tag', getKeepsakeDefinition('bloodhound_tag').triggerMessage));

  return {
    incursion: { ...inc, proceduralRunTree: nextTree },
    runtime: patchKeepsakeStats(trigger.runtime, {
      nodeDetailsRevealed: trigger.runtime.stats.nodeDetailsRevealed + 1,
    }),
    logLines,
  };
}

/** Node reveal — queue bell answer or key unlock choices. */
export function applyKeepsakePhaseDOnNodeRevealed(
  inc: ActiveIncursionState,
  nodeId: string,
  runtime: KeepsakeRuntime | null,
): KeepsakePhaseDApplyResult {
  if (!runtime) return { runtime, logLines: [] };

  const node = inc.proceduralRunTree?.nodes[nodeId];
  const modifiers = node?.contextModifiers;
  const logLines: string[] = [];
  let nextRuntime = runtime;

  if (
    runtime.keepsakeId === 'mourners_bell'
    && (node?.echoOverlay || modifiers?.echoSignal)
    && !runtime.triggersUsed.mourners_bell_answer_queued
  ) {
    nextRuntime = queueKeepsakePendingChoice(
      {
        ...runtime,
        triggersUsed: { ...runtime.triggersUsed, mourners_bell_answer_queued: true },
      },
      buildMournersBellChoice(nodeId),
    );
    logLines.push(">> MOURNER'S BELL — answer the echo signal.");
    return { runtime: nextRuntime, logLines };
  }

  if (
    runtime.keepsakeId === 'hollow_keyring'
    && modifiers?.keepsakeOccultLock
    && (runtime.counters.hollowKeys ?? 0) > 0
    && !runtime.triggersUsed[`hollow_key_offer:${nodeId}`]
  ) {
    nextRuntime = queueKeepsakePendingChoice(
      {
        ...runtime,
        triggersUsed: { ...runtime.triggersUsed, [`hollow_key_offer:${nodeId}`]: true },
      },
      buildHollowKeyUnlockChoice(nodeId),
    );
    logLines.push('>> HOLLOW KEYRING — occult lock detected.');
    return { runtime: nextRuntime, logLines };
  }

  return { runtime: nextRuntime, logLines };
}

/** Node selected — False Evac Beacon plant choice. */
export function applyKeepsakePhaseDOnNodeSelected(
  inc: ActiveIncursionState,
  selectedNodeId: string,
  runtime: KeepsakeRuntime | null,
): KeepsakePhaseDApplyResult {
  if (!runtime || runtime.keepsakeId !== 'false_evac_beacon') {
    return { runtime, logLines: [] };
  }

  const depth = localProceduralDepth(inc.nodesCleared);
  const trigger = tryKeepsakeTrigger(
    runtime,
    `${getKeepsakeDefinition('false_evac_beacon').primaryTriggerKey}:${depth}`,
    'depth',
    depth,
  );
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, logLines: [] };
  }

  if (trigger.runtime.pendingChoice) {
    return { runtime: trigger.runtime, logLines: [] };
  }

  const nextRuntime = queueKeepsakePendingChoice(
    trigger.runtime,
    buildFalseEvacBeaconChoice(selectedNodeId),
  );

  return {
    runtime: nextRuntime,
    logLines: [formatKeepsakeLogLine('Beacon', 'Choose a false evac signal to plant.')],
  };
}

/** Node clear — quarry payout, bent nail scent, mirror progress. */
export function applyKeepsakePhaseDOnNodeClear(
  inc: ActiveIncursionState,
  runtime: KeepsakeRuntime | null,
  cargo: CargoRunState,
  completedNodeId: string,
): KeepsakePhaseDApplyResult & { cargo?: CargoRunState } {
  if (!runtime) return { runtime, logLines: [] };

  const node = inc.proceduralRunTree?.nodes[completedNodeId]
    ?? inc.encounterPath.find((n) => n.id === completedNodeId);
  const modifiers = node && 'contextModifiers' in node ? node.contextModifiers : undefined;
  const logLines: string[] = [];
  let nextRuntime = runtime;
  let nextCargo = cargo;
  let runCreditsDelta = 0;
  let incursionPatch: Partial<ActiveIncursionState> | undefined;

  if (runtime.keepsakeId === 'bloodhound_tag' && modifiers?.keepsakeTaggedQuarry) {
    if (!runtime.triggersUsed[`quarry_clear:${completedNodeId}`]) {
      nextRuntime = patchKeepsakeStats(
        {
          ...runtime,
          triggersUsed: { ...runtime.triggersUsed, [`quarry_clear:${completedNodeId}`]: true },
        },
        {
          rivalQuarriesCleared: runtime.stats.rivalQuarriesCleared + 1,
          creditsSaved: runtime.stats.creditsSaved + QUARRY_CLEAR_CREDITS,
        },
      );
      runCreditsDelta = QUARRY_CLEAR_CREDITS;
      logLines.push(`>> QUARRY DOWN — +${QUARRY_CLEAR_CREDITS} run credits from tagged rival.`);
    }
  }

  if (runtime.keepsakeId === 'bent_nail' && nextCargo.outsideHook) {
    const hook = nextCargo.outsideHook;
    const scent = hook.scent + 1;
    const value = hook.currentValue + Math.floor(hook.currentValue * 0.05);
    nextCargo = {
      ...nextCargo,
      outsideHook: { ...hook, scent, currentValue: value },
    };
    nextRuntime = incrementKeepsakeCounter(nextRuntime, 'scent', 1);
    nextRuntime = patchKeepsakeStats(nextRuntime, {
      cargoValueBonus: nextRuntime.stats.cargoValueBonus + 1,
    });
    logLines.push(`>> OUTSIDE HOOK — scent ${scent}, value ${value} CR.`);
  }

  if (inc.activeContract?.keepsakeMirroredObjective && runtime.keepsakeId === 'mirror_writ') {
    const objective = inc.activeContract.keepsakeMirroredObjective;
    let progress = objective.progressValue ?? 0;
    if (objective.category === 'OPERATION_PROGRESS' && modifiers?.operationTag) {
      progress += 1;
    }
    if (objective.category === 'RESOURCE_PAYOUT') {
      progress = cargo.containment.length + cargo.grid.placed.length
        + (nextCargo.outsideHook ? 1 : 0);
    }
    if (progress !== objective.progressValue) {
      incursionPatch = {
        activeContract: {
          ...inc.activeContract,
          keepsakeMirroredObjective: { ...objective, progressValue: progress },
        },
      };
    }
  }

  return {
    runtime: nextRuntime,
    cargo: nextCargo,
    incursionPatch,
    runCreditsDelta: runCreditsDelta > 0 ? runCreditsDelta : undefined,
    logLines,
  };
}

/** Mourner's Bell — echo resolution grants thread and intel. */
export function applyKeepsakeMournersBellOnEchoResolved(
  runtime: KeepsakeRuntime | null,
): { runtime: KeepsakeRuntime | null; extraEchoGlass: number; creditMultiplier: number; logLines: string[] } {
  if (!runtime || runtime.keepsakeId !== 'mourners_bell') {
    return { runtime, extraEchoGlass: 0, creditMultiplier: 1, logLines: [] };
  }

  const trigger = tryKeepsakeTrigger(runtime, getKeepsakeDefinition('mourners_bell').primaryTriggerKey, 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { runtime, extraEchoGlass: 0, creditMultiplier: 1, logLines: [] };
  }

  const bellAction = runtime.decisions.find((d) => d.key === 'mourners_bell')?.value ?? 'LISTEN';
  let nextRuntime = incrementKeepsakeCounter(trigger.runtime, 'echoThread', 1);
  nextRuntime = patchKeepsakeStats(nextRuntime, {
    echoThreadGenerated: nextRuntime.stats.echoThreadGenerated + 1,
    echoGlassBonus: nextRuntime.stats.echoGlassBonus + (bellAction === 'LOOT' ? 1 : 0),
  });

  const extraEchoGlass = bellAction === 'LOOT' ? 1 : 0;
  const creditMultiplier = bellAction === 'LISTEN' ? 1.15 : 1;

  return {
    runtime: nextRuntime,
    extraEchoGlass,
    creditMultiplier,
    logLines: [
      formatKeepsakeLogLine('Bell', 'Echo answered — Echo Thread +1.'),
      ...(bellAction === 'BURY' ? ['>> BELL BURIED — hostile echo pressure reduced.'] : []),
    ],
  };
}

export function spendKeepsakeEchoThreadForIntel(
  runtime: KeepsakeRuntime | null,
): KeepsakePhaseDApplyResult {
  if (!runtime || runtime.keepsakeId !== 'mourners_bell') {
    return { runtime, logLines: [] };
  }
  const thread = runtime.counters.echoThread ?? 0;
  if (thread < ECHO_THREAD_INTEL_COST) {
    return { runtime, logLines: ['>> ECHO THREAD — insufficient thread for intel spend.'] };
  }

  const nextRuntime = patchKeepsakeStats(
    incrementKeepsakeCounter(runtime, 'echoThread', -ECHO_THREAD_INTEL_COST),
    { echoIntelRevealed: runtime.stats.echoIntelRevealed + 1 },
  );

  return {
    runtime: nextRuntime,
    logLines: ['>> ECHO THREAD SPENT — scanner intel widened.'],
  };
}

/** Bent Nail — outside hook lost first on dirty extraction. */
export function stripKeepsakeOutsideHookOnDirtyExtract(
  runtime: KeepsakeRuntime | null,
  cargo: CargoRunState,
): { runtime: KeepsakeRuntime | null; cargo: CargoRunState; logLines: string[] } {
  if (!cargo.outsideHook) {
    return { runtime, cargo, logLines: [] };
  }

  const lostValue = cargo.outsideHook.currentValue;
  const logLines = [`>> BENT NAIL — outside hook purged (−${lostValue} CR value).`];
  let nextRuntime = runtime;
  if (runtime?.keepsakeId === 'bent_nail') {
    nextRuntime = patchKeepsakeStats(runtime, {
      cargoPreserved: Math.max(0, runtime.stats.cargoPreserved - 1),
    });
  }

  return {
    runtime: nextRuntime,
    cargo: { ...cargo, outsideHook: null },
    logLines,
  };
}

export function resolveKeepsakeOutsideHookResonancePenalty(
  cargo: CargoRunState,
): number {
  const scent = cargo.outsideHook?.scent ?? 0;
  if (scent <= 0) return 0;
  return Math.min(0.25, scent * 0.03);
}

export interface MirroredObjectiveEvaluation {
  met: boolean;
  progressText: string;
  creditsBonus: number;
  reputationBonus: number;
}

export function evaluateKeepsakeMirroredObjective(
  objective: NonNullable<ActiveRunContract['keepsakeMirroredObjective']>,
  progress: import('../types/contract').ContractRunProgress,
  runCredits: number,
  cargo: CargoRunState,
  doubleOrBreak: boolean,
): MirroredObjectiveEvaluation {
  const empty: MirroredObjectiveEvaluation = {
    met: false,
    progressText: 'Mirrored objective incomplete.',
    creditsBonus: 0,
    reputationBonus: 0,
  };

  let met = false;
  let progressText = empty.progressText;

  switch (objective.category) {
    case 'CREDITS':
      met = runCredits >= objective.targetValue;
      progressText = `Run credits: ${runCredits}/${objective.targetValue}`;
      break;
    case 'SPONSOR_REP':
      met = progress.highestDepthReached >= 2;
      progressText = `Depth reached: ${progress.highestDepthReached}/2`;
      break;
    case 'OPERATION_PROGRESS':
      met = progress.operationTargetsCleared >= objective.targetValue;
      progressText = `Operation targets: ${progress.operationTargetsCleared}/${objective.targetValue}`;
      break;
    case 'RESOURCE_PAYOUT': {
      const total = cargo.containment.length + cargo.grid.placed.length + (cargo.outsideHook ? 1 : 0);
      met = total >= objective.targetValue;
      progressText = `Cargo secured: ${total}/${objective.targetValue}`;
      break;
    }
    default:
      return empty;
  }

  if (!met) {
    return { ...empty, progressText, met: doubleOrBreak ? false : false };
  }

  const baseCredits = 30;
  const baseRep = 25;
  const multiplier = doubleOrBreak ? 2 : 1;

  return {
    met: true,
    progressText,
    creditsBonus: baseCredits * multiplier,
    reputationBonus: baseRep * multiplier,
  };
}

export { ECHO_THREAD_INTEL_COST };
