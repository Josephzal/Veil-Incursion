import type { EchoEncounterKind, ProceduralEchoOverlay } from '../types/echoEncounter';
import { ECHO_SIGNAL_DISPLAY_LABELS } from '../types/echoEncounter';
import type { ProceduralNodeType, ProceduralRunNode, ProceduralRunTree } from '../types/proceduralRunTree';
import type {
  NodeContextModifiers,
  NodeModifierRollState,
  RunGenerationContext,
} from '../types/worldState';
import {
  ECHO_SIGNAL_CHANCE,
  getDepthStage,
  getNodePressureBand,
  MAX_ECHO_SIGNALS_PER_DEPTH,
  MAX_LEGENDARY_ECHO_ENCOUNTERS_PER_RUN,
  resolveMaxEchoEncountersPerRun,
} from './worldStateHelpers';
import { getAnchorDefinition } from './anchorRegistry';
import { applyBriefOverlayToRoll } from './runWorldBriefBiasEngine';
import { pickEchoTemplateForNode } from './echoRecoveryEngine';
import { buildEchoEncounterKindWeights, pickEchoEncounterKind } from './echoEncounterKindEngine';
import { seededRandom } from './encounterGenerator';
import { devApplyForcedEchoOverlay } from './echoDebugEngine';

const ECHO_OVERLAY_NODE_TYPES: readonly ProceduralNodeType[] = [
  'COMBAT',
  'ELITE',
  'ANOMALY',
  'RESOURCE',
  'EXTRACTION',
];

export function isEchoOverlayNodeTypeEligible(nodeType: ProceduralNodeType): boolean {
  return ECHO_OVERLAY_NODE_TYPES.includes(nodeType);
}

function pressureMultiplier(band: ReturnType<typeof getNodePressureBand>): number {
  if (band === 'LOW') return 0.65;
  if (band === 'MEDIUM') return 1;
  return 1.35;
}

export function pickEchoSignalLabel(seed: string): string {
  const rand = seededRandom(`echo-label:${seed}`);
  const index = Math.floor(rand() * ECHO_SIGNAL_DISPLAY_LABELS.length);
  return ECHO_SIGNAL_DISPLAY_LABELS[index] ?? 'ECHO SIGNAL';
}

export function createEchoOverlay(seed: string): ProceduralEchoOverlay {
  return {
    echoSignal: true,
    echoSignalLabel: pickEchoSignalLabel(seed),
  };
}

export function resolveEchoSignalRollChance(
  proceduralDepth: number,
  nodeType: ProceduralNodeType,
  depthIndex: 1 | 2 | 3,
  runContext: RunGenerationContext,
  depthIdentityBias?: import('../types/depthIdentity').DepthIdentityScanBias | null,
): number {
  const depthStage = getDepthStage(depthIndex);
  const pressureBand = getNodePressureBand(proceduralDepth);
  const pressureScale = pressureMultiplier(pressureBand);
  const echoActivity = runContext.sectorState.echoActivity;
  const scannerBias = runContext.scannerSignalBias;
  const anchorType = runContext.activeAnchor?.type ?? null;
  const anchorDef = anchorType ? getAnchorDefinition(anchorType) : null;

  let echoBase = ECHO_SIGNAL_CHANCE[echoActivity][depthStage]
    * pressureScale
    * scannerBias.echoSignalMultiplier
    * (anchorDef?.signalRollModifiers.echoSignalChance ?? 1);

  if (depthIdentityBias) {
    echoBase *= depthIdentityBias.echoSignalMultiplier;
  }

  if (runContext.activeOperation.objectiveKind === 'ECHO_RECOVERY') {
    echoBase *= 1.85;
  }

  if (nodeType === 'ELITE' || nodeType === 'COMBAT') {
    echoBase *= 1.2;
  } else if (nodeType === 'RESOURCE') {
    if (anchorType === 'LEY_NEXUS') echoBase *= 1.35;
  } else if (nodeType === 'EXTRACTION') {
    echoBase *= 0.35;
  }

  const brief = runContext.runWorldBrief;
  if (brief) {
    echoBase = applyBriefOverlayToRoll(echoBase, 'echoSignal', brief.scannerBias);
  }

  return Math.min(0.85, echoBase);
}

