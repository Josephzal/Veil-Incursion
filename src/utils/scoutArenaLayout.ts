import { isDistrictBiomeChoiceCluster } from '../data/descentLevelMatrix';
import type { IncursionNode } from '../types/game';
import type { SectorGraphLayoutPoint } from './sectorGraphLayout';

export const SCOUT_ARENA_WIDTH = 1600;
export const SCOUT_ARENA_HEIGHT = 1400;
const MIN_NODE_SEPARATION = 200;
const ARENA_PADDING = 96;
const SPAWN_BOTTOM_PAD = 72;
const MAX_PLACEMENT_ATTEMPTS = 96;

function distance(a: SectorGraphLayoutPoint, b: SectorGraphLayoutPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface ScoutArenaLayout {
  positions: Record<string, SectorGraphLayoutPoint>;
  viewBox: { width: number; height: number };
  anchor: SectorGraphLayoutPoint;
}

/**
 * Scatters active cluster nodes across a large arena with random placement each roll.
 * Operative spawns at bottom-center; nodes scatter in the upper field.
 */
const NEAR_SPAWN_OFFSETS: SectorGraphLayoutPoint[] = [
  { x: -130, y: -160 },
  { x: 0, y: -200 },
  { x: 130, y: -160 },
];

function buildNearSpawnTestLayout(
  cluster: IncursionNode[],
  anchor: SectorGraphLayoutPoint,
): Record<string, SectorGraphLayoutPoint> {
  const positions: Record<string, SectorGraphLayoutPoint> = {};
  cluster.forEach((node, index) => {
    const offset = NEAR_SPAWN_OFFSETS[index] ?? { x: 0, y: -180 };
    positions[node.id] = {
      x: anchor.x + offset.x,
      y: anchor.y + offset.y,
    };
  });
  return positions;
}

export function buildScoutArenaLayout(
  cluster: IncursionNode[],
  arenaRoll: number,
): ScoutArenaLayout {
  const viewBox = { width: SCOUT_ARENA_WIDTH, height: SCOUT_ARENA_HEIGHT };
  const anchor: SectorGraphLayoutPoint = {
    x: viewBox.width / 2,
    y: viewBox.height - SPAWN_BOTTOM_PAD,
  };

  if (isDistrictBiomeChoiceCluster(cluster)) {
    return {
      positions: buildNearSpawnTestLayout(cluster, anchor),
      anchor,
      viewBox,
    };
  }

  const positions: Record<string, SectorGraphLayoutPoint> = {};
  const placed: SectorGraphLayoutPoint[] = [anchor];

  const minX = ARENA_PADDING;
  const maxX = viewBox.width - ARENA_PADDING;
  const minY = ARENA_PADDING;
  const maxY = viewBox.height - ARENA_PADDING * 2.4;

  const random = () => {
    arenaRoll = (arenaRoll * 9301 + 49297) % 233280;
    return arenaRoll / 233280;
  };

  cluster.forEach((node) => {
    let point = anchor;
    let bestCandidate = anchor;
    let bestMinSep = -1;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
      const candidate = {
        x: minX + random() * (maxX - minX),
        y: minY + random() * (maxY - minY),
      };
      const nearest = Math.min(...placed.map((p) => distance(p, candidate)));
      if (nearest >= MIN_NODE_SEPARATION) {
        point = candidate;
        break;
      }
      if (nearest > bestMinSep) {
        bestMinSep = nearest;
        bestCandidate = candidate;
      }
    }

    if (bestMinSep < MIN_NODE_SEPARATION && bestMinSep >= 0) {
      point = bestCandidate;
    }

    positions[node.id] = point;
    placed.push(point);
  });

  return {
    positions,
    anchor,
    viewBox,
  };
}

export function scoutArenaWorldBounds(
  viewBox: { width: number; height: number },
): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: 0,
    maxX: viewBox.width,
    minY: 0,
    maxY: viewBox.height,
  };
}
