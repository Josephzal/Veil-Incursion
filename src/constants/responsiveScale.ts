/** Web desktop scaling — mobile/native always uses scale 1.0. */

import { BREAKPOINT_DESKTOP } from './layoutTokens';

export const DESKTOP_MIN_WIDTH = BREAKPOINT_DESKTOP;
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

/** Deployment deck — dossier vs staging manifest. */
export const DESKTOP_DEPLOYMENT_DOSSIER_RATIO = 0.5;

/** Shadow War dashboard — holographic map vs influence intel. */
export const DESKTOP_SHADOW_WAR_MAP_RATIO = 0.6;
import { MAX_VIEWPORT_WIDTH } from './layoutTokens';

/** @deprecated Use MAX_VIEWPORT_WIDTH from layoutTokens. */
export const DESKTOP_SAFEHOUSE_MAX_WIDTH = MAX_VIEWPORT_WIDTH;

/** Deployment deck — section min-heights (base px, scaled via scaleSize). */
export const DESKTOP_DEPLOYMENT_IDENTITY_BLOCK_MIN_HEIGHT = 118;
export const DESKTOP_DEPLOYMENT_LOADOUT_BLOCK_MIN_HEIGHT = 72;
export const DESKTOP_DEPLOYMENT_AVATAR_SIZE = 120;

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
