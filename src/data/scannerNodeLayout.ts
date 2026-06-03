import type { RadarDot } from '../types/run';
import type { SectorDefinition } from '../types/run';

/** Padding from the absolute outer scanner ring (px). */
export const SCANNER_RADIAL_PADDING = 24;

const MIN_NODE_SEPARATION_PX = 40;
const MAX_PLACEMENT_ATTEMPTS = 48;

export interface PolarScanCoordinate {
  x: number;
  y: number;
  angleDeg: number;
}

export function scannerCanvasCenter(scannerSize: number): number {
  return scannerSize / 2;
}

export function scannerMaxRadius(scannerSize: number): number {
  return scannerCanvasCenter(scannerSize) - SCANNER_RADIAL_PADDING;
}

export function bearingFromCanvasCenter(
  scannerSize: number,
  x: number,
  y: number,
): number {
  const center = scannerCanvasCenter(scannerSize);
  const rad = Math.atan2(y - center, x - center);
  return ((rad * 180) / Math.PI + 360) % 360;
}

/**
 * Uniform polar placement across the full scanner disc (not inner core rings).
 * Projects from the true canvas center using independent radius and angle draws.
 */
export function randomPolarScanCoordinate(
  scannerSize: number,
  rng: () => number = Math.random,
): PolarScanCoordinate {
  const center = scannerCanvasCenter(scannerSize);
  const maxRadius = scannerMaxRadius(scannerSize);
  const randomRadius = rng() * maxRadius;
  const randomAngle = rng() * 2 * Math.PI;
  const x = center + randomRadius * Math.cos(randomAngle);
  const y = center + randomRadius * Math.sin(randomAngle);

  return {
    x,
    y,
    angleDeg: bearingFromCanvasCenter(scannerSize, x, y),
  };
}

function distancePx(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function isSeparatedFromPlaced(
  x: number,
  y: number,
  placed: readonly { x: number; y: number }[],
): boolean {
  return placed.every((p) => distancePx(x, y, p.x, p.y) >= MIN_NODE_SEPARATION_PX);
}

/**
 * Assigns canvas-space x/y per route node on each scan session.
 * Coordinates are absolute within the scanner viewport (0 … scannerSize).
 */
export function layoutRadarDotsOnScanner<T extends { id: string }>(
  nodes: T[],
  scannerSize: number,
  buildDot: (node: T, index: number, position: PolarScanCoordinate) => RadarDot,
  rng: () => number = Math.random,
): RadarDot[] {
  const placed: { x: number; y: number }[] = [];

  return nodes.map((node, index) => {
    let position = randomPolarScanCoordinate(scannerSize, rng);
    let attempts = 0;

    while (
      attempts < MAX_PLACEMENT_ATTEMPTS &&
      !isSeparatedFromPlaced(position.x, position.y, placed)
    ) {
      position = randomPolarScanCoordinate(scannerSize, rng);
      attempts += 1;
    }

    placed.push({ x: position.x, y: position.y });
    return buildDot(node, index, position);
  });
}

export type RadarDotLayoutInput = {
  id: string;
  isPreDiscovered?: boolean;
  depthIndex: number;
};

export function createRadarDotFromPolar(
  node: RadarDotLayoutInput,
  index: number,
  position: PolarScanCoordinate,
  sector: SectorDefinition,
  meta: {
    encounterType: RadarDot['encounterType'];
    label: string;
    pingLabel: string;
  },
): RadarDot {
  return {
    id: node.id,
    sector,
    encounterType: meta.encounterType,
    label: meta.label,
    pingIndex: index + 1,
    pingLabel: meta.pingLabel,
    x: position.x,
    y: position.y,
    angleDeg: position.angleDeg,
    isPreDiscovered: node.isPreDiscovered,
    depthIndex: node.depthIndex,
  };
}
