/**
 * Centralized Phase-1 VeilWarpField tuning.
 * Presentation only — not gameplay settings.
 */
export const VEIL_WARP_CONFIG = {
  /** Internal canvas resolution relative to CSS size. */
  renderScale: 0.6,
  /** Cap device pixel ratio used for backing store. */
  dprCap: 1.25,
  /** Multiplier on shader time (1 = designed speeds). */
  motionSpeed: 1,
  /** UV warp amplitude scale. */
  warpStrength: 1,
  /** Contour band visibility — softened under aperture well. */
  contourIntensity: 0.85,
  /** Violet/purple contribution. */
  violetIntensity: 0.82,
  /** Pink/magenta contribution. */
  pinkIntensity: 0.75,
  /** Mint/teal contour contribution. */
  mintIntensity: 0.8,
  /** Edge vignette strength. */
  vignetteStrength: 1.15,
  /** Deterministic time for reduced-motion static frame. */
  reducedMotionTime: 7,
  /** Leading sweep wedge response (degrees) — presentation only. */
  sweepLeadDeg: 24,
  /** Contour brighten under sweep (0–1). */
  sweepContourBoost: 0.72,
  /** Violet→mint shift under sweep (0–1). */
  sweepMintShift: 0.48,
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

export const VEIL_WARP_COLORS = {
  voidBg: '#060A0E',
  scannerBase: '#070D0E',
  quietViolet: '#81738F',
  interferencePurple: '#72577F',
  mutedPink: '#A45F82',
  magenta: '#B15F8C',
  mint: '#64C9B1',
  deepTeal: '#315E59',
} as const;
