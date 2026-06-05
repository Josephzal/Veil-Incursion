/** Must match VectorSliceOverlay LINE_LENGTH_RATIO. */
export const SLICE_LINE_LENGTH_RATIO = 0.52;

const MIN_ORIENTATION_GAP_DEG = 42;
const NEAR_VERTICAL_BAND: [number, number] = [72, 108];

export interface SliceLineGeometry {
  id: number;
  centerXRatio: number;
  centerYRatio: number;
  angleDeg: number;
}

export interface SliceArenaSize {
  width: number;
  height: number;
}

export interface SliceLineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Undirected line orientation in [0, 180). */
function orientationDeg(deg: number): number {
  return normalizeDeg(deg) % 180;
}

export function orientationSeparationDeg(a: number, b: number): number {
  const da = orientationDeg(a);
  const db = orientationDeg(b);
  const d = Math.abs(da - db);
  return Math.min(d, 180 - d);
}

function isNearVerticalOrientation(deg: number): boolean {
  const o = orientationDeg(deg);
  return o >= NEAR_VERTICAL_BAND[0] && o <= NEAR_VERTICAL_BAND[1];
}

/** Three orientations with wide separation; no back-to-back near-vertical slashes. */
const SLASH_ANGLE_BASES = [22, 98, 158];

export function generateVariedSliceAngles(count = 3): number[] {
  const angles: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = SLASH_ANGLE_BASES[i % SLASH_ANGLE_BASES.length];
    let angle = base + (Math.random() - 0.5) * 16;
    angle = Math.max(14, Math.min(166, angle));
    if (i > 0) {
      const prev = angles[i - 1];
      if (orientationSeparationDeg(prev, angle) < MIN_ORIENTATION_GAP_DEG) {
        angle = normalizeDeg(prev + MIN_ORIENTATION_GAP_DEG + 8);
      }
      if (isNearVerticalOrientation(prev) && isNearVerticalOrientation(angle)) {
        angle = prev < 90 ? 28 : 152;
      }
    }
    angles.push(Math.round(angle));
  }
  return angles;
}

export function sliceHalfLength(arena: SliceArenaSize): number {
  if (arena.width <= 0 || arena.height <= 0) return 0;
  return (Math.min(arena.width, arena.height) * SLICE_LINE_LENGTH_RATIO) / 2;
}

export function getSliceLineSegment(
  line: SliceLineGeometry,
  arena: SliceArenaSize,
): SliceLineSegment | null {
  const half = sliceHalfLength(arena);
  if (half <= 0) return null;
  const cx = arena.width * line.centerXRatio;
  const cy = arena.height * line.centerYRatio;
  const rad = (line.angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad) * half;
  const dy = Math.sin(rad) * half;
  return {
    x1: cx - dx,
    y1: cy - dy,
    x2: cx + dx,
    y2: cy + dy,
  };
}

export interface SwipeHitSliceOptions {
  /** Max perpendicular distance (px) from swipe to slash centerline. */
  maxPerpDistance?: number;
  /** Min fraction of slash length the swipe must span along the line. */
  minAlongLineRatio?: number;
  /** Min swipe length in px. */
  minSwipeLength?: number;
}

const DEFAULT_SWIPE_HIT: Required<SwipeHitSliceOptions> = {
  maxPerpDistance: 44,
  minAlongLineRatio: 0.28,
  minSwipeLength: 24,
};

/**
 * True when the swipe segment follows the slash closely enough (any direction along the line).
 */
export function swipeHitsSliceLine(
  swipeX0: number,
  swipeY0: number,
  swipeX1: number,
  swipeY1: number,
  segment: SliceLineSegment,
  options: SwipeHitSliceOptions = {},
): boolean {
  const { maxPerpDistance, minAlongLineRatio, minSwipeLength } = {
    ...DEFAULT_SWIPE_HIT,
    ...options,
  };

  const lineDx = segment.x2 - segment.x1;
  const lineDy = segment.y2 - segment.y1;
  const lineLen = Math.hypot(lineDx, lineDy);
  if (lineLen < 1) return false;

  const swipeDx = swipeX1 - swipeX0;
  const swipeDy = swipeY1 - swipeY0;
  const swipeLen = Math.hypot(swipeDx, swipeDy);
  if (swipeLen < minSwipeLength) return false;

  const ux = lineDx / lineLen;
  const uy = lineDy / lineLen;
  const midX = (segment.x1 + segment.x2) / 2;
  const midY = (segment.y1 + segment.y2) / 2;

  const perpDist = (px: number, py: number) =>
    Math.abs(-(px - midX) * uy + (py - midY) * ux);

  const along = (px: number, py: number) => (px - midX) * ux + (py - midY) * uy;

  const a0 = along(swipeX0, swipeY0);
  const a1 = along(swipeX1, swipeY1);
  const alongSpan = Math.abs(a1 - a0);
  if (alongSpan < lineLen * minAlongLineRatio) return false;

  const maxPerp = Math.max(
    perpDist(swipeX0, swipeY0),
    perpDist(swipeX1, swipeY1),
    perpDist((swipeX0 + swipeX1) / 2, (swipeY0 + swipeY1) / 2),
  );

  return maxPerp <= maxPerpDistance;
}
