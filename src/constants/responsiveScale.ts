/** Web desktop scaling — mobile/native always uses scale 1.0. */

export const DESKTOP_MIN_WIDTH = 1024;
export const DESKTOP_REFERENCE_WIDTH = 1920;
export const DESKTOP_SCALE_MIN = 1.35;
export const DESKTOP_SCALE_MAX = 1.65;

/** Scanner: primary = radar viewport, secondary = node dock. */
export const DESKTOP_SCANNER_PRIMARY_RATIO = 0.58;
export const DESKTOP_SCANNER_SECONDARY_RATIO = 0.42;

/** Identity badge: primary = profile card, secondary = telemetry column. */
export const DESKTOP_BADGE_PRIMARY_RATIO = 0.55;
export const DESKTOP_BADGE_SECONDARY_RATIO = 0.45;

/** Safehouse split panes: favor the right (detail) column on wide monitors. */
export const DESKTOP_SAFEHOUSE_LEFT_RATIO = 0.42;
export const DESKTOP_SAFEHOUSE_RIGHT_RATIO = 0.58;

export function resolveDesktopScale(width: number): number {
  if (width < DESKTOP_MIN_WIDTH) return 1;
  const span = DESKTOP_REFERENCE_WIDTH - DESKTOP_MIN_WIDTH;
  const t = span > 0 ? Math.min(1, (width - DESKTOP_MIN_WIDTH) / span) : 1;
  return DESKTOP_SCALE_MIN + t * (DESKTOP_SCALE_MAX - DESKTOP_SCALE_MIN);
}

export function scaleUiMetric(value: number, scale: number): number {
  if (scale === 1) return value;
  return Math.round(value * scale * 2) / 2;
}

export function scaleSpacingMetric(value: number, scale: number): number {
  if (scale === 1) return value;
  return Math.round(value * scale);
}

export function resolveDesktopHubNavRailWidth(screenWidth: number, scale: number): number {
  const base = Math.round(screenWidth * 0.14);
  const clamped = Math.max(128, Math.min(168, base));
  if (scale === 1) return clamped;
  return Math.round(clamped * Math.min(scale, 1.45));
}
