/** Screen-right inset to stacked hub inner content (center gutter + paddingHorizontal). */
export const TACTICAL_HUB_STACKED_RIGHT_INSET = 16;

/** Tactical dashboard — three equal columns; vitals overlay aligns to the left column. */
export const TACTICAL_DASHBOARD_COLUMN_COUNT = 3;
export const TACTICAL_DASHBOARD_COLUMN_WIDTH_PERCENT = `${100 / TACTICAL_DASHBOARD_COLUMN_COUNT}%`;
export const TACTICAL_DASHBOARD_PANEL_PADDING = 10;
export const TACTICAL_DASHBOARD_HEIGHT_PERCENT = '30%';
export const TACTICAL_DASHBOARD_PANEL_BORDER_COLOR = 'rgba(51, 51, 51, 0.95)';
export const TACTICAL_DASHBOARD_PANEL_CONTENT_PADDING_TOP = 6;

/** Textured scanline fill for command deck + hostile intel columns. */
export const COMBAT_DASHBOARD_TEXTURE_BG = 'rgba(9, 9, 11, 0.92)';
export const COMBAT_DASHBOARD_SCANLINE_OPACITY = 0.05;

/** Operative sprite width — feet anchor to arena bottom above dashboard. */
export const OPERATIVE_ARENA_SPRITE_WIDTH = 210;
export const OPERATIVE_ARENA_LEFT_INSET = 22;

/** Top arena reserve so the operative sprite clears the vitals overlay. */
export const OPERATIVE_VITALS_OVERLAY_TOP = 4;
export const OPERATIVE_VITALS_PANEL_HEIGHT = 58;
export const OPERATIVE_VITALS_SPRITE_GAP = 12;
export const OPERATIVE_ARENA_TOP_INSET =
  OPERATIVE_VITALS_OVERLAY_TOP + OPERATIVE_VITALS_PANEL_HEIGHT + OPERATIVE_VITALS_SPRITE_GAP;
