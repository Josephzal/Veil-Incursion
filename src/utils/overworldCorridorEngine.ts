import type { IncursionNode } from '../types/game';
import type { SectorGraph } from '../types/sector';
import type { SectorGraphLayoutPoint } from './sectorGraphLayout';
import type { WorldBounds } from './overworldRadarProjection';

const H_CORRIDOR_PAD = 88;
const V_BACK_PAD = 42;
const V_FORWARD_PAD = 108;
const WALL_BREACH_EXPANSION = 64;

export interface BoundaryWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  side: 'north' | 'south' | 'west' | 'east';
}

export interface CorridorState {
  bounds: WorldBounds;
  walls: BoundaryWall[];
}

function clusterPositions(
  cluster: IncursionNode[],
  positions: Record<string, SectorGraphLayoutPoint>,
): SectorGraphLayoutPoint[] {
  return cluster
    .map((node) => positions[node.id])
    .filter((point): point is SectorGraphLayoutPoint => point != null);
}

export function buildDepthCorridor(
  graph: SectorGraph,
  positions: Record<string, SectorGraphLayoutPoint>,
  currentNodeId: string,
  cluster: IncursionNode[],
  vaporizedWallIds: ReadonlySet<string>,
): CorridorState {
  const anchor = positions[currentNodeId]
    ?? positions[graph.entryId]
    ?? { x: 160, y: 320 };
  const currentDepth = graph.nodes[currentNodeId]?.graphDepth
    ?? graph.nodes[graph.entryId]?.graphDepth
    ?? 0;

  const depthNodes = Object.entries(graph.nodes)
    .filter(([, node]) => node.graphDepth === currentDepth)
    .map(([id]) => positions[id])
    .filter((point): point is SectorGraphLayoutPoint => point != null);

  const forwardNodes = clusterPositions(cluster, positions);
  const sample = [...depthNodes, anchor, ...forwardNodes];
  const xs = sample.map((p) => p.x);
  const ys = sample.map((p) => p.y);

  const minX = Math.min(...xs) - H_CORRIDOR_PAD;
  const maxX = Math.max(...xs) + H_CORRIDOR_PAD;
  const southY = anchor.y + V_BACK_PAD;
  const northY = (forwardNodes.length > 0 ? Math.min(...forwardNodes.map((p) => p.y)) : anchor.y)
    - V_FORWARD_PAD;

  const bounds: WorldBounds = {
    minX,
    maxX,
    minY: northY,
    maxY: southY,
  };

  const walls: BoundaryWall[] = [
    { id: 'wall-north', x1: minX, y1: northY, x2: maxX, y2: northY, side: 'north' },
    { id: 'wall-south', x1: minX, y1: southY, x2: maxX, y2: southY, side: 'south' },
    { id: 'wall-west', x1: minX, y1: northY, x2: minX, y2: southY, side: 'west' },
    { id: 'wall-east', x1: maxX, y1: northY, x2: maxX, y2: southY, side: 'east' },
  ];

  let expandedBounds = bounds;
  walls.forEach((wall) => {
    if (vaporizedWallIds.has(wall.id)) {
      expandedBounds = expandBoundsForVaporizedWall(expandedBounds, wall);
    }
  });

  return { bounds: expandedBounds, walls };
}

export function expandBoundsForVaporizedWall(
  bounds: WorldBounds,
  wall: BoundaryWall,
): WorldBounds {
  switch (wall.side) {
    case 'north':
      return { ...bounds, minY: bounds.minY - WALL_BREACH_EXPANSION };
    case 'south':
      return { ...bounds, maxY: bounds.maxY + WALL_BREACH_EXPANSION };
    case 'west':
      return { ...bounds, minX: bounds.minX - WALL_BREACH_EXPANSION };
    case 'east':
      return { ...bounds, maxX: bounds.maxX + WALL_BREACH_EXPANSION };
    default:
      return bounds;
  }
}

export function rayIntersectWall(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  walls: BoundaryWall[],
  maxDistance = 140,
): BoundaryWall | null {
  const mag = Math.hypot(dirX, dirY);
  if (mag < 0.15) return null;
  const nx = dirX / mag;
  const ny = dirY / mag;
  let closest: BoundaryWall | null = null;
  let closestT = Number.POSITIVE_INFINITY;

  walls.forEach((wall) => {
    const wx = wall.x2 - wall.x1;
    const wy = wall.y2 - wall.y1;
    const denom = wx * ny - wy * nx;
    if (Math.abs(denom) < 0.0001) return;
    const ox = wall.x1 - originX;
    const oy = wall.y1 - originY;
    const t = (ox * wy - oy * wx) / denom;
    const u = (ox * ny - oy * nx) / denom;
    if (t > 0 && t < closestT && t <= maxDistance && u >= 0 && u <= 1) {
      closestT = t;
      closest = wall;
    }
  });

  return closest;
}

export function rayPickHiddenNode(
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  nodes: { id: string; x: number; y: number }[],
  maxDistance = 200,
  coneThreshold = 0.62,
): { id: string; x: number; y: number } | null {
  const mag = Math.hypot(dirX, dirY);
  if (mag < 0.15) return null;
  const nx = dirX / mag;
  const ny = dirY / mag;
  let pick: { id: string; x: number; y: number } | null = null;
  let best = Number.POSITIVE_INFINITY;

  nodes.forEach((node) => {
    const dx = node.x - originX;
    const dy = node.y - originY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxDistance) return;
    const dot = (dx * nx + dy * ny) / distance;
    if (dot < coneThreshold) return;
    if (distance < best) {
      best = distance;
      pick = node;
    }
  });

  return pick;
}

export function positionInFrontOfWalker(
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  offset = 44,
): SectorGraphLayoutPoint {
  const mag = Math.hypot(dirX, dirY);
  if (mag < 0.12) return { x, y: y - offset };
  return {
    x: x + (dirX / mag) * offset,
    y: y + (dirY / mag) * offset,
  };
}
