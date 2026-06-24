/** Landscape layout tokens — app is landscape-locked; breakpoints tune density across devices. */

export type LandscapeBreakpoint = 'compact' | 'standard' | 'wide';

export const LANDSCAPE_HEIGHT_COMPACT = 400;
export const LANDSCAPE_WIDTH_WIDE = 900;
export const LANDSCAPE_MIN_WIDTH_FOR_SPLIT = 640;
export const LANDSCAPE_MIN_ASPECT_FOR_SPLIT = 1.35;

export const LANDSCAPE_PRIMARY_SPLIT_RATIO = 0.62;
export const LANDSCAPE_WELCOME_PRIMARY_RATIO = 0.55;
export const META_RESULTS_PRIMARY_RATIO = 0.52;
export const META_RESULTS_CARD_MAX_WIDTH = 520;
export const META_RESULTS_CARD_MAX_WIDTH_WIDE = 620;
export const LANDSCAPE_PANEL_GAP = 8;
export const LANDSCAPE_PANEL_PADDING = 10;

export const HUB_NAV_RAIL_WIDTH = 200;
export const HUB_NAV_RAIL_MIN_WIDTH = 168;
export const HUB_NAV_RAIL_MAX_WIDTH = 240;

export function resolveHubNavRailWidth(screenWidth: number): number {
  const raw = Math.round(screenWidth * 0.22);
  return Math.max(HUB_NAV_RAIL_MIN_WIDTH, Math.min(HUB_NAV_RAIL_MAX_WIDTH, raw));
}

/** Left nav rail on wide hub; top tabs on compact. */
export function shouldUseHubNavRail(width: number, height: number): boolean {
  return shouldUseHorizontalSplit(width, height);
}

export function resolveLandscapeBreakpoint(width: number, height: number): LandscapeBreakpoint {
  if (height < LANDSCAPE_HEIGHT_COMPACT) return 'compact';
  if (width >= LANDSCAPE_WIDTH_WIDE) return 'wide';
  return 'standard';
}

/** Wide enough for primary + secondary panes side-by-side. */
export function shouldUseHorizontalSplit(width: number, height: number): boolean {
  if (width < LANDSCAPE_MIN_WIDTH_FOR_SPLIT) return false;
  if (height <= 0) return false;
  return width / height >= LANDSCAPE_MIN_ASPECT_FOR_SPLIT;
}
