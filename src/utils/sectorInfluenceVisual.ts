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

/** Inverse of preview viewport transform (top-left scale + translate). */
export function screenPointToViewBoxPreview(
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

/** Inverse of expanded viewport transform (top-left scale + translate + contain layout). */
export function screenPointToViewBoxExpanded(
  screenX: number,
  screenY: number,
  zoomScale: number,
  translateX: number,
  translateY: number,
  metrics: MapDrawMetrics,
): MapPoint {
  const localX = (screenX - translateX) / zoomScale;
  const localY = (screenY - translateY) / zoomScale;
  return {
    x: (localX - metrics.offsetX) / metrics.scale,
    y: (localY - metrics.offsetY) / metrics.scale,
  };
}

/** Keep focal screen point fixed under top-left scale + translate. */
export function focalPinchTranslationPreview(
  focal: number,
  savedTranslate: number,
  savedScale: number,
  nextScale: number,
): number {
  'worklet';
  const scaleRatio = nextScale / savedScale;
  return savedTranslate + (focal - savedTranslate) * (1 - scaleRatio);
}

export function clampPreviewMapTranslation(
  translateX: number,
  translateY: number,
  zoomScale: number,
  width: number,
  height: number,
): { x: number; y: number } {
  'worklet';
  if (zoomScale <= 1) {
    return { x: 0, y: 0 };
  }
  const minX = width * (1 - zoomScale);
  const maxX = 0;
  const minY = height * (1 - zoomScale);
  const maxY = 0;
  return {
    x: Math.min(maxX, Math.max(minX, translateX)),
    y: Math.min(maxY, Math.max(minY, translateY)),
  };
}

export function clampExpandedMapTranslation(
  translateX: number,
  translateY: number,
  zoomScale: number,
  width: number,
  height: number,
  contentLeft: number,
  contentTop: number,
  contentRight: number,
  contentBottom: number,
): { x: number; y: number } {
  'worklet';
  if (zoomScale <= 1) {
    return { x: 0, y: 0 };
  }
  const boundX1 = -zoomScale * contentLeft;
  const boundX2 = width - zoomScale * contentRight;
  const boundY1 = -zoomScale * contentTop;
  const boundY2 = height - zoomScale * contentBottom;
  const minX = Math.min(boundX1, boundX2);
  const maxX = Math.max(boundX1, boundX2);
  const minY = Math.min(boundY1, boundY2);
  const maxY = Math.max(boundY1, boundY2);
  return {
    x: Math.min(maxX, Math.max(minX, translateX)),
    y: Math.min(maxY, Math.max(minY, translateY)),
  };
}

export interface MapDrawMetrics {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function resolveMapDrawMetrics(
  canvasWidth: number,
  canvasHeight: number,
  viewBoxWidth: number,
  viewBoxHeight: number,
  mode: 'contain' | 'cover',
): MapDrawMetrics {
  const scaleX = canvasWidth / viewBoxWidth;
  const scaleY = canvasHeight / viewBoxHeight;
  const scale = mode === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  const drawnWidth = viewBoxWidth * scale;
  const drawnHeight = viewBoxHeight * scale;
  return {
    scale,
    offsetX: (canvasWidth - drawnWidth) / 2,
    offsetY: (canvasHeight - drawnHeight) / 2,
  };
}

export function viewBoxPointToCanvas(point: MapPoint, metrics: MapDrawMetrics): MapPoint {
  return {
    x: metrics.offsetX + point.x * metrics.scale,
    y: metrics.offsetY + point.y * metrics.scale,
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

function polygonCentroid(polygon: MapPoint[]): MapPoint {
  let sumX = 0;
  let sumY = 0;
  polygon.forEach((vertex) => {
    sumX += vertex.x;
    sumY += vertex.y;
  });
  return { x: sumX / polygon.length, y: sumY / polygon.length };
}

function distanceBetween(a: MapPoint, b: MapPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const SECTOR_HIT_SLOP_VIEWBOX = 110;

export function hitTestSectorAtPoint(
  point: MapPoint,
  sectors: MacroSectorDefinition[],
): MacroSectorDefinition | null {
  for (let i = sectors.length - 1; i >= 0; i -= 1) {
    const sector = sectors[i];
    if (pointInPolygon(point, sector.mapGeometry.polygon)) return sector;
  }

  let nearest: MacroSectorDefinition | null = null;
  let nearestDistance = SECTOR_HIT_SLOP_VIEWBOX;
  sectors.forEach((sector) => {
    const centroid = polygonCentroid(sector.mapGeometry.polygon);
    const dist = distanceBetween(point, centroid);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearest = sector;
    }
  });

  return nearest;
}
