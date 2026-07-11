import type { CargoRunState } from '../types/cargoGrid';
import type { ActiveIncursionState } from '../types/game';
import type { KeepsakeRuntime } from '../types/expeditionKeepsake';
import type { ProceduralNodeType, ProceduralRunNode, ProceduralRunTree } from '../types/proceduralRunTree';
import type { NodeContextModifiers, RunGenerationContext } from '../types/worldState';
import { isOperationProgressLocked } from '../utils/veilFrontSectorUi';
import {
  createEchoOverlay,
  isEchoOverlayNodeTypeEligible,
  mergeEchoOverlayIntoModifiers,
  recordEchoOverlayPlacement,
  resolveEchoEncounterAtEngagement,
} from './echoEncounterEngine';
import { rollNodeContextModifiers } from './nodeGenerationContextEngine';
import { createNodeContextRng } from './lazyNodeContextEngine';
import { buildCarriedCargoContextRollBias } from './unstableCargoEffectsEngine';
import {
  formatKeepsakeLogLine,
  tryKeepsakeTrigger,
} from './expeditionKeepsakeEngine';
import { getKeepsakeDefinition } from './expeditionKeepsakeRegistry';
import { patchKeepsakeStats } from './keepsakeRunState';
import { localProceduralDepth } from './proceduralScannerBridge';
import {
  applyKeepsakePhaseDOnNodeRevealed,
  applyKeepsakePhaseDOnNodeSelected,
  applyKeepsakePhaseDScannerLayerEffects,
} from './expeditionKeepsakePhaseDEngine';
import { applyKeepsakeOnExtractionNodeReveal } from './expeditionKeepsakeEconomyEngine';
import {
  buildCartographLockChoice,
  buildPolaroidDevelopChoice,
  queueKeepsakePendingChoice,
} from './expeditionKeepsakeChoiceEngine';
import {
  patchKeepsakeNodeModifiers,
  rankNodeIdsByScore,
  scoreNodeForAttunement,
  scoreNodeTypeForDoctrine,
} from './expeditionKeepsakeRouteEngine';

const RUNNER_IMPRINT_LABELS = [
  'RESIDUAL RUNNER SIGNATURE',
  'FALLEN RUNNER TRACE',
] as const;

export interface KeepsakeScannerApplyResult {
  incursion: ActiveIncursionState;
  runtime: KeepsakeRuntime | null;
  logLines: string[];
}

