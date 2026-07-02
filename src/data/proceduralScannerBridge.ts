import type { ActiveIncursionState, FactionType, IncursionNode, RunNodeType } from '../types/game';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import {
  PROCEDURAL_RUN_MAX_DEPTH,
  type ProceduralNodeType,
  type ProceduralRunNode,
  type ProceduralRunTree,
} from '../types/proceduralRunTree';

const VECTOR_LABELS = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'] as const;

const FACTION_BIOME: Record<FactionType, MacroBiomeFamily> = {
  SOLARIS: 'CITY_BUILDINGS',
  LEGION: 'SANGUINE_ATRIUM',
  TERRAN_GRID: 'CITY_STREETS',
};

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

export function proceduralNodeToIncursionNode(
  node: ProceduralRunNode,
  encounterIndex: number,
): IncursionNode {
  const runType = proceduralTypeToRunType(node.type);
  const labelSuffix = VECTOR_LABELS[encounterIndex % VECTOR_LABELS.length] ?? 'VECTOR';
  return {
    id: node.id,
    encounterIndex,
    index: encounterIndex,
    encounterType: encounterTypeFor(node.type),
    type: runType,
    label: node.type === 'GATEKEEPER'
      ? 'GATEKEEPER'
      : node.type === 'RESOURCE'
        ? 'RESOURCE NODE'
        : `VECTOR ${labelSuffix}`,
    isCompleted: false,
    isPreDiscovered: node.type === 'GATEKEEPER',
    isExtractionNode: node.type === 'EXTRACTION',
    offeredMacroBiome: node.faction ? FACTION_BIOME[node.faction] : undefined,
  };
}

/** Resolve scanner choices for the current tree depth (StS-style). */
export function getAvailableProceduralNodeIds(inc: ActiveIncursionState): string[] {
  const tree = inc.proceduralRunTree;
  if (!tree) return [];

  const currentDepth = Math.min(PROCEDURAL_RUN_MAX_DEPTH, inc.nodesCleared + 1);
  if (currentDepth > PROCEDURAL_RUN_MAX_DEPTH) return [];

  if (inc.nodesCleared === 0) {
    return tree.depthIndex[1] ?? [];
  }

  const lastChosen = inc.encounterPath[inc.nodesCleared - 1];
  if (!lastChosen) {
    return tree.depthIndex[1] ?? [];
  }

  const parent = tree.nodes[lastChosen.id];
  return parent?.children ?? [];
}

export function buildProceduralScannerCluster(inc: ActiveIncursionState): IncursionNode[] {
  const tree = inc.proceduralRunTree;
  if (!tree) return [];

  const ids = getAvailableProceduralNodeIds(inc);
  return ids
    .map((id) => tree.nodes[id])
    .filter((node): node is ProceduralRunNode => node != null)
    .map((node, index) => proceduralNodeToIncursionNode(node, inc.nodesCleared + index));
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
  return inc.proceduralRunTree != null && inc.nodesCleared < PROCEDURAL_RUN_MAX_DEPTH;
}
