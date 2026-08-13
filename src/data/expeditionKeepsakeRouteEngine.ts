import type {
  RequisitionAttunement as KeepsakeAttunement,
  RequisitionRouteDoctrine as KeepsakeRouteDoctrine,
} from '../types/expeditionRequisition';
import type { ProceduralNodeType, ProceduralRunTree } from '../types/proceduralRunTree';
import type { NodeContextModifiers } from '../types/worldState';
import { localProceduralDepth } from './proceduralScannerBridge';

export function patchKeepsakeNodeModifiers(
  tree: ProceduralRunTree,
  nodeId: string,
  patch: Partial<NodeContextModifiers>,
): ProceduralRunTree {
  const node = tree.nodes[nodeId];
  if (!node) return tree;
  const base = node.contextModifiers ?? {
    depthStage: 'THRESHOLD',
    nodePressureBand: 'MEDIUM',
  };
  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: {
        ...node,
        contextModifiers: { ...base, ...patch },
      },
    },
  };
}

export function pickFutureKeepsakeNode(
  tree: ProceduralRunTree,
  nodesCleared: number,
  excludeTypes: readonly ProceduralNodeType[] = ['GATEKEEPER', 'EXTRACTION'],
  excludeFlag?: keyof NodeContextModifiers,
): string | null {
  const currentDepth = localProceduralDepth(nodesCleared);
  const candidates = Object.values(tree.nodes).filter((node) => (
    node.depth > currentDepth
    && !excludeTypes.includes(node.type)
    && !(excludeFlag && node.contextModifiers?.[excludeFlag])
  ));
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  return sorted[0]?.id ?? null;
}

export function scoreNodeForAttunement(
  nodeType: ProceduralNodeType,
  modifiers: NodeContextModifiers | null | undefined,
  attunement: KeepsakeAttunement | null,
): number {
  if (!attunement) return 1;
  switch (attunement) {
    case 'HIGH_VALUE_RESOURCE':
      if (modifiers?.highValueResource) return 100;
      if (nodeType === 'RESOURCE') return 60;
      if (modifiers?.keepsakeDeadDrop) return 80;
      return 0;
    case 'ECHO_RESIDUE':
      if (modifiers?.echoSignal) return 100;
      if (nodeType === 'COMBAT' || nodeType === 'ANOMALY') return 40;
      return 0;
    case 'ANCHOR_SIGNAL':
      if (modifiers?.anchorSignal) return 100;
      if (modifiers?.keepsakeHarmonic) return 70;
      return 0;
    case 'EXTRACTION':
      return nodeType === 'EXTRACTION' ? 100 : 0;
    case 'OPERATION_TARGET':
      if (modifiers?.operationTag) return 100;
      if (modifiers?.highRisk && nodeType === 'RESOURCE') return 35;
      return 0;
    default:
      return 0;
  }
}

export function scoreNodeTypeForDoctrine(
  nodeType: ProceduralNodeType,
  modifiers: NodeContextModifiers | null | undefined,
  doctrine: KeepsakeRouteDoctrine | null,
): number {
  if (!doctrine) return 1;
  switch (doctrine) {
    case 'SAFE':
      if (nodeType === 'EXTRACTION' || nodeType === 'SANCTUARY') return 100;
      if (nodeType === 'MARKET') return 40;
      return 10;
    case 'GREED':
      if (modifiers?.highValueResource) return 100;
      if (nodeType === 'RESOURCE' || nodeType === 'ANOMALY') return 80;
      if (modifiers?.highRisk) return 50;
      return 5;
    case 'HUNT':
      if (modifiers?.anchorSignal || modifiers?.echoSignal) return 95;
      if (nodeType === 'ELITE' || nodeType === 'COMBAT') return 90;
      if (modifiers?.operationTag) return 75;
      if (modifiers?.highRisk) return 55;
      return 10;
    default:
      return 1;
  }
}

export function rankNodeIdsByScore(
  candidates: readonly string[],
  tree: ProceduralRunTree,
  scoreFn: (nodeId: string) => number,
): string[] {
  return [...candidates].sort((a, b) => {
    const diff = scoreFn(b) - scoreFn(a);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
}

export function pickAdjacentCorruptionTarget(
  tree: ProceduralRunTree,
  anchorNodeId: string,
): string | null {
  const anchor = tree.nodes[anchorNodeId];
  if (!anchor) return null;
  const siblingIds = new Set<string>();
  Object.values(tree.nodes).forEach((node) => {
    if (node.children.includes(anchorNodeId) || anchor.children.includes(node.id)) {
      siblingIds.add(node.id);
    }
  });
  const candidates = [...siblingIds].filter((id) => {
    const node = tree.nodes[id];
    return node
      && node.type !== 'GATEKEEPER'
      && node.type !== 'EXTRACTION'
      && !node.contextModifiers?.highRisk;
  });
  return candidates.sort((a, b) => a.localeCompare(b))[0] ?? null;
}