function hashKeepsakePick(treeSeed: number, depth: number, salt: string): number {
  let hash = (treeSeed + depth * 1319) >>> 0;
  for (let i = 0; i < salt.length; i += 1) {
    hash = (hash * 41 + salt.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickDeterministicNodeId(
  candidates: readonly string[],
  treeSeed: number,
  depth: number,
  salt: string,
): string | null {
  if (candidates.length === 0) return null;
  const hash = hashKeepsakePick(treeSeed, depth, salt);
  return candidates[hash % candidates.length] ?? null;
}

function equippedKeepsakeId(runtime: KeepsakeRuntime | null | undefined): string | null {
  return runtime?.keepsakeId ?? null;
}

function rollScannerLayerContext(
  tree: ProceduralRunTree,
  nodeId: string,
  runContext: RunGenerationContext | null | undefined,
  cargo: CargoRunState,
  resolveEchoKind: boolean,
): { tree: ProceduralRunTree; modifiers: NodeContextModifiers | null } {
  const node = tree.nodes[nodeId];
  if (!node || node.contextModifiers) {
    return { tree, modifiers: node?.contextModifiers ?? null };
  }
  if (tree.rollSeed == null || tree.modifierRollState == null) {
    return { tree, modifiers: null };
  }

  const rollState = {
    echoSignalsUsed: tree.modifierRollState.echoSignalsUsed,
    legendaryEchoUsed: tree.modifierRollState.legendaryEchoUsed,
    echoSignalsByDepth: { ...tree.modifierRollState.echoSignalsByDepth },
  };
  const rng = createNodeContextRng(tree.rollSeed, nodeId);
  const cargoBias = buildCarriedCargoContextRollBias(cargo);
  const depthIndex = tree.macroDepthIndex ?? 1;

  let modifiers = rollNodeContextModifiers(
    node.depth,
    node.type,
    depthIndex,
    runContext,
    rng,
    rollState,
    cargoBias,
  );
  modifiers = mergeEchoOverlayIntoModifiers(modifiers, node.echoOverlay);

  if (resolveEchoKind && modifiers.echoSignal && runContext) {
    modifiers = resolveEchoEncounterAtEngagement(
      modifiers,
      depthIndex,
      node.type,
      runContext,
      `${nodeId}:polaroid:${node.depth}`,
      rollState,
    );
  }

  const updatedNode: ProceduralRunNode = {
    ...node,
    contextModifiers: modifiers,
  };

  return {
    tree: {
      ...tree,
      modifierRollState: rollState,
      nodes: { ...tree.nodes, [nodeId]: updatedNode },
    },
    modifiers,
  };
}

function applySignalCompass(
  inc: ActiveIncursionState,
  tree: ProceduralRunTree,
  depth: number,
  layerIds: readonly string[],
  runtime: KeepsakeRuntime,
  logLines: string[],
): KeepsakeScannerApplyResult {
  const trigger = tryKeepsakeTrigger(
    runtime,
    getKeepsakeDefinition('signal_compass').primaryTriggerKey,
    'depth',
    depth,
  );
  if (!trigger.triggered || !trigger.runtime) {
    return { incursion: inc, runtime, logLines };
  }

  const attunement = runtime.deployment.attunement;
  const eligible = layerIds.filter((id) => tree.nodes[id]?.type !== 'GATEKEEPER');
  const scoreCompassNode = (nodeId: string): number => {
    const node = tree.nodes[nodeId];
    if (!node) return 0;
    return scoreNodeForAttunement(node.type, node.contextModifiers, attunement);
  };
  const attuned = eligible.filter((id) => scoreCompassNode(id) >= 40);
  const pool = attuned.length > 0 ? attuned : eligible;
  const targetId = rankNodeIdsByScore(pool, tree, scoreCompassNode)[0]
    ?? pickDeterministicNodeId(eligible, tree.rollSeed!, depth, 'signal_compass');
  if (!targetId) {
    return { incursion: inc, runtime: trigger.runtime, logLines };
  }

  const rolled = rollScannerLayerContext(
    tree,
    targetId,
    inc.runGenerationContext,
    inc.cargo,
    false,
  );

  const interpretedIds = inc.keepsakeFullyInterpretedNodeIds.includes(targetId)
    ? inc.keepsakeFullyInterpretedNodeIds
    : [...inc.keepsakeFullyInterpretedNodeIds, targetId];

  logLines.push(formatKeepsakeLogLine('Compass', getKeepsakeDefinition('signal_compass').triggerMessage));

  return {
    incursion: {
      ...inc,
      proceduralRunTree: rolled.tree,
      keepsakeFullyInterpretedNodeIds: interpretedIds,
    },
    runtime: patchKeepsakeStats(trigger.runtime, {
      nodeDetailsRevealed: trigger.runtime.stats.nodeDetailsRevealed + 1,
    }),
    logLines,
  };
}

function applyDeadDropReceiver(
  inc: ActiveIncursionState,
  tree: ProceduralRunTree,
  depth: number,
  layerIds: readonly string[],
  runtime: KeepsakeRuntime,
  logLines: string[],
): KeepsakeScannerApplyResult {
  const def = getKeepsakeDefinition('dead_drop_receiver');
  const trigger = tryKeepsakeTrigger(runtime, def.primaryTriggerKey, 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { incursion: inc, runtime, logLines };
  }

  const resourceIds = layerIds.filter((id) => tree.nodes[id]?.type === 'RESOURCE');
  let nextTree = tree;
  let converted = false;

  for (const nodeId of resourceIds) {
    const rolled = rollScannerLayerContext(
      nextTree,
      nodeId,
      inc.runGenerationContext,
      inc.cargo,
      false,
    );
    nextTree = rolled.tree;
    const modifiers = rolled.modifiers;
    if (modifiers?.highValueResource) {
      const node = nextTree.nodes[nodeId];
      if (node) {
        nextTree = {
          ...nextTree,
          nodes: {
            ...nextTree.nodes,
            [nodeId]: {
              ...node,
              contextModifiers: {
                ...modifiers,
                keepsakeDeadDrop: true,
                highRisk: true,
              },
            },
          },
        };
        converted = true;
        break;
      }
    }
  }

  if (!converted) {
    const fallbackId = resourceIds[0];
    if (fallbackId) {
      const node = nextTree.nodes[fallbackId];
      if (node) {
        const rolled = rollScannerLayerContext(
          nextTree,
          fallbackId,
          inc.runGenerationContext,
          inc.cargo,
          false,
        );
        nextTree = rolled.tree;
        const base = rolled.modifiers ?? {
          depthStage: 'THRESHOLD',
          nodePressureBand: 'MEDIUM',
        };
        nextTree = {
          ...nextTree,
          nodes: {
            ...nextTree.nodes,
            [fallbackId]: {
              ...node,
              contextModifiers: {
                ...base,
                highValueResource: true,
                keepsakeDeadDrop: true,
                highRisk: true,
              },
            },
          },
        };
        converted = true;
      }
    }
  }

  if (!converted) {
    return { incursion: inc, runtime: trigger.runtime, logLines };
  }

  logLines.push(formatKeepsakeLogLine('Receiver', def.triggerMessage));

  return {
    incursion: { ...inc, proceduralRunTree: nextTree },
    runtime: patchKeepsakeStats(trigger.runtime, {
      bonusResourcesGenerated: trigger.runtime.stats.bonusResourcesGenerated + 1,
    }),
    logLines,
  };
}

/** Apply scanner-layer keepsake hooks after procedural types and echo overlays resolve. */
export function applyKeepsakeScannerLayerEffects(
  inc: ActiveIncursionState,
): KeepsakeScannerApplyResult {
  const tree = inc.proceduralRunTree;
  let runtime = inc.keepsakeRuntime;
  const logLines: string[] = [];
  if (!tree?.rollSeed || !runtime) {
    return { incursion: inc, runtime, logLines };
  }

  const depth = localProceduralDepth(inc.nodesCleared);
  const layerIds = tree.depthIndex[depth] ?? [];
  if (layerIds.length === 0) {
    return { incursion: inc, runtime, logLines };
  }

  let nextInc = inc;
  let nextTree = tree;

  if (equippedKeepsakeId(runtime) === 'signal_compass') {
    const result = applySignalCompass(nextInc, nextTree, depth, layerIds, runtime, logLines);
    nextInc = result.incursion;
    nextTree = result.incursion.proceduralRunTree ?? nextTree;
    runtime = result.runtime;
  }

  if (equippedKeepsakeId(runtime) === 'dead_drop_receiver' && runtime) {
    const result = applyDeadDropReceiver(nextInc, nextTree, depth, layerIds, runtime, logLines);
    nextInc = result.incursion;
    nextTree = result.incursion.proceduralRunTree ?? nextTree;
    runtime = result.runtime;
  }

  if (equippedKeepsakeId(runtime) === 'anchor_charm' && runtime) {
    const trail = applyAnchorCharmScannerTrail(nextInc, nextTree, depth, layerIds, runtime, logLines);
    nextInc = trail.incursion;
    nextTree = trail.incursion.proceduralRunTree ?? nextTree;
    runtime = trail.runtime;
  }

  if (runtime) {
    const extractionReveal = applyKeepsakeOnExtractionNodeReveal(runtime, nextTree, layerIds);
    runtime = extractionReveal.runtime;
    logLines.push(...extractionReveal.logLines);
    if (extractionReveal.incursionPatch) {
      nextInc = { ...nextInc, ...extractionReveal.incursionPatch };
    }
  }

  if (runtime) {
    const phaseD = applyKeepsakePhaseDScannerLayerEffects(
      nextInc,
      nextTree,
      depth,
      layerIds,
      runtime,
      logLines,
    );
    nextInc = phaseD.incursion;
    nextTree = phaseD.incursion.proceduralRunTree ?? nextTree;
    runtime = phaseD.runtime;
  }

  return {
    incursion: { ...nextInc, proceduralRunTree: nextTree },
    runtime,
    logLines,
  };
}

function isRunnerImprintLabel(label: string | undefined): boolean {
  if (!label) return false;
  const upper = label.toUpperCase();
  return RUNNER_IMPRINT_LABELS.some((token) => upper.includes(token.split(' ')[0]!))
    || upper.includes('FALLEN RUNNER')
    || upper.includes('RESIDUAL RUNNER');
}

function buildGravePolaroidLines(
  modifiers: NodeContextModifiers,
  nodeType: ProceduralNodeType,
): string[] {
  const lines = ['> POLAROID IMPRINT // DEVELOPED'];
  const kind = modifiers.echoEncounterKind;

  if (kind === 'FALLEN_RUNNER_ECHO' || isRunnerImprintLabel(modifiers.echoSignalLabel)) {
    lines.push('> ORIGIN: FALLEN RUNNER DEATH IMPRINT');
    lines.push('> RISK: HOSTILE REACTIVATION ON BREACH');
    lines.push('> REWARD: ECHO-GLASS + IMPRINT DATA');
  } else if (kind === 'HOSTILE_ECHO') {
    lines.push('> ORIGIN: CORRUPTED HOSTILE ECHO');
    lines.push('> RISK: ELITE-GRADE HOSTILE SIGNATURE');
    lines.push('> REWARD: ECHO RESIDUE + OPERATION CREDIT');
  } else {
    lines.push(`> VECTOR CLASS: ${nodeType.replace(/_/g, ' ')}`);
    lines.push('> RISK: UNSTABLE ECHO BLEED');
    lines.push('> REWARD: ECHO-GLASS ROLL ON CLEAR');
  }

  return lines;
}

/** Ashen Cartograph + False Evac Beacon — node selection hooks. */
export function applyKeepsakeOnNodeSelected(
  inc: ActiveIncursionState,
  selectedNodeId: string,
): KeepsakeScannerApplyResult {
  let runtime = inc.keepsakeRuntime;
  const logLines: string[] = [];
  if (!runtime) {
    return { incursion: inc, runtime, logLines };
  }

  if (runtime.keepsakeId === 'ashen_cartograph') {
    const tree = inc.proceduralRunTree;
    if (tree) {
      const depth = localProceduralDepth(inc.nodesCleared);
      const trigger = tryKeepsakeTrigger(
        runtime,
        getKeepsakeDefinition('ashen_cartograph').primaryTriggerKey,
        'depth',
        depth,
      );
      if (trigger.triggered && trigger.runtime) {
        const parent = tree.nodes[selectedNodeId];
        const childIds = parent?.children ?? [];
        const doctrine = trigger.runtime.deployment.routeDoctrine;
        const scoreChild = (nodeId: string): number => {
          const node = tree.nodes[nodeId];
          if (!node) return 0;
          return scoreNodeTypeForDoctrine(node.type, node.contextModifiers, doctrine);
        };
        const rankedChildren = rankNodeIdsByScore(
          childIds.filter((id) => tree.nodes[id] != null),
          tree,
          scoreChild,
        );
        const ghostIds = rankedChildren.slice(0, 2);
        const ghostId = ghostIds[0] ?? pickDeterministicNodeId(
          childIds.filter((id) => tree.nodes[id] != null),
          tree.rollSeed ?? 0,
          depth,
          'ashen_cartograph',
        );

        if (ghostId) {
          logLines.push(formatKeepsakeLogLine('Cartograph', getKeepsakeDefinition('ashen_cartograph').triggerMessage));
          let nextRuntime = patchKeepsakeStats(trigger.runtime, {
            futureNodesPreviewed: trigger.runtime.stats.futureNodesPreviewed + ghostIds.length,
          });
          if (!nextRuntime.pendingChoice) {
            nextRuntime = queueKeepsakePendingChoice(
              nextRuntime,
              buildCartographLockChoice(ghostId),
            );
          }
          runtime = nextRuntime;
          return {
            incursion: {
              ...inc,
              keepsakeRuntime: runtime,
              keepsakeCartographGhostNodeId: ghostId,
              keepsakeCartographGhostNodeIds: ghostIds,
            },
            runtime,
            logLines,
          };
        }
        runtime = trigger.runtime;
      }
    }
  }

  const phaseD = applyKeepsakePhaseDOnNodeSelected(inc, selectedNodeId, runtime);
  runtime = phaseD.runtime ?? runtime;
  logLines.push(...phaseD.logLines);

  return {
    incursion: { ...inc, keepsakeRuntime: runtime },
    runtime,
    logLines,
  };
}

/** Grave Polaroid + Signal Compass reveal hooks when a scanner node is manifested. */
export function applyKeepsakeOnNodeRevealed(
  inc: ActiveIncursionState,
  nodeId: string,
): KeepsakeScannerApplyResult {
  let runtime = inc.keepsakeRuntime;
  const logLines: string[] = [];
  const tree = inc.proceduralRunTree;
  if (!runtime || !tree) {
    return { incursion: inc, runtime, logLines };
  }

  let nextInc = inc;
  let nextTree = tree;

  const isCompassNode = inc.keepsakeFullyInterpretedNodeIds.includes(nodeId);
  if (isCompassNode && runtime.keepsakeId === 'signal_compass') {
    const rolled = rollScannerLayerContext(
      nextTree,
      nodeId,
      inc.runGenerationContext,
      inc.cargo,
      false,
    );
    nextTree = rolled.tree;
    nextInc = { ...nextInc, proceduralRunTree: nextTree };
  }

  if (runtime.keepsakeId !== 'grave_polaroid') {
    const phaseDReveal = applyKeepsakePhaseDOnNodeRevealed(nextInc, nodeId, runtime);
    if (phaseDReveal.runtime) runtime = phaseDReveal.runtime;
    logLines.push(...phaseDReveal.logLines);
    return { incursion: nextInc, runtime, logLines };
  }

  const node = nextTree.nodes[nodeId];
  if (!node?.echoOverlay && !node?.contextModifiers?.echoSignal) {
    return { incursion: nextInc, runtime, logLines };
  }

  const trigger = tryKeepsakeTrigger(
    runtime,
    getKeepsakeDefinition('grave_polaroid').primaryTriggerKey,
    'run',
  );
  if (!trigger.triggered || !trigger.runtime) {
    return { incursion: nextInc, runtime, logLines };
  }

  const rolled = rollScannerLayerContext(
    nextTree,
    nodeId,
    inc.runGenerationContext,
    inc.cargo,
    true,
  );
  nextTree = rolled.tree;
  const modifiers = rolled.modifiers;
  if (!modifiers) {
    return { incursion: nextInc, runtime: trigger.runtime, logLines };
  }

  const previewLines = buildGravePolaroidLines(modifiers, node.type);
  logLines.push(formatKeepsakeLogLine('Polaroid', getKeepsakeDefinition('grave_polaroid').triggerMessage));

  let nextRuntime = patchKeepsakeStats(trigger.runtime, {
    echoGlassBonus: trigger.runtime.stats.echoGlassBonus + 1,
  });
  if (!nextRuntime.pendingChoice) {
    nextRuntime = queueKeepsakePendingChoice(
      nextRuntime,
      buildPolaroidDevelopChoice(nodeId),
    );
  }

  const phaseDReveal = applyKeepsakePhaseDOnNodeRevealed(nextInc, nodeId, nextRuntime);
  nextRuntime = phaseDReveal.runtime ?? nextRuntime;
  logLines.push(...phaseDReveal.logLines);

  return {
    incursion: {
      ...nextInc,
      proceduralRunTree: nextTree,
      keepsakeGravePolaroidPreview: { nodeId, lines: previewLines },
    },
    runtime: nextRuntime,
    logLines,
  };
}

function applyAnchorCharmScannerTrail(
  inc: ActiveIncursionState,
  tree: ProceduralRunTree,
  depth: number,
  layerIds: readonly string[],
  runtime: KeepsakeRuntime,
  logLines: string[],
): KeepsakeScannerApplyResult {
  if (runtime.triggersUsed.anchor_charm_trail_started) {
    return { incursion: inc, runtime, logLines };
  }

  const trigger = tryKeepsakeTrigger(runtime, 'anchor_charm_trail_started', 'run');
  if (!trigger.triggered || !trigger.runtime) {
    return { incursion: inc, runtime, logLines };
  }

  const candidates = layerIds.filter((id) => {
    const node = tree.nodes[id];
    return node
      && node.type !== 'GATEKEEPER'
      && node.type !== 'EXTRACTION'
      && !node.contextModifiers?.anchorSignal;
  });
  const targetId = pickDeterministicNodeId(
    candidates,
    tree.rollSeed ?? 0,
    depth,
    'anchor_charm_trail',
  );
  if (!targetId) {
    return { incursion: inc, runtime: trigger.runtime, logLines };
  }

  const nextTree = patchKeepsakeNodeModifiers(tree, targetId, {
    anchorSignal: true,
    keepsakeHarmonic: true,
    highRisk: true,
  });

  logLines.push(formatKeepsakeLogLine('Charm', 'Anchor trail harmonic staged on scanner layer.'));

  return {
    incursion: { ...inc, proceduralRunTree: nextTree },
    runtime: patchKeepsakeStats(trigger.runtime, {
      anchorSignalsGenerated: trigger.runtime.stats.anchorSignalsGenerated + 1,
    }),
    logLines,
  };
}

export function isKeepsakeFullyInterpretedNode(
  inc: Pick<ActiveIncursionState, 'keepsakeFullyInterpretedNodeIds'>,
  nodeId: string,
): boolean {
  return inc.keepsakeFullyInterpretedNodeIds.includes(nodeId);
}

export function getKeepsakeCartographGhostType(
  inc: ActiveIncursionState,
  nodeId: string,
): ProceduralNodeType | null {
  const ghostIds = inc.keepsakeCartographGhostNodeIds?.length
    ? inc.keepsakeCartographGhostNodeIds
    : inc.keepsakeCartographGhostNodeId
      ? [inc.keepsakeCartographGhostNodeId]
      : [];
  if (!ghostIds.includes(nodeId)) return null;
  return inc.proceduralRunTree?.nodes[nodeId]?.type ?? null;
}
