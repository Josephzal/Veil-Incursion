import type { HarvestFloorBounds } from '../types/residueParticle';

export interface ScatterRect {
  width: number;
  height: number;
}

export interface ScatterPose {
  /** Top-left X within the scatter floor. */
  left: number;
  /** Top-left Y within the scatter floor. */
  top: number;
}

/** Axis-aligned exclusion region in local scatter-floor coordinates. */
export interface ScatterExcludeZone {
  left: number;
  top: number;
  width: number;
  height: number;
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function rectsOverlap(
  aLeft: number,
  aTop: number,
  aWidth: number,
  aHeight: number,
  zone: ScatterExcludeZone,
): boolean {
  return !(
    aLeft + aWidth <= zone.left
    || aLeft >= zone.left + zone.width
    || aTop + aHeight <= zone.top
    || aTop >= zone.top + zone.height
  );
}

export function poseOverlapsExcludeZone(
  pose: ScatterPose,
  size: ScatterRect,
  zone: ScatterExcludeZone,
): boolean {
  return rectsOverlap(pose.left, pose.top, size.width, size.height, zone);
}

/** Shrink floor so particles/sprites stay fully inside (accounts for half-size overhang). */
export function insetHarvestFloor(
  floor: HarvestFloorBounds,
  inset: number,
): HarvestFloorBounds {
  const pad = Math.max(0, inset);
  const xMin = floor.xMin + pad;
  const xMax = floor.xMax - pad;
  const yMin = floor.yMin + pad;
  const yMax = floor.yMax - pad;
  if (xMax <= xMin || yMax <= yMin) {
    const cx = (floor.xMin + floor.xMax) / 2;
    const cy = (floor.yMin + floor.yMax) / 2;
    return { xMin: cx, xMax: cx, yMin: cy, yMax: cy };
  }
  return { xMin, xMax, yMin, yMax };
}

/**
 * Soft anti-overlap: centers must stay far enough apart that one sprite
 * cannot fully cover another, but partial overlap is allowed.
 */
export function softMinSeparation(
  a: ScatterRect,
  b: ScatterRect,
): number {
  const aMin = Math.min(a.width, a.height);
  const bMin = Math.min(b.width, b.height);
  return (aMin + bMin) * 0.42;
}

function centersTooClose(
  ax: number,
  ay: number,
  a: ScatterRect,
  bx: number,
  by: number,
  b: ScatterRect,
): boolean {
  const minDist = softMinSeparation(a, b);
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < minDist * minDist;
}

/**
 * Scatter rects randomly inside a local floor (0..width × 0..height).
 * Tries to keep soft separation so items are not completely stacked.
 */
export function scatterRectsInBounds(
  floor: ScatterRect,
  items: ReadonlyArray<{ id: string; size: ScatterRect }>,
  options?: {
    padding?: number;
    maxAttempts?: number;
    existing?: ReadonlyMap<string, ScatterPose>;
    /** Hard keep-out regions (e.g. extractor dock). */
    excludeZones?: ReadonlyArray<ScatterExcludeZone>;
  },
): Map<string, ScatterPose> {
  const padding = Math.max(0, options?.padding ?? 8);
  const maxAttempts = options?.maxAttempts ?? 48;
  const excludeZones = options?.excludeZones ?? [];
  const next = new Map<string, ScatterPose>(options?.existing ?? []);

  const overlapsAnyExclude = (pose: ScatterPose, size: ScatterRect): boolean => (
    excludeZones.some((zone) => poseOverlapsExcludeZone(pose, size, zone))
  );

  const placed: Array<{ id: string; cx: number; cy: number; size: ScatterRect }> = [];
  for (const [id, pose] of next) {
    const match = items.find((item) => item.id === id);
    if (!match) continue;
    if (overlapsAnyExclude(pose, match.size)) {
      next.delete(id);
      continue;
    }
    placed.push({
      id,
      cx: pose.left + match.size.width / 2,
      cy: pose.top + match.size.height / 2,
      size: match.size,
    });
  }

  for (const item of items) {
    if (next.has(item.id)) continue;

    const maxLeft = Math.max(padding, floor.width - item.size.width - padding);
    const maxTop = Math.max(padding, floor.height - item.size.height - padding);
    const minLeft = Math.min(padding, maxLeft);
    const minTop = Math.min(padding, maxTop);

    let best: ScatterPose | null = null;
    let bestPenalty = Number.POSITIVE_INFINITY;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const left = randomInRange(minLeft, maxLeft);
      const top = randomInRange(minTop, maxTop);
      const pose = { left, top };
      if (overlapsAnyExclude(pose, item.size)) {
        continue;
      }

      const cx = left + item.size.width / 2;
      const cy = top + item.size.height / 2;

      let penalty = 0;
      let rejected = false;
      for (const other of placed) {
        if (centersTooClose(cx, cy, item.size, other.cx, other.cy, other.size)) {
          // Prefer softer collisions over hard reject after many attempts.
          const minDist = softMinSeparation(item.size, other.size);
          const dist = Math.hypot(cx - other.cx, cy - other.cy);
          penalty += (minDist - dist) * (minDist - dist);
          if (attempt < maxAttempts * 0.7) {
            rejected = true;
            break;
          }
        }
      }
      if (rejected) continue;

      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = pose;
        if (penalty === 0) break;
      }
    }

