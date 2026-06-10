import type { SectorGraphLayoutPoint } from './sectorGraphLayout';

export const TERMINAL_GREEN = '#00ff33';
export const SLATE_BLACK = '#090d16';

export const PROXIMITY_LOCK_ON = 72;
export const PROXIMITY_INTERCEPT = 170;

export type ProximityTier = 'FAR' | 'INTERCEPT' | 'LOCK_ON';

export type AegisFacing = 'left' | 'right' | 'forward' | 'back';

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export function layoutDistance(
  a: SectorGraphLayoutPoint,
  b: SectorGraphLayoutPoint,
): number {
  'worklet';
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function resolveProximityTier(distance: number): ProximityTier {
  if (distance <= PROXIMITY_LOCK_ON) return 'LOCK_ON';
  if (distance <= PROXIMITY_INTERCEPT) return 'INTERCEPT';
  return 'FAR';
}

export function resolveMovementFacing(dx: number, dy: number): AegisFacing {
  if (Math.hypot(dx, dy) < 0.12) return 'back';
  if (Math.abs(dx) >= Math.abs(dy) * 0.85) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy < 0 ? 'back' : 'forward';
}

export function clampToWorldBounds(
  x: number,
  y: number,
  bounds: WorldBounds,
): SectorGraphLayoutPoint {
  'worklet';
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
  };
}

export function worldToScreen(
  world: SectorGraphLayoutPoint,
  playerWorld: SectorGraphLayoutPoint,
  canvasWidth: number,
  canvasHeight: number,
  worldScale: number,
): ScreenPoint {
  'worklet';
  return {
    x: canvasWidth / 2 + (world.x - playerWorld.x) * worldScale,
    y: canvasHeight / 2 + (world.y - playerWorld.y) * worldScale,
  };
}

export function buildWorldBounds(
  positions: Record<string, SectorGraphLayoutPoint>,
  padding = 40,
): WorldBounds {
  const points = Object.values(positions);
  if (points.length === 0) {
    return { minX: 0, maxX: 320, minY: 0, maxY: 400 };
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs) - padding,
    maxX: Math.max(...xs) + padding,
    minY: Math.min(...ys) - padding,
    maxY: Math.max(...ys) + padding,
  };
}

export function formatGhostHexAddress(nodeId: string): string {
  const seed = nodeId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const a = (seed % 256).toString(16).toUpperCase().padStart(2, '0');
  const b = ((seed >> 3) % 256).toString(16).toUpperCase().padStart(2, '0');
  return `ERR_NODE // 0x${a}??${b}`;
}

export function formatInterceptReadout(distance: number, glyph: string): string {
  const meters = Math.round(distance * 2.4);
  const sig = glyph === '⚔' || glyph === '☠' ? 'ANOMALY' : glyph === '◎' ? 'ANCHOR' : 'SIGNAL';
  return `DIST: ${meters}m // SIG: ${sig}`;
}
