/**
 * Veil transit — portal plays while an imperfect iris gradually reveals the
 * destination through it (seamless portal crossfade).
 *
 * Timing is fixed and independent of load / route performance.
 */

export const VEIL_TRANSIT_MS = 1400;

/** Swap under full overlay before the iris opens enough to show content. */
export const INGRESS_SWAP_MS = 160;
export const EXTRACT_SWAP_MS = 180;

/** Near-black compression beat must stay under 50ms. */
export const COVER_BEAT_MS = 45;

/**
 * Iris begins after a short portal establish beat, then spreads across the
 * rest of the transit so destination and Veil field coexist.
 */
export const REVEAL_START_MS = 280;
/** Iris finishes near the end — still quick on the last edges. */
export const REVEAL_END_MS = 1280;

export type VeilTransitKind = 'incursionIngress' | 'successfulExtraction';

export interface VeilTransitSample {
  progress: number;
  aperture: number;
  cover: number;
  attraction: number;
  densityScale: number;
  motionBoost: number;
  warpBoost: number;
  intensityBoost: number;
  chromatic: number;
  pulse: number;
  /** Overlay opacity (field + cover). */
  overlayOpacity: number;
  /**
   * 0 = fully covered · 1 = destination fully revealed.
   * Drives an imperfect circular iris wipe from the focal point.
   */
  revealRadius: number;
  /** Destination HUD fade (0–1) during arrival / closure. */
  hudReveal: number;
  /** True once the viewport is fully obscured (swap window). */
  fullyCovered: boolean;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(edge1 - edge0, 1e-6));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Ease-in-out so the hole opens with presence, then finishes the rim cleanly. */
function sampleReveal(ms: number): number {
  if (ms < REVEAL_START_MS) return 0;
  if (ms >= REVEAL_END_MS) return 1;
  const u = (ms - REVEAL_START_MS) / (REVEAL_END_MS - REVEAL_START_MS);
  // Smoothstep² — readable mid-portal coexistence, snappy finish.
  const s = u * u * (3 - 2 * u);
  return s * s * (3 - 2 * s);
}

/** Ingress — portal surge with overlapping center-out reveal. */
export function sampleIngressTransit(elapsedMs: number, reducedMotion: boolean): VeilTransitSample {
  const ms = Math.max(0, Math.min(VEIL_TRANSIT_MS, elapsedMs));
  const progress = ms / VEIL_TRANSIT_MS;
  const revealRadius = sampleReveal(ms);

  if (reducedMotion) {
    const cover = ms < 350
      ? smoothstep(0, 350, ms) * 0.9
      : lerp(0.9, 0.15, revealRadius);
    const pulse = ms < 320 ? 1 - smoothstep(0, 320, ms) : 0;
    const overlayOpacity = ms < 40
      ? smoothstep(0, 40, ms)
      : revealRadius > 0.88
        ? 1 - smoothstep(0.88, 1, revealRadius)
        : 1;
    return {
      progress,
      aperture: lerp(0.12, 2.3, clamp01(ms / 500)),
      cover,
      attraction: 0.75,
      densityScale: 1.2,
      motionBoost: 1,
      warpBoost: 1,
      intensityBoost: 1.1,
      chromatic: 0,
      pulse,
      overlayOpacity,
      revealRadius,
      hudReveal: 1,
      fullyCovered: ms >= INGRESS_SWAP_MS && revealRadius < 0.02,
    };
  }

  let aperture = 0;
  let cover = 0;
  let attraction = 0;
  let densityScale = 1;
  let motionBoost = 1;
  let warpBoost = 1;
  let intensityBoost = 1;
  let chromatic = 0;
  let pulse = 0;

  if (ms <= 280) {
    // Establish — portal reads before the iris opens
    const t = ms / 280;
    pulse = 1 - t * 0.35;
    cover = lerp(0.1, 0.48, t);
    attraction = lerp(0.45, 1.8, t);
    densityScale = lerp(1.1, 1.65, t);
    motionBoost = lerp(1.5, 3.2, t);
    warpBoost = lerp(1.1, 1.75, t);
    intensityBoost = lerp(1.15, 1.7, t);
    aperture = lerp(0.03, 0.35, t * t);
    chromatic = lerp(0, 0.22, t);
  } else if (ms <= 900) {
    // Peak portal — iris growing through the middle; field stays in the ring
    const t = (ms - 280) / 620;
    pulse = Math.max(0, 0.45 - t * 0.4);
    attraction = lerp(1.8, 2.9, t);
    densityScale = lerp(1.65, 2.0, t);
    motionBoost = lerp(3.2, 4.2, t);
    warpBoost = lerp(1.75, 2.1, t);
    intensityBoost = lerp(1.7, 2.0, t);
    aperture = lerp(0.35, 2.35, smoothstep(0, 1, t));
    // Keep enough cover for abyss mass, but let pink/mint show in the opaque ring
    cover = lerp(0.48, 0.28, Math.max(t * 0.65, revealRadius * 0.55));
    chromatic = lerp(0.22, 0.42, t) * (1 - revealRadius * 0.55);
  } else {
    // Wind-down — iris finishing; Veil ring thins out
    const t = (ms - 900) / Math.max(1, VEIL_TRANSIT_MS - 900);
    attraction = lerp(2.6, 1.3, t);
    densityScale = lerp(1.85, 1.25, t);
    motionBoost = lerp(3.6, 1.5, t);
    warpBoost = lerp(1.9, 1.2, t);
    intensityBoost = lerp(1.75, 1.15, t);
    aperture = lerp(2.35, 2.7, t);
    cover = lerp(0.28, 0.1, t);
    chromatic = (1 - t) * 0.12 * (1 - revealRadius);
    pulse = 0;
  }

  const overlayOpacity = ms < 40
    ? smoothstep(0, 40, ms)
    : revealRadius > 0.88
      ? 1 - smoothstep(0.88, 1, revealRadius)
      : 1;

  return {
    progress,
    aperture,
    cover: clamp01(cover),
    attraction,
    densityScale,
    motionBoost,
    warpBoost,
    intensityBoost,
    chromatic: clamp01(chromatic),
    pulse: clamp01(pulse),
    overlayOpacity: clamp01(overlayOpacity),
    revealRadius: clamp01(revealRadius),
    hudReveal: 1,
    fullyCovered: ms >= INGRESS_SWAP_MS && revealRadius < 0.02,
  };
}

