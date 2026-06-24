import { LANDSCAPE_PANEL_PADDING } from './landscapeLayout';

/** Minimum gutter above pinned footers (home indicator / gesture bar). */
export const IMMERSIVE_FOOTER_GUTTER = 8;

export function resolveImmersiveFooterInset(bottomInset: number): number {
  return Math.max(IMMERSIVE_FOOTER_GUTTER, bottomInset);
}

export function resolveImmersiveTopInset(topInset: number): number {
  return Math.max(0, topInset);
}

export function resolveImmersiveHorizontalInset(leftInset: number, rightInset: number): {
  paddingLeft: number;
  paddingRight: number;
} {
  return {
    paddingLeft: Math.max(0, leftInset),
    paddingRight: Math.max(0, rightInset),
  };
}

export function resolveImmersiveContentPadding(
  topInset: number,
  basePadding = LANDSCAPE_PANEL_PADDING,
): number {
  return basePadding + resolveImmersiveTopInset(topInset);
}