    // Fallback: search a denser grid if random sampling missed a free pocket.
    if (!best) {
      const stepX = Math.max(12, item.size.width * 0.5);
      const stepY = Math.max(12, item.size.height * 0.5);
      for (let top = minTop; top <= maxTop && !best; top += stepY) {
        for (let left = minLeft; left <= maxLeft; left += stepX) {
          const pose = { left, top };
          if (overlapsAnyExclude(pose, item.size)) continue;
          best = pose;
          break;
        }
      }
    }

    const pose = best ?? {
      left: randomInRange(minLeft, maxLeft),
      top: Math.min(minTop, Math.max(padding, maxTop - item.size.height)),
    };
    // Last resort: clamp above exclude zones rather than land under the extractor.
    let safePose = pose;
    if (overlapsAnyExclude(safePose, item.size) && excludeZones.length > 0) {
      const zone = excludeZones[0];
      safePose = {
        left: Math.min(maxLeft, Math.max(minLeft, padding)),
        top: Math.min(maxTop, Math.max(minTop, zone.top - item.size.height - 8)),
      };
      if (overlapsAnyExclude(safePose, item.size)) {
        safePose = {
          left: Math.min(maxLeft, Math.max(minLeft, zone.left + zone.width + 8)),
          top: Math.min(maxTop, Math.max(minTop, padding)),
        };
      }
    }

    next.set(item.id, safePose);
    placed.push({
      id: item.id,
      cx: safePose.left + item.size.width / 2,
      cy: safePose.top + item.size.height / 2,
      size: item.size,
    });
  }

  return next;
}

/** Random point for residue orbs, with soft separation against prior centers. */
export function scatterPointsInFloor(
  floor: HarvestFloorBounds,
  count: number,
  options?: {
    radius?: number;
    existingCenters?: ReadonlyArray<{ x: number; y: number }>;
    maxAttempts?: number;
  },
): Array<{ x: number; y: number }> {
  const radius = options?.radius ?? 10;
  const maxAttempts = options?.maxAttempts ?? 36;
  const inset = insetHarvestFloor(floor, radius);
  const points: Array<{ x: number; y: number }> = [];
  const prior = [...(options?.existingCenters ?? [])];

  for (let i = 0; i < count; i += 1) {
    let chosen = {
      x: randomInRange(inset.xMin, inset.xMax),
      y: randomInRange(inset.yMin, inset.yMax),
    };
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = {
        x: randomInRange(inset.xMin, inset.xMax),
        y: randomInRange(inset.yMin, inset.yMax),
      };
      const tooClose = prior.some((p) => {
        const dx = p.x - candidate.x;
        const dy = p.y - candidate.y;
        return dx * dx + dy * dy < (radius * 1.6) * (radius * 1.6);
      });
      if (!tooClose) {
        chosen = candidate;
        break;
      }
      chosen = candidate;
    }
    points.push(chosen);
    prior.push(chosen);
  }

  return points;
}
