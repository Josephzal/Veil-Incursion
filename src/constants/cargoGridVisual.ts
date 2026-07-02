import type { ImageSourcePropType } from 'react-native';

export const CARGO_GRID_BACKGROUND: ImageSourcePropType = require('../../assets/images/item images/cargo_bg.png');

/** Dark wash over the cargo mat so grid cells and items stay readable. */
export const CARGO_GRID_BACKDROP_DIM = 'rgba(5, 6, 8, 0.45)';

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
