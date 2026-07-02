import type { ImageSourcePropType } from 'react-native';

export const CARGO_GRID_BACKGROUND: ImageSourcePropType = require('../../assets/images/item images/cargo_bg.png');

/** Dark wash over the cargo mat so grid cells and items stay readable. */
export const CARGO_GRID_BACKDROP_DIM = 'rgba(5, 6, 8, 0.45)';

/** Padding between hub cargo grid cells and the mat edge. */
export const HUB_CARGO_MAT_PADDING = 12;
/** Inset applied to shrink the mat shell (Black Market). */
export const HUB_CARGO_MAT_INSET = 4;

export function resolveHubCargoMatShellMetrics(
  frameWidth: number,
  frameHeight: number,
  scaleSpacing: (value: number) => number,
  matInset = HUB_CARGO_MAT_INSET,
): {
  width: number;
  height: number;
  padding: number;
} {
  const matPadding = scaleSpacing(HUB_CARGO_MAT_PADDING);
  const inset = scaleSpacing(matInset);
  const effectiveMatPadding = Math.max(4, matPadding - inset);

  return {
    width: frameWidth + effectiveMatPadding * 6,
    height: frameHeight + effectiveMatPadding * 6,
    padding: effectiveMatPadding,
  };
}

export function resolveCargoGridCellBackground(options: {
  occupied: boolean;
  isPreview: boolean;
  canDrop: boolean;
  cargoBackdrop: boolean;
}): string {
  const { occupied, isPreview, canDrop, cargoBackdrop } = options;

  if (isPreview) {
    return canDrop ? 'rgba(0, 255, 51, 0.22)' : 'rgba(239, 68, 68, 0.18)';
  }

  if (cargoBackdrop) {
    return occupied ? 'rgba(0, 255, 51, 0.14)' : 'rgba(10, 11, 15, 0.42)';
  }

  return occupied ? 'rgba(0, 255, 51, 0.06)' : '#0a0b0f';
}
