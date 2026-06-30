/** Global layout breakpoints and tactile UI tokens for hub surfaces. */

export const BREAKPOINT_TABLET = 768;
export const BREAKPOINT_DESKTOP = 1024;

/** Master containment field — hub viewports align to this on wide monitors. */
export const MAX_VIEWPORT_WIDTH = 1200;

export const GRID_GAP = 16;

/** Horizontal padding inside HubScreenShell slate (one side). */
export const HUB_SHELL_PADDING_HORIZONTAL = 10;

/** Gap between split panes (loadout, market). */
export const HUB_PANE_GAP = 10;

/** Inner padding on safehouse sub-panels (one side). */
export const HUB_PANEL_PADDING = 10;

export const FORGE_STASH_MIN_WIDTH = 280;

/** Minimum ability card height on desktop grid. */
export const ABILITY_CARD_MIN_HEIGHT = 120;

export const ICON_SIZE = {
  mobile: 40,
  tablet: 48,
  desktop: 56,
} as const;

export const INVENTORY_CELL = {
  mobile: 64,
  tablet: 80,
  desktop: 96,
} as const;

export const GRID_COLUMNS = {
  mobile: 1,
  desktop: 2,
} as const;