/** Extraction — same overlapping portal + iris structure. */
export function sampleExtractionTransit(elapsedMs: number, reducedMotion: boolean): VeilTransitSample {
  const ms = Math.max(0, Math.min(VEIL_TRANSIT_MS, elapsedMs));
  const progress = ms / VEIL_TRANSIT_MS;
  const revealRadius = sampleReveal(ms);

  if (reducedMotion) {
    return sampleIngressTransit(elapsedMs, true);
  }

  let aperture = 0;
  let cover = 0;
  let attraction = 0;
  let densityScale = 1;
  let motionBoost = 1;
  let warpBoost = 1;
  let intensityBoost = 1;
  let chromatic = 0;
  let pulse = 0;

  if (ms <= 280) {
    const t = ms / 280;
    pulse = 0.6 * (1 - t * 0.3);
    cover = lerp(0.14, 0.5, t);
    attraction = lerp(1.0, 2.3, t);
    densityScale = lerp(1.25, 1.8, t);
    motionBoost = lerp(1.9, 3.8, t);
    warpBoost = lerp(1.35, 2.05, t);
    intensityBoost = lerp(1.3, 1.85, t);
    aperture = lerp(1.7, 0.7, t);
    chromatic = lerp(0.08, 0.28, t);
  } else if (ms <= 900) {
    const t = (ms - 280) / 620;
    attraction = lerp(2.3, 3.5, t);
    densityScale = lerp(1.8, 2.15, t);
    motionBoost = lerp(3.8, 4.5, t);
    warpBoost = lerp(2.05, 2.35, t);
    intensityBoost = lerp(1.85, 2.15, t);
    aperture = lerp(0.7, 0.15, t);
    cover = lerp(0.5, 0.26, Math.max(t * 0.65, revealRadius * 0.55));
    chromatic = lerp(0.28, 0.45, t) * (1 - revealRadius * 0.55);
    pulse = (1 - t) * 0.22;
  } else {
    const t = (ms - 900) / Math.max(1, VEIL_TRANSIT_MS - 900);
    attraction = lerp(2.8, 1.2, t);
    densityScale = lerp(1.9, 1.2, t);
    motionBoost = lerp(3.8, 1.4, t);
    warpBoost = lerp(2.0, 1.15, t);
    intensityBoost = lerp(1.8, 1.1, t);
    aperture = lerp(0.15, 0.06, t);
    cover = lerp(0.26, 0.08, t);
    chromatic = 0;
    pulse = 0;
  }

  const overlayOpacity = ms < 40
    ? smoothstep(0, 40, ms)
    : revealRadius > 0.88
      ? 1 - smoothstep(0.88, 1, revealRadius)
      : 1;

  return {
    progress,
    aperture,
    cover: clamp01(cover),
    attraction,
    densityScale,
    motionBoost,
    warpBoost,
    intensityBoost,
    chromatic: clamp01(chromatic),
    pulse: clamp01(pulse),
    overlayOpacity: clamp01(overlayOpacity),
    revealRadius: clamp01(revealRadius),
    hudReveal: 1,
    fullyCovered: ms >= EXTRACT_SWAP_MS && revealRadius < 0.02,
  };
}

export function sampleVeilTransit(
  kind: VeilTransitKind,
  elapsedMs: number,
  reducedMotion: boolean,
): VeilTransitSample {
  return kind === 'successfulExtraction'
    ? sampleExtractionTransit(elapsedMs, reducedMotion)
    : sampleIngressTransit(elapsedMs, reducedMotion);
}
