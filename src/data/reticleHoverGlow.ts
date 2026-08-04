/**
 * Hover glow for enemy targeting brackets (ability cyan + Abyssal crimson).
 *
 * Tune here — both TargetingBrackets and AbyssalVerdictTargetBrackets read these.
 *
 * Quick dials:
 * - Raise/lower `haloOpacity` / `midOpacity` for how soft the bloom reads
 * - Raise/lower `haloExtra` / `midExtra` for how wide the bloom spreads
 * - Edit `webDropShadows` blur radii (the px numbers) for CSS bloom strength on web
 * - Set `webDropShadows` to [] to disable CSS drop-shadow entirely
 */

export type ReticleHoverGlowPass = {
  /** Added to the core stroke width for this pass. */
  extra: number;
  /** Path opacity 0–1. */
  opacity: number;
};

export const RETICLE_HOVER_GLOW = {
  /** Core L-stroke when idle / hovered. */
  strokeIdle: 1.6,
  strokeHover: 2.1,

  /**
   * Soft under-strokes drawn behind the core when hovered.
   * Order: outermost → innermost. Keep opacities low.
   */
  passes: [
    { extra: 4, opacity: 0.12 },
    { extra: 2, opacity: 0.22 },
  ] as const satisfies readonly ReticleHoverGlowPass[],

  /**
   * Web-only CSS drop-shadow layers (applied to an untransformed host).
   * Format: blur radius in px. Color is injected by the bracket component.
   * Example stronger: [2, 6, 12]  |  softer: [1, 3]  |  off: []
   */
  webDropShadowsPx: [2, 5] as const,
} as const;

/** Build the web filter string for a given stroke color. */
export function reticleHoverWebGlowStyle(color: string): object | null {
  const radii = RETICLE_HOVER_GLOW.webDropShadowsPx;
  if (radii.length === 0) return null;
  return {
    filter: radii.map((px) => `drop-shadow(0 0 ${px}px ${color})`).join(' '),
  };
}
