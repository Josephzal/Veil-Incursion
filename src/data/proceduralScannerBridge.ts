import type { ActiveIncursionState, IncursionNode, RunNodeType } from '../types/game';
import type { VeilBiome } from '../types/encounterSpawn';
import {
  PROCEDURAL_RUN_MAX_DEPTH,
  type ProceduralNodeType,
  type ProceduralRunNode,
  type ProceduralRunTree,
} from '../types/proceduralRunTree';
import { LEVELS_PER_DISTRICT, MAX_RUN_GRAPH_DEPTH } from '../types/sectorPacing';
import { veilBiomeDisplayName, veilBiomeToLegacyMacroBiome } from './sectorBiomeBridge';
import { assignPendingDepthTypes } from './nodeGenerator';

const VECTOR_LABELS = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'] as const;

function proceduralTypeToRunType(type: ProceduralNodeType): RunNodeType {
  switch (type) {
    case 'COMBAT':
      return 'STANDARD_COMBAT';
    case 'ELITE':
      return 'ELITE_COMBAT';
    case 'ANOMALY':
      return 'ANOMALY';
    case 'MARKET':
      return 'BLACK_MARKET';
    case 'EXTRACTION':
      return 'SAFE_ANCHOR_EXTRACTION';
    case 'SANCTUARY':
      return 'SANCTUARY';
    case 'RESOURCE':
      return 'RESOURCE_HARVEST';
    case 'GATEKEEPER':
      return 'BOSS_COMBAT';
    default:
      return 'STANDARD_COMBAT';
  }
}

function encounterTypeFor(type: ProceduralNodeType): IncursionNode['encounterType'] {
  switch (type) {
    case 'SANCTUARY':
      return 'SANCTUARY';
    case 'ANOMALY':
      return 'ANOMALY';
    case 'MARKET':
      return 'BLACK_MARKET';
    case 'EXTRACTION':
      return 'COMBAT';
    case 'RESOURCE':
      return 'RESOURCE_HARVEST';
    default:
      return 'COMBAT';
  }
}

function vectorLabelPrefix(runVeilBiome: VeilBiome | null | undefined): string {
  if (!runVeilBiome) return '';
  return `${veilBiomeDisplayName(runVeilBiome).toUpperCase()} // `;
}

export function proceduralNodeToIncursionNode(
  node: ProceduralRunNode,
  encounterIndex: number,
  runVeilBiome?: VeilBiome | null,
): IncursionNode {
  const runType = proceduralTypeToRunType(node.type);
  const labelSuffix = VECTOR_LABELS[encounterIndex % VECTOR_LABELS.length] ?? 'VECTOR';
  const signalTags: string[] = [];
  if (node.contextModifiers?.anchorSignal) signalTags.push('ANCHOR');
  if (node.contextModifiers?.operationTag) signalTags.push('OP');
  if (node.contextModifiers?.echoSignal) signalTags.push('ECHO');
  const signalSuffix = signalTags.length > 0 ? ` // ${signalTags.join('+')}` : '';
  const biomePrefix = vectorLabelPrefix(runVeilBiome);

  return {
    id: node.id,
    encounterIndex,
    index: encounterIndex,
    encounterType: encounterTypeFor(node.type),
    type: runType,
    label: node.type === 'GATEKEEPER'
      ? `${biomePrefix}GATEKEEPER${signalSuffix}`
      : node.type === 'RESOURCE'
        ? `${biomePrefix}RESOURCE NODE${signalSuffix}`
        : `${biomePrefix}VECTOR ${labelSuffix}${signalSuffix}`,
    isCompleted: false,
    isPreDiscovered: node.type === 'GATEKEEPER' || node.contextModifiers?.anchorSignal === true,
    isExtractionNode: node.type === 'EXTRACTION',
    offeredMacroBiome: runVeilBiome ? veilBiomeToLegacyMacroBiome(runVeilBiome) : undefined,
    contextModifiers: node.contextModifiers,
  };
}

/** Cleared nodes within the active macro depth (0–14). */
export function localProceduralNodesCleared(nodesCleared: number): number {
  return nodesCleared % LEVELS_PER_DISTRICT;
}

/** Player-facing layer within the active 15-node procedural tree (1–15). */
export function localProceduralDepth(nodesCleared: number): number {
  return localProceduralNodesCleared(nodesCleared) + 1;
}

/** Resolve scanner choices for the current tree depth (StS-style). */
export function getAvailableProceduralNodeIds(inc: ActiveIncursionState): string[] {
  const tree = inc.proceduralRunTree;
  if (!tree) return [];

  const localCleared = localProceduralNodesCleared(inc.nodesCleared);
  const currentDepth = localProceduralDepth(inc.nodesCleared);
  if (currentDepth > PROCEDURAL_RUN_MAX_DEPTH) return [];

  if (localCleared === 0) {
    return tree.depthIndex[1] ?? [];
  }

  const lastChosen = inc.encounterPath[inc.nodesCleared - 1];
  if (!lastChosen) {
    return tree.depthIndex[1] ?? [];
  }

  const parent = tree.nodes[lastChosen.id];
  return parent?.children ?? [];
}

export function prepareProceduralScannerIncursion(
  inc: ActiveIncursionState,
): ActiveIncursionState {
  const tree = inc.proceduralRunTree;
  if (!tree?.rollSeed) return inc;

  const depth = localProceduralDepth(inc.nodesCleared);
  const nextTree = assignPendingDepthTypes(tree, depth, {
    runGenerationContext: inc.runGenerationContext,
    depthIndex: inc.currentDistrict as 1 | 2 | 3,
    cargo: inc.cargo,
  });

  if (nextTree === tree) return inc;
  return { ...inc, proceduralRunTree: nextTree };
}

export function buildProceduralScannerCluster(inc: ActiveIncursionState): IncursionNode[] {
  const tree = inc.proceduralRunTree;
  if (!tree) return [];

  const ids = getAvailableProceduralNodeIds(inc);
  return ids
    .map((id) => tree.nodes[id])
    .filter((node): node is ProceduralRunNode => node != null)
    .map((node, index) => proceduralNodeToIncursionNode(
      node,
      inc.nodesCleared + index,
      inc.runVeilBiome,
    ));
}

export function getSonarChildTypes(
  tree: ProceduralRunTree,
  parentNodeId: string,
): ProceduralNodeType[] {
  const parent = tree.nodes[parentNodeId];
  if (!parent) return [];
  return parent.children
    .map((childId) => tree.nodes[childId]?.type)
    .filter((type): type is ProceduralNodeType => type != null);
}

export function isProceduralRunActive(inc: ActiveIncursionState): boolean {
  return inc.proceduralRunTree != null && inc.nodesCleared < MAX_RUN_GRAPH_DEPTH;
}

export function getProceduralNodeContext(
  inc: ActiveIncursionState,
  nodeId: string,
): ProceduralRunNode['contextModifiers'] | undefined {
  return inc.proceduralRunTree?.nodes[nodeId]?.contextModifiers;
}