export function canPlaceEchoOverlay(
  rollState: NodeModifierRollState,
  proceduralDepth: number,
  isEchoRecoveryOperation: boolean,
): boolean {
  const maxPerRun = resolveMaxEchoEncountersPerRun(isEchoRecoveryOperation);
  if (rollState.echoSignalsUsed >= maxPerRun) return false;
  const depthCount = rollState.echoSignalsByDepth[proceduralDepth] ?? 0;
  if (depthCount >= MAX_ECHO_SIGNALS_PER_DEPTH) return false;
  return true;
}

export function recordEchoOverlayPlacement(
  rollState: NodeModifierRollState,
  proceduralDepth: number,
): void {
  rollState.echoSignalsUsed += 1;
  rollState.echoSignalsByDepth[proceduralDepth] =
    (rollState.echoSignalsByDepth[proceduralDepth] ?? 0) + 1;
}

function hashEchoOverlaySeed(treeSeed: number, depth: number, nodeId: string): number {
  let hash = (treeSeed + depth * 991) >>> 0;
  for (let i = 0; i < nodeId.length; i += 1) {
    hash = (hash * 37 + nodeId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export interface EchoOverlayAssignmentParams {
  runGenerationContext?: RunGenerationContext | null;
  depthIndex?: 1 | 2 | 3;
  depthIdentityBias?: import('../types/depthIdentity').DepthIdentityScanBias | null;
}

/** Roll echo scanner overlays for nodes at a procedural depth (layer unlock). */
export function assignEchoOverlaysForDepth(
  tree: ProceduralRunTree,
  depth: number,
  params: EchoOverlayAssignmentParams,
): ProceduralRunTree {
  if (tree.rollSeed == null || tree.modifierRollState == null) return tree;
  const runContext = params.runGenerationContext;
  if (!runContext) return tree;

  const depthIndex = params.depthIndex ?? tree.macroDepthIndex ?? 1;
  const isEchoRecoveryOp = runContext.activeOperation.objectiveKind === 'ECHO_RECOVERY';
  const layerIds = tree.depthIndex[depth] ?? [];
  if (layerIds.length === 0) return tree;

  const rollState: NodeModifierRollState = {
    echoSignalsUsed: tree.modifierRollState.echoSignalsUsed,
    legendaryEchoUsed: tree.modifierRollState.legendaryEchoUsed,
    echoSignalsByDepth: { ...tree.modifierRollState.echoSignalsByDepth },
  };

  const nodes = { ...tree.nodes };
  let changed = false;

  layerIds.forEach((nodeId) => {
    const node = nodes[nodeId];
    if (!node || node.echoOverlay || node.contextModifiers?.echoSignal) return;
    if (!isEchoOverlayNodeTypeEligible(node.type)) return;
    if (!canPlaceEchoOverlay(rollState, depth, isEchoRecoveryOp)) return;

    const rng = mulberry32(hashEchoOverlaySeed(tree.rollSeed!, depth, nodeId));
    const chance = resolveEchoSignalRollChance(
      depth,
      node.type,
      depthIndex,
      runContext,
      params.depthIdentityBias,
    );
    if (rng() >= chance) return;

    recordEchoOverlayPlacement(rollState, depth);
    nodes[nodeId] = {
      ...node,
      echoOverlay: createEchoOverlay(`${depth}:${nodeId}:${rollState.echoSignalsUsed}`),
    };
    changed = true;
  });

  if (!changed && typeof __DEV__ !== 'undefined' && __DEV__) {
    return devApplyForcedEchoOverlay(tree, depth, isEchoRecoveryOp);
  }

  if (!changed) return tree;

  return {
    ...tree,
    nodes,
    modifierRollState: rollState,
  };
}

/** Merge scanner echo overlay into display/engage context. */
export function mergeEchoOverlayIntoModifiers(
  modifiers: NodeContextModifiers,
  overlay: ProceduralEchoOverlay | undefined,
): NodeContextModifiers {
  if (!overlay) return modifiers;
  return {
    ...modifiers,
    echoSignal: true,
    echoSignalLabel: overlay.echoSignalLabel,
  };
}

/** Build scanner context from procedural node before full engagement roll. */
export function resolveDisplayContextModifiers(
  node: ProceduralRunNode,
  depthIndex: 1 | 2 | 3,
): NodeContextModifiers | undefined {
  if (node.contextModifiers) {
    if (node.echoOverlay && !node.contextModifiers.echoSignal) {
      return mergeEchoOverlayIntoModifiers(node.contextModifiers, node.echoOverlay);
    }
    return node.contextModifiers;
  }

  if (!node.echoOverlay) return undefined;

  return {
    depthStage: getDepthStage(depthIndex),
    nodePressureBand: getNodePressureBand(node.depth),
    echoSignal: true,
    echoSignalLabel: node.echoOverlay.echoSignalLabel,
  };
}

/**
 * Weight encounter kind at breach, then attach hostile template when applicable.
 */
export function resolveEchoEncounterAtEngagement(
  modifiers: NodeContextModifiers,
  depthIndex: 1 | 2 | 3,
  nodeType: ProceduralNodeType,
  runContext: RunGenerationContext | null | undefined,
  resolutionSeed: string,
  rollState: NodeModifierRollState,
): NodeContextModifiers {
  if (!modifiers.echoSignal) return modifiers;

  const depthStage = modifiers.depthStage ?? getDepthStage(depthIndex);
  const weights = runContext
    ? buildEchoEncounterKindWeights(depthIndex, nodeType, runContext, modifiers)
    : [{ kind: 'HOSTILE_ECHO' as const, weight: 1 }];
  const kind = pickEchoEncounterKind(weights, resolutionSeed);

  const snapshot = {
    echoRarity: kind === 'HOSTILE_ECHO' && depthIndex === 3 ? 'CORRUPTED' as const : 'COMMON' as const,
    sourceClass: pickAuthoredEchoClass(resolutionSeed),
  };

  if (kind !== 'HOSTILE_ECHO') {
    return {
      ...modifiers,
      echoEncounterKind: kind,
      echoSnapshot: snapshot,
    };
  }

  const allowLegendary =
    depthIndex >= 3
    && rollState.legendaryEchoUsed < MAX_LEGENDARY_ECHO_ENCOUNTERS_PER_RUN;
  const template = pickEchoTemplateForNode(
    depthIndex,
    depthStage,
    resolutionSeed,
    allowLegendary,
    snapshot.sourceClass,
  );

  if (!template) {
    return {
      ...modifiers,
      echoEncounterKind: kind,
      echoSnapshot: snapshot,
    };
  }

  if (template.tier === 'LEGENDARY') {
    rollState.legendaryEchoUsed += 1;
  }

  const alignedSnapshot = template.isClassEcho && template.sourceClass
    ? { ...snapshot, sourceClass: template.sourceClass }
    : snapshot;

  return {
    ...modifiers,
    echoEncounterKind: kind,
    echoTemplateId: template.id,
    echoTier: template.tier,
    echoSnapshot: alignedSnapshot,
  };
}

function pickAuthoredEchoClass(
  seed: string,
): import('../types/game').ClassType {
  const classes: import('../types/game').ClassType[] = ['AEGIS', 'HEX_SHOT', 'ENVOY'];
  const rand = seededRandom(`echo-class:${seed}`);
  return classes[Math.floor(rand() * classes.length)] ?? 'AEGIS';
}

export function formatEchoSignalEngageLog(label: string): string {
  return `>> ${label.toUpperCase()} — residual runner imprint detected.`;
}

export function formatEchoEncounterKindLog(kind: EchoEncounterKind): string {
  switch (kind) {
    case 'HOSTILE_ECHO':
      return '>> ECHO RESOLUTION — hostile memory-shadow engaging.';
    case 'FALLEN_RUNNER_ECHO':
      return '>> ECHO RESOLUTION — fallen runner imprint found.';
    case 'ASSIST_ECHO':
      return '>> ECHO RESOLUTION — benevolent runner trace detected.';
    case 'CARGO_ECHO':
      return '>> ECHO RESOLUTION — jettisoned cargo signature found.';
    case 'EXTRACTION_ECHO':
      return '>> ECHO RESOLUTION — prior extraction route trace found.';
    default:
      return '>> ECHO RESOLUTION — imprint stabilizing.';
  }
}
