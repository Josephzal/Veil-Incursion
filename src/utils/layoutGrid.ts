export interface GridMetrics {
  columns: number;
  gap: number;
  contentWidth: number;
  columnWidth: number;
}

/** Compute column width for a fixed-column masonry/grid inside a content lane. */
export function getGridMetrics(
  contentWidth: number,
  columns: number,
  gap: number,
): GridMetrics {
  const safeColumns = Math.max(1, columns);
  const safeWidth = Math.max(0, contentWidth);
  const columnWidth = (safeWidth - gap * (safeColumns - 1)) / safeColumns;

  return {
    columns: safeColumns,
    gap,
    contentWidth: safeWidth,
    columnWidth: Math.max(0, Math.floor(columnWidth)),
  };
}

/** Cap hub viewport width on desktop — prevents ultrawide stretch. */
export function resolveActiveViewportWidth(
  windowWidth: number,
  isDesktop: boolean,
  maxViewportWidth: number,
): number {
  if (!isDesktop) return windowWidth;
  return Math.min(windowWidth, maxViewportWidth);
}

export interface HubContentWidthInput {
  windowWidth: number;
  isDesktop: boolean;
  maxViewportWidth: number;
  navRailWidth: number;
  navMainGap: number;
  mainRailPaddingLeft: number;
  mainRailPaddingRight: number;
  shellPaddingHorizontal: number;
}

/**
 * Width available to grid/card content inside HubScreenShell.
 * Subtracts nav rail, main-rail padding, and slate inner padding.
 */
export function resolveHubContentWidth(input: HubContentWidthInput): {
  activeViewportWidth: number;
  hubViewportWidth: number;
  contentWidth: number;
} {
  const activeViewportWidth = resolveActiveViewportWidth(
    input.windowWidth,
    input.isDesktop,
    input.maxViewportWidth,
  );

  const mainRailInner = Math.max(
    0,
    input.windowWidth
      - input.navRailWidth
      - input.navMainGap
      - input.mainRailPaddingLeft
      - input.mainRailPaddingRight,
  );

  const hubViewportWidth = input.isDesktop
    ? Math.min(mainRailInner, activeViewportWidth)
    : mainRailInner;

  const contentWidth = Math.max(0, hubViewportWidth - input.shellPaddingHorizontal * 2);

  return { activeViewportWidth, hubViewportWidth, contentWidth };
}
