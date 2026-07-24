/**
 * Imperative bridge: VeilTransitOverlay timeline → VeilWarpField WebGL RAF.
 * Presentation only — not React state.
 */

export type VeilTransitBridgeMode = 0 | 1 | 2;
/** 0 = inactive / ambient, 1 = incursionIngress, 2 = successfulExtraction */

export interface VeilTransitBridgeSample {
  /** 1 while a full-screen transit overlay is driving the field. */
  active: number;
  /** 1 ingress · 2 extraction */
  mode: VeilTransitBridgeMode;
  /** 0–1 over the fixed transit window. */
  progress: number;
  /** Focal point in WebGL UV (y-up). */
  focalU: number;
  focalV: number;
  /** Portal aperture radius in height-normalized units (grows to cover). */
  aperture: number;
  /** 0–1 near-black cover over the field. */
  cover: number;
  /** Pull strength toward (ingress) or into (extract) the focus. */
  attraction: number;
  /** Contour density multiplier. */
  densityScale: number;
  /** Motion / turbulence multiplier vs ambient. */
  motionBoost: number;
  /** Warp amplitude multiplier. */
  warpBoost: number;
  /** Contour brightness multiplier. */
  intensityBoost: number;
  /** Restrained chromatic separation (0–1). */
  chromatic: number;
  /** One-shot breach / residual ripple strength. */
  pulse: number;
  /** Shader-clock seconds when the current pulse started (−1 = none). */
  pulseStartSec: number;
  /** Increments when a new pulse should fire. */
  pulseEpoch: number;
  /** 1 when prefers-reduced-motion is active for this transit. */
  reducedMotion: number;
}

export const veilTransitBridge: VeilTransitBridgeSample = {
  active: 0,
  mode: 0,
  progress: 0,
  focalU: 0.5,
  focalV: 0.5,
  aperture: 0,
  cover: 0,
  attraction: 0,
  densityScale: 1,
  motionBoost: 1,
  warpBoost: 1,
  intensityBoost: 1,
  chromatic: 0,
  pulse: 0,
  pulseStartSec: -1,
  pulseEpoch: 0,
  reducedMotion: 0,
};

export function resetVeilTransitBridge(): void {
  veilTransitBridge.active = 0;
  veilTransitBridge.mode = 0;
  veilTransitBridge.progress = 0;
  veilTransitBridge.aperture = 0;
  veilTransitBridge.cover = 0;
  veilTransitBridge.attraction = 0;
  veilTransitBridge.densityScale = 1;
  veilTransitBridge.motionBoost = 1;
  veilTransitBridge.warpBoost = 1;
  veilTransitBridge.intensityBoost = 1;
  veilTransitBridge.chromatic = 0;
  veilTransitBridge.pulse = 0;
  veilTransitBridge.pulseStartSec = -1;
  veilTransitBridge.reducedMotion = 0;
}

export function publishVeilTransitPulse(): void {
  veilTransitBridge.pulseEpoch += 1;
  veilTransitBridge.pulse = 1;
}
