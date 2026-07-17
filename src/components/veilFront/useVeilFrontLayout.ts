import { useMemo } from 'react';
import { useHubLayout } from '../../context/HubLayoutContext';

export const VEIL_FRONT_BREAKPOINT_WIDE = 1180;
export const VEIL_FRONT_BREAKPOINT_MAP_TOP = 1100;
export const VEIL_FRONT_HEIGHT_COMPACT = 800;
export const VEIL_FRONT_HEIGHT_ULTRA = 720;

export function useVeilFrontLayout() {
  const hub = useHubLayout();
  const { screenWidth, screenHeight, isDesktop, scaleSpacing, scaleSize, scaleFont, gap, contentWidth } = hub;

  return useMemo(() => {
    const isWideViewport = screenWidth >= VEIL_FRONT_BREAKPOINT_WIDE;
    const isTwoColumnShell = isWideViewport && isDesktop;
    const isMapTopStacked = !isWideViewport;
    const isMapTopBandStacked = screenWidth < VEIL_FRONT_BREAKPOINT_MAP_TOP;
    const isCompactHeight = screenHeight <= VEIL_FRONT_HEIGHT_COMPACT;
    const isUltraCompactHeight = screenHeight <= VEIL_FRONT_HEIGHT_ULTRA;

    const actionPanelWidth = Math.min(
      420,
      Math.max(360, Math.floor(contentWidth * 0.32)),
    );
    const statusOverlayWidth = Math.min(320, Math.max(240, Math.floor(screenWidth * 0.24)));
    /** @deprecated use actionPanelWidth */
    const briefingPanelWidth = actionPanelWidth;

    const panelGap = scaleSpacing(isCompactHeight ? 8 : isDesktop ? 14 : 10);
    const sectionGap = scaleSpacing(isUltraCompactHeight ? 6 : isCompactHeight ? 8 : 10);
    const cardPadding = scaleSpacing(isUltraCompactHeight ? 8 : isCompactHeight ? 10 : 12);
    const sectionPadding = scaleSpacing(isCompactHeight ? 12 : 16);
    const deployButtonHeight = scaleSize(isCompactHeight ? 44 : 48);
    const descriptionLines = isUltraCompactHeight ? 1 : 2;
    const showOptionalCopy = !isUltraCompactHeight;
    const showHeaderSummary = isTwoColumnShell;

    return {
      ...hub,
      isWideViewport,
      isTwoColumnShell,
      isMapTopStacked,
      isMapTopBandStacked,
      isCompactHeight,
      isUltraCompactHeight,
      actionPanelWidth,
      statusOverlayWidth,
      briefingPanelWidth,
      /** @deprecated unused in unified briefing layout */
      isDossierGrid: false,
      /** @deprecated unused in unified briefing layout */
      statusSummaryWidth: briefingPanelWidth,
      panelGap,
      sectionGap,
      cardPadding,
      sectionPadding,
      deployButtonHeight,
      descriptionLines,
      showOptionalCopy,
      showHeaderSummary,
    };
  }, [contentWidth, gap, hub, isDesktop, scaleFont, scaleSize, scaleSpacing, screenHeight, screenWidth]);
}

function visibleWithOverflow<T>(items: readonly T[], max: number): { visible: T[]; overflow: number } {
  if (items.length <= max) return { visible: [...items], overflow: 0 };
  return { visible: items.slice(0, max), overflow: items.length - max };
}

export { visibleWithOverflow };
