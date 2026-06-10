import type { IncursionNode } from '../types/game';
import type { SectorGraphLayoutPoint } from './sectorGraphLayout';

export const SCOUT_ARENA_WIDTH = 1600;
export const SCOUT_ARENA_HEIGHT = 1400;
const MIN_NODE_SEPARATION = 140;
const ARENA_PADDING = 96;
const MAX_PLACEMENT_ATTEMPTS = 64;

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededUnit(seed: string): number {
  return (hashSeed(seed) % 10000) / 10000;
}

function distance(a: SectorGraphLayoutPoint, b: SectorGraphLayoutPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface ScoutArenaLayout {
  positions: Record<string, SectorGraphLayoutPoint>;
  viewBox: { width: number; height: number };
  anchor: SectorGraphLayoutPoint;
}

/**
 * Scatters active cluster nodes across a large arena so the operative must roam and scan.
 * Positions are deterministic per session key (node depth + cleared count).
 */
export function buildScoutArenaLayout(
  cluster: IncursionNode[],
  anchor: SectorGraphLayoutPoint,
  sessionKey: string,
): ScoutArenaLayout {
  const positions: Record<string, SectorGraphLayoutPoint> = {};
  const placed: SectorGraphLayoutPoint[] = [{ x: anchor.x, y: anchor.y }];

  const minX = anchor.x - SCOUT_ARENA_WIDTH / 2;
  const maxX = anchor.x + SCOUT_ARENA_WIDTH / 2;
  const minY = anchor.y - SCOUT_ARENA_HEIGHT * 0.82;
  const maxY = anchor.y + SCOUT_ARENA_HEIGHT * 0.18;

  cluster.forEach((node, index) => {
    let point = anchor;
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
      const rx = seededUnit(`${sessionKey}:${node.id}:x:${attempt}`);
      const ry = seededUnit(`${sessionKey}:${node.id}:y:${attempt}`);
      const bias = index / Math.max(1, cluster.length - 1);
      const candidate = {
        x: minX + rx * (maxX - minX),
        y: minY + (ry * 0.65 + bias * 0.35) * (maxY - minY),
      };
      if (placed.every((p) => distance(p, candidate) >= MIN_NODE_SEPARATION)) {
        point = candidate;
        break;
      }
      if (attempt === MAX_PLACEMENT_ATTEMPTS - 1) {
        point = candidate;
      }
    }
    positions[node.id] = point;
    placed.push(point);
  });

  const allPoints = Object.values(positions);
  const xs = [...allPoints.map((p) => p.x), anchor.x];
  const ys = [...allPoints.map((p) => p.y), anchor.y];
  const originX = Math.min(...xs) - ARENA_PADDING;
  const originY = Math.min(...ys) - ARENA_PADDING;

  const normalizedPositions: Record<string, SectorGraphLayoutPoint> = {};
  Object.entries(positions).forEach(([id, point]) => {
    normalizedPositions[id] = { x: point.x - originX, y: point.y - originY };
  });
  const normalizedAnchor = { x: anchor.x - originX, y: anchor.y - originY };

  return {
    positions: normalizedPositions,
    anchor: normalizedAnchor,
    viewBox: {
      width: Math.max(...xs) - originX + ARENA_PADDING,
      height: Math.max(...ys) - originY + ARENA_PADDING,
    },
  };
}

export function scoutArenaWorldBounds(
  anchor: SectorGraphLayoutPoint,
  viewBox: { width: number; height: number },
): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: 0,
    maxX: viewBox.width,
    minY: 0,
    maxY: viewBox.height,
  };
}
