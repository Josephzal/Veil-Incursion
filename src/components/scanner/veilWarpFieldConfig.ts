/**
 * Centralized Phase-1 VeilWarpField tuning.
 * Presentation only — not gameplay settings.
 */

/** Field presentation modes — ambient scanner vs full-screen transit. */
export type VeilWarpFieldMode =
  | 'ambientScanner'
  | 'incursionIngress'
  | 'successfulExtraction';

export const VEIL_WARP_CONFIG = {
  /** Internal canvas resolution relative to CSS size. */
  renderScale: 0.6,
  /** Cap device pixel ratio used for backing store. */
  dprCap: 1.25,
  /** Multiplier on shader time (1 = designed speeds). */
  motionSpeed: 1,
  /** UV warp amplitude scale. */
  warpStrength: 1,
  /** Contour band visibility — brighter readable strands. */
  contourIntensity: 1.05,
  /** Violet-family contribution on shared contours. */
  violetIntensity: 1.0,
  /** Kept for uniform compatibility; filled pink basins removed. */
  pinkIntensity: 0.2,
  /** Mint/teal contribution on shared contours. */
  mintIntensity: 1.0,
  /** Edge vignette strength — lighter so lines stay visible. */
  vignetteStrength: 0.95,
  /** Deterministic time for reduced-motion static frame. */
  reducedMotionTime: 7,
  /** Leading sweep wedge response (degrees) — presentation only. */
  sweepLeadDeg: 24,
  /** Contour brighten under sweep (0–1) — amplifies existing hue. */
  sweepContourBoost: 0.55,
  /** Restrained mint edge registration under sweep (not a full repaint). */
  sweepMintShift: 0.12,
  /** Leading-edge refraction in UV units (very subtle). */
  sweepRefraction: 0.0055,
  /** Phosphor wake peak brightness (0–1). */
  sweepWakeStrength: 0.7,
  /** Selection ripple — one-shot lock response (shader clock seconds). */
  selectionRippleExpandSec: 0.8,
  selectionRippleFadeSec: 0.25,
  /** Height-normalized travel — enough to cross multiple Veil bands. */
  selectionRippleMaxRadius: 0.34,
  selectionInitialSec: 0.11,
  /** How strongly existing flow warps ripple space (relative to origin). */
  selectionRippleFlowInfluence: 0.5,
  /** Radial domain displacement at the ripple front. */
  selectionRippleRadialStrength: 0.024,
  /** Tangential irregularity at the front. */
  selectionRippleTangentialStrength: 0.0085,
} as const;

/**
 * Baseline multipliers for transit modes (timeline bridge further animates these).
 * Ambient keeps identity with VEIL_WARP_CONFIG.
 */
export const VEIL_WARP_MODE_BASE: Record<VeilWarpFieldMode, {
  motionSpeed: number;
  warpStrength: number;
  contourIntensity: number;
  violetIntensity: number;
  mintIntensity: number;
  vignetteStrength: number;
  /** Full-viewport field (ignores scanner circular well). */
  fullBleed: boolean;
}> = {
  ambientScanner: {
    motionSpeed: VEIL_WARP_CONFIG.motionSpeed,
    warpStrength: VEIL_WARP_CONFIG.warpStrength,
    contourIntensity: VEIL_WARP_CONFIG.contourIntensity,
    violetIntensity: VEIL_WARP_CONFIG.violetIntensity,
    mintIntensity: VEIL_WARP_CONFIG.mintIntensity,
    vignetteStrength: VEIL_WARP_CONFIG.vignetteStrength,
    fullBleed: false,
  },
  incursionIngress: {
    motionSpeed: 4,
    warpStrength: 1.85,
    contourIntensity: 1.8,
    violetIntensity: 1.45,
    mintIntensity: 1.15,
    vignetteStrength: 0.55,
    fullBleed: true,
  },
  successfulExtraction: {
    motionSpeed: 4.5,
    warpStrength: 2.05,
    contourIntensity: 1.9,
    violetIntensity: 1.5,
    mintIntensity: 1.2,
    vignetteStrength: 0.5,
    fullBleed: true,
  },
};

export const VEIL_WARP_COLORS = {
  voidBg: '#05090B',
  scannerBase: '#070B0C',
  deepViolet: '#442A70',
  fieldViolet: '#5C3A94',
  mutedPurple: '#764EB0',
  darkTeal: '#3E948A',
  mint: '#64C9B1',
  mutedGreen: '#8EB276',
} as const;
