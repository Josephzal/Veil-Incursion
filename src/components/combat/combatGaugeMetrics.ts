import { Dimensions } from 'react-native';

/** Matches CombatHorizontalGauge compact track + CombatOperativeHud deck row layout. */
export const COMBAT_GAUGE_TRACK_HEIGHT_COMPACT = 5;
export const COMBAT_GAUGE_ROW_GAP_COMPACT = 1;

export const COMBAT_DECK_LABEL_WIDTH = 72;
export const COMBAT_DECK_ROW_GAP = 6;
export const COMBAT_HUD_PADDING_X = 6;
export const COMBAT_DECK_TOTAL_INSET = 16;

export const COMBAT_GAUGE_BLOCK_HEIGHT_COMPACT =
  COMBAT_GAUGE_TRACK_HEIGHT_COMPACT * 2 + COMBAT_GAUGE_ROW_GAP_COMPACT;

/** Pixel width of the gauge track beside the deck label (not the full HUD container). */
export function combatDeckGaugeTrackWidth(screenWidth = Dimensions.get('screen').width): number {
  const deckHalf = (screenWidth - COMBAT_DECK_TOTAL_INSET) / 2;
  return Math.max(
    40,
    Math.floor(
      deckHalf
      - COMBAT_HUD_PADDING_X * 2
      - COMBAT_DECK_LABEL_WIDTH
      - COMBAT_DECK_ROW_GAP,
    ),
  );
}
