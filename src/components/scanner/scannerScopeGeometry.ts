import { vec, type SkPoint } from '@shopify/react-native-skia';

export interface ScopeLine {
  p1: SkPoint;
  p2: SkPoint;
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
}

export function buildNonEuclideanGrid(
  center: number,
  radius: number,
  strokeBase: number,
): { lines: ScopeLine[]; arcs: ScopeArc[] } {
  const lines: ScopeLine[] = [];
  const arcs: ScopeArc[] = [];

  for (let deg = 0; deg < 360; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    const isMajor = deg % 45 === 0;
    lines.push({
      p1: vec(center, center),
      p2: vec(center + radius * Math.cos(rad), center + radius * Math.sin(rad)),
      opacity: isMajor ? strokeBase * 1.35 : strokeBase * 0.55,
      strokeWidth: isMajor ? 1 : 0.5,
    });
  }

  for (let ring = 1; ring <= 5; ring += 1) {
    const t = ring / 5;
    const r = radius * t;
    arcs.push({
      cx: center,
      cy: center,
      rx: r,
      ry: r * (0.62 + (ring % 2) * 0.12),
      opacity: strokeBase * (0.35 + (1 - t) * 0.15),
      rotationDeg: ring * 11.25,
    });
  }

  const skewAngles = [22.5, 67.5, 112.5, 157.5];
  const step = radius / 4.5;
  skewAngles.forEach((angleDeg, layerIndex) => {
    const rad = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const px = -dy;
    const py = dx;
    for (let i = -4; i <= 4; i += 1) {
      const offset = i * step;
      const half = radius;
      lines.push({
        p1: vec(center + px * offset - dx * half, center + py * offset - dy * half),
        p2: vec(center + px * offset + dx * half, center + py * offset + dy * half),
        opacity: strokeBase * (0.28 + layerIndex * 0.04),
        strokeWidth: 0.5,
      });
    }
  });

  const warpAngles = [0, 60, 120];
  warpAngles.forEach((baseDeg) => {
    for (let k = -2; k <= 2; k += 1) {
      const warpR = radius * (0.35 + Math.abs(k) * 0.18);
      const start = ((baseDeg + k * 18) * Math.PI) / 180;
      const end = start + Math.PI * 0.55;
      const segments = 8;
      for (let s = 0; s < segments; s += 1) {
        const t0 = s / segments;
        const t1 = (s + 1) / segments;
        const a0 = start + (end - start) * t0;
        const a1 = start + (end - start) * t1;
        const bulge = 1 + Math.sin(t0 * Math.PI) * 0.14;
        lines.push({
          p1: vec(center + warpR * bulge * Math.cos(a0), center + warpR * bulge * Math.sin(a0)),
          p2: vec(center + warpR * bulge * Math.cos(a1), center + warpR * bulge * Math.sin(a1)),
          opacity: strokeBase * 0.32,
          strokeWidth: 0.5,
        });
      }
    }
  });

  return { lines, arcs };
}

export function buildDegreeTicks(center: number, radius: number, strokeBase: number): ScopeLine[] {
  const ticks: ScopeLine[] = [];
  for (let deg = 0; deg < 360; deg += 10) {
    const rad = (deg * Math.PI) / 180;
    const outer = radius * 0.98;
    const inner = radius * (deg % 30 === 0 ? 0.9 : 0.94);
    ticks.push({
      p1: vec(center + inner * Math.cos(rad), center + inner * Math.sin(rad)),
      p2: vec(center + outer * Math.cos(rad), center + outer * Math.sin(rad)),
      opacity: deg % 30 === 0 ? strokeBase * 1.1 : strokeBase * 0.45,
      strokeWidth: deg % 30 === 0 ? 1 : 0.5,
    });
  }
  return ticks;
}
