import type { ViewStyle } from 'react-native';

export const DESKTOP_STASH_MAX_WIDTH = 400;
export const DESKTOP_FORGE_STASH_WIDTH = 350;
export const DESKTOP_HUB_ICON_SIZE = 48;
export const DESKTOP_HUB_ICON_SIZE_MOBILE = 28;
export const DESKTOP_ABILITY_CARD_MIN_HEIGHT = 120;
export const DESKTOP_HUB_CELL_MIN = 80;
export const DESKTOP_HUB_CELL_MAX = 100;

/** Strict 2-column grid row — space-between, no loose flexGrow. */
export const desktopTwoColumnGrid: ViewStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
};

/** Symmetrical half-width card — prevents one card swallowing a row. */
export const desktopTwoColumnCard: ViewStyle = {
  flexBasis: '48%',
  flexGrow: 0,
  flexShrink: 0,
  width: '48%',
  maxWidth: '48%',
  minHeight: DESKTOP_ABILITY_CARD_MIN_HEIGHT,
};
