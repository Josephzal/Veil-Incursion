import type { IncursionNode } from '../types/game';
import type { SectorGraph } from '../types/sector';

export interface SectorGraphLayoutPoint {
  x: number;
  y: number;
}

export interface SectorGraphLayoutEdge {
  fromId: string;
  toId: string;
}

export interface SectorGraphLayout {
  viewBox: { width: number; height: number };
  positions: Record<string, SectorGraphLayoutPoint>;
  edges: SectorGraphLayoutEdge[];
}

const LAYER_GAP = 72;
const NODE_GAP = 56;
const PADDING_X = 48;
const PADDING_Y = 40;
const EPHEMERAL_FAN_Y = 36;
const EPHEMERAL_FAN_X = 52;

export type AegisFacing = 'left' | 'right' | 'forward' | 'back';

export function resolveAegisFacing(
  from: SectorGraphLayoutPoint,
  to: SectorGraphLayoutPoint,
): AegisFacing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Climb runs upward on screen — deeper nodes sit above the operative.
  if (Math.abs(dy) >= Math.abs(dx) * 0.85) {
    return dy < 0 ? 'back' : 'forward';
  }
  return dx > 0 ? 'right' : 'left';
}

function assignTreeLayout(
  graph: SectorGraph,
  nodeId: string,
  depthSlots: Map<number, number>,
  positions: Record<string, SectorGraphLayoutPoint>,
): number {
  const node = graph.nodes[nodeId];
  if (!node) return 0;

  const openChildren = node.childIds.filter((id) => graph.nodes[id]);
  if (openChildren.length === 0) {
    const slot = depthSlots.get(node.graphDepth) ?? 0;
    depthSlots.set(node.graphDepth, slot + 1);
    positions[nodeId] = { x: slot * NODE_GAP, y: node.graphDepth * LAYER_GAP };
    return slot;
  }

  const childSlots = openChildren.map((childId) =>
    assignTreeLayout(graph, childId, depthSlots, positions),
  );
  const xSlot = (Math.min(...childSlots) + Math.max(...childSlots)) / 2;
  positions[nodeId] = { x: xSlot * NODE_GAP, y: node.graphDepth * LAYER_GAP };
  return xSlot;
}

export function projectSectorGraphLayout(graph: SectorGraph): SectorGraphLayout {
  const positions: Record<string, SectorGraphLayoutPoint> = {};
  const edges: SectorGraphLayoutEdge[] = [];

  if (!graph.entryId || !graph.nodes[graph.entryId]) {
    return { viewBox: { width: 320, height: 400 }, positions, edges };
  }

  const depthSlots = new Map<number, number>();
  assignTreeLayout(graph, graph.entryId, depthSlots, positions);

  Object.values(graph.nodes).forEach((node) => {
    node.childIds.forEach((childId) => {
      if (graph.nodes[childId]) {
        edges.push({ fromId: node.id, toId: childId });
      }
    });
  });

  const allPoints = Object.values(positions);
  const minX = Math.min(...allPoints.map((p) => p.x));
  const maxX = Math.max(...allPoints.map((p) => p.x));
  const maxY = Math.max(...allPoints.map((p) => p.y));

  const layoutHeight = maxY + PADDING_Y * 2 + LAYER_GAP;
  const normalized: Record<string, SectorGraphLayoutPoint> = {};
  Object.entries(positions).forEach(([id, point]) => {
    const rawY = point.y + PADDING_Y;
    normalized[id] = {
      x: point.x - minX + PADDING_X,
      y: layoutHeight - rawY,
    };
  });

  return {
    viewBox: {
      width: maxX - minX + PADDING_X * 2 + NODE_GAP,
      height: layoutHeight,
    },
    positions: normalized,
    edges,
  };
}

/** Ephemeral cluster-only nodes (safe anchor, master link, etc.) fan below the active step. */
export function projectClusterEphemerals(
  cluster: IncursionNode[],
  graph: SectorGraph,
  baseLayout: SectorGraphLayout,
  currentNodeId: string,
): Record<string, SectorGraphLayoutPoint> {
  const ephemerals: Record<string, SectorGraphLayoutPoint> = {};
  const anchor = baseLayout.positions[currentNodeId]
    ?? baseLayout.positions[graph.entryId]
    ?? { x: baseLayout.viewBox.width / 2, y: baseLayout.viewBox.height - PADDING_Y };

  const synthetic = cluster.filter((node) => !graph.nodes[node.id]);
  const count = synthetic.length;
  synthetic.forEach((node, index) => {
    const offsetIndex = index - (count - 1) / 2;
    ephemerals[node.id] = {
      x: anchor.x + offsetIndex * EPHEMERAL_FAN_X,
      y: anchor.y - EPHEMERAL_FAN_Y,
    };
  });

  return ephemerals;
}

export function mergeLayoutPositions(
  base: Record<string, SectorGraphLayoutPoint>,
  extra: Record<string, SectorGraphLayoutPoint>,
): Record<string, SectorGraphLayoutPoint> {
  return { ...base, ...extra };
}
