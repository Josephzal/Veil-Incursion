import { FACTION_DEFINITIONS } from '../data/factions';
import { FactionType } from '../types/game';
import { CabalInfluenceBalance, MacroSectorDefinition, MapPoint } from '../types/regional';

const FACTION_ORDER: FactionType[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

const DEFAULT_TINT_OPACITY = 0.35;
const ACTIVE_TINT_OPACITY = 0.48;

export const SECTOR_SELECT_HAPTIC_MS = 12;
export const INACTIVE_SECTOR_LAYER_OPACITY = 0.42;

export function getDominantFaction(influence: CabalInfluenceBalance): FactionType {
  return FACTION_ORDER.reduce((leader, faction) =>
    influence[faction] > influence[leader] ? faction : leader,
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getSectorTintColor(
  influence: CabalInfluenceBalance,
  isActive = false,
): string {
  const dominant = getDominantFaction(influence);
  const accent = FACTION_DEFINITIONS[dominant].accentColor;
  return hexToRgba(accent, isActive ? ACTIVE_TINT_OPACITY : DEFAULT_TINT_OPACITY);
}

export function resolveSectorInfluence(
  sector: MacroSectorDefinition,
  isInfluenceFrozen: boolean,
  frozenInfluence: CabalInfluenceBalance | null,
): CabalInfluenceBalance {
  if (isInfluenceFrozen && frozenInfluence) return frozenInfluence;
  return sector.influence;
}

export function polygonToSkiaPath(polygon: MapPoint[]): string {
  if (polygon.length === 0) return '';
  const [first, ...rest] = polygon;
  const segments = rest.map((point) => `L ${point.x} ${point.y}`).join(' ');
  return `M ${first.x} ${first.y} ${segments} Z`;
}

export function canvasPointToViewBox(
  canvasX: number,
  canvasY: number,
  canvasWidth: number,
  canvasHeight: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
): MapPoint {
  return {
    x: (canvasX / canvasWidth) * viewBoxWidth,
    y: (canvasY / canvasHeight) * viewBoxHeight,
  };
}

/** Inverse of viewport transform: screen → unzoomed canvas → viewBox. */
export function screenPointToViewBox(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
  zoomScale: number,
  translateX: number,
  translateY: number,
): MapPoint {
  const localX = (screenX - translateX) / zoomScale;
  const localY = (screenY - translateY) / zoomScale;
  return canvasPointToViewBox(
    localX,
    localY,
    canvasWidth,
    canvasHeight,
    viewBoxWidth,
    viewBoxHeight,
  );
}

export function viewBoxPointToCanvas(
  point: MapPoint,
  canvasWidth: number,
  canvasHeight: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
): MapPoint {
  return {
    x: (point.x / viewBoxWidth) * canvasWidth,
    y: (point.y / viewBoxHeight) * canvasHeight,
  };
}

export function pointInPolygon(point: MapPoint, polygon: MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function hitTestSectorAtPoint(
  point: MapPoint,
  sectors: MacroSectorDefinition[],
): MacroSectorDefinition | null {
  for (let i = sectors.length - 1; i >= 0; i -= 1) {
    const sector = sectors[i];
    if (pointInPolygon(point, sector.mapGeometry.polygon)) return sector;
  }
  return null;
}
