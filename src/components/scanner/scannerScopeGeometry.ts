export interface ScopePoint {
  x: number;
  y: number;
}

function point(x: number, y: number): ScopePoint {
  return { x, y };
}

export interface ScopeLine {
  p1: ScopePoint;
  p2: ScopePoint;
  opacity: number;
  strokeWidth?: number;
}

export interface ScopeArc {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  opacity: number;
  rotationDeg?: number;
  spanDeg?: number;
  openGapDeg?: number;
  strokeWidth?: number;
}

/** SVG path for a circular arc span (degrees, SVG y-down). */
export function arcSpanPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  spanDeg: number,
): string {
  const span = Math.max(0.5, Math.min(359.5, spanDeg));
  const start = (startDeg * Math.PI) / 180;
  const end = ((startDeg + span) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(start);
  const y0 = cy + r * Math.sin(start);
  const x1 = cx + r * Math.cos(end);
  const y1 = cy + r * Math.sin(end);
  const large = span > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/**
 * Classic radar scope — concentric range rings + crosshair axes.
 * Presentation only; contact layout / sweep timing unchanged.
 */
export function buildNonEuclideanGrid(
  center: number,
  radius: number,
  strokeBase: number,
): { lines: ScopeLine[]; arcs: ScopeArc[] } {
  const lines: ScopeLine[] = [];
  const arcs: ScopeArc[] = [];

  // Concentric range rings (full circles).
  const rings: Array<{ r: number; op: number; sw: number }> = [
    { r: 0.28, op: 0.22, sw: 0.75 },
    { r: 0.5, op: 0.28, sw: 0.85 },
    { r: 0.72, op: 0.32, sw: 0.9 },
    { r: 0.94, op: 0.48, sw: 1.15 },
  ];
  rings.forEach((ring) => {
    arcs.push({
      cx: center,
      cy: center,
      rx: radius * ring.r,
      ry: radius * ring.r,
      opacity: strokeBase * ring.op,
      strokeWidth: ring.sw,
    });
  });

  // Crosshair axes through the emitter.
  const axisInset = radius * 0.04;
  const axisExtent = radius * 0.96;
  const axisOp = strokeBase * 0.34;
  lines.push(
    {
      p1: point(center - axisExtent, center),
      p2: point(center - axisInset, center),
      opacity: axisOp,
      strokeWidth: 0.85,
    },
    {
      p1: point(center + axisInset, center),
      p2: point(center + axisExtent, center),
      opacity: axisOp,
      strokeWidth: 0.85,
    },
    {
      p1: point(center, center - axisExtent),
      p2: point(center, center - axisInset),
      opacity: axisOp,
      strokeWidth: 0.85,
    },
    {
      p1: point(center, center + axisInset),
      p2: point(center, center + axisExtent),
      opacity: axisOp,
      strokeWidth: 0.85,
    },
  );

  // Quiet 45° diagonals — shorter, lower contrast.
  const diagInner = radius * 0.12;
  const diagOuter = radius * 0.9;
  const diagOp = strokeBase * 0.14;
  for (const deg of [45, 135, 225, 315]) {
    const rad = (deg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    lines.push({
      p1: point(center + diagInner * c, center + diagInner * s),
      p2: point(center + diagOuter * c, center + diagOuter * s),
      opacity: diagOp,
      strokeWidth: 0.7,
    });
  }

  return { lines, arcs };
}

/** Cardinal / intermediate bearing ticks around the rim. */
export function buildDegreeTicks(center: number, radius: number, strokeBase: number): ScopeLine[] {
  const ticks: ScopeLine[] = [];
  for (let deg = 0; deg < 360; deg += 15) {
    const isCardinal = deg % 90 === 0;
    const isMajor = deg % 45 === 0;
    const len = isCardinal ? 0.055 : isMajor ? 0.04 : 0.022;
    const op = isCardinal ? 0.55 : isMajor ? 0.38 : 0.2;
    const rad = (deg * Math.PI) / 180;
    const outer = radius * 0.985;
    const inner = outer - radius * len;
    ticks.push({
      p1: point(center + inner * Math.cos(rad), center + inner * Math.sin(rad)),
      p2: point(center + outer * Math.cos(rad), center + outer * Math.sin(rad)),
      opacity: strokeBase * op,
      strokeWidth: isCardinal ? 1.15 : isMajor ? 0.9 : 0.7,
    });
  }
  return ticks;
}
