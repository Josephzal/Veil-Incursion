import { useMemo } from 'react';
import { HUB_NAV_MAIN_GAP } from '../constants/landscapeLayout';
import {
  BREAKPOINT_DESKTOP,
  BREAKPOINT_TABLET,
  FORGE_STASH_MIN_WIDTH,
  GRID_COLUMNS,
  GRID_GAP,
  HUB_PANEL_PADDING,
  HUB_PANE_GAP,
  HUB_SHELL_PADDING_HORIZONTAL,
  ICON_SIZE,
  INVENTORY_CELL,
  MAX_VIEWPORT_WIDTH,
} from '../constants/layoutTokens';
import { DESKTOP_DEPLOYMENT_DOSSIER_RATIO, DESKTOP_SAFEHOUSE_LEFT_RATIO, DESKTOP_SHADOW_WAR_MAP_RATIO } from '../constants/responsiveScale';
import {
  getGridMetrics,
  resolveHubContentWidth,
} from '../utils/layoutGrid';
import {
  resolveLaneColumnWidth,
  resolveSplitLanes,
} from '../utils/cargoGridLayout';
import { useLandscapeMetrics } from './useLandscapeMetrics';
import { useResponsiveScale, type ResponsiveScaleMetrics } from './useResponsiveScale';

export interface ResponsiveLayoutMetrics extends ResponsiveScaleMetrics {
  isTablet: boolean;
  /** Capped hub viewport (1200px max on desktop web). */
  activeViewportWidth: number;
  /** Main content rail width after nav subtraction. */
  hubViewportWidth: number;
  /** Grid/card lane inside HubScreenShell padding. */
  contentWidth: number;
  columns: number;
  gap: number;
  columnWidth: number;
  iconSize: number;
  inventoryCellSize: number;
  /** Stash column in loadout split. */
  stashLaneWidth: number;
  /** Deployment pack column in loadout split. */
  deploymentLaneWidth: number;
  /** Buy column in market split. */
  marketBuyLaneWidth: number;
  /** Card width inside buy contraband grid. */
  marketBuyColumnWidth: number;
  /** Fixed forge resource sidebar on desktop. */
  forgeStashWidth: number;
  /** Card width inside forge recipe grid. */
  forgeRecipeColumnWidth: number;
  /** Dossier column in deployment deck split. */
  deploymentDossierLaneWidth: number;
  /** Staging manifest column in deployment deck split. */
  deploymentStagingLaneWidth: number;
  /** Map column in Shadow War dashboard. */
  shadowWarMapLaneWidth: number;
  /** Influence intel column in Shadow War dashboard. */
  shadowWarIntelLaneWidth: number;
  /** Single typography scaler — prefer TerminalText over manual use. */
  scaleFont: (baseSize: number) => number;
}

export function useResponsiveLayout(): ResponsiveLayoutMetrics {
  const scale = useResponsiveScale();
  const landscape = useLandscapeMetrics();

  return useMemo(() => {
    const { screenWidth, isDesktop, isWeb, scaleSize, scaleSpacing } = scale;

    const isTablet = isWeb
      && screenWidth >= BREAKPOINT_TABLET
      && screenWidth < BREAKPOINT_DESKTOP;

    const gap = scaleSpacing(GRID_GAP);
    const shellPadding = scaleSpacing(HUB_SHELL_PADDING_HORIZONTAL);
    const navGap = scaleSpacing(HUB_NAV_MAIN_GAP);
    const mainPadLeft = scaleSpacing(2);
    const mainPadRight = Math.max(scaleSpacing(6), landscape.safeRight);

    const { activeViewportWidth, hubViewportWidth, contentWidth } = resolveHubContentWidth({
      windowWidth: screenWidth,
      isDesktop,
      maxViewportWidth: MAX_VIEWPORT_WIDTH,
      navRailWidth: landscape.hubNavRailWidth,
      navMainGap: navGap,
      mainRailPaddingLeft: mainPadLeft,
      mainRailPaddingRight: mainPadRight,
      shellPaddingHorizontal: shellPadding,
    });

    const columns = isDesktop ? GRID_COLUMNS.desktop : GRID_COLUMNS.mobile;
    const grid = getGridMetrics(contentWidth, columns, gap);

    const paneGap = scaleSpacing(HUB_PANE_GAP);
    const panelPad = scaleSpacing(HUB_PANEL_PADDING);
    const { leftWidth: stashLaneWidth, rightWidth: deploymentLaneWidth } = resolveSplitLanes(
      contentWidth,
      paneGap,
      DESKTOP_SAFEHOUSE_LEFT_RATIO,
    );
    const { leftWidth: marketBuyLaneWidth } = resolveSplitLanes(
      contentWidth,
      paneGap,
      DESKTOP_SAFEHOUSE_LEFT_RATIO,
    );
    const marketBuyColumnWidth = isDesktop
      ? resolveLaneColumnWidth(marketBuyLaneWidth, panelPad, columns, gap)
      : grid.columnWidth;

    const forgeStashWidth = isDesktop
      ? Math.max(FORGE_STASH_MIN_WIDTH, Math.min(grid.columnWidth + gap, Math.floor(contentWidth * 0.34)))
      : contentWidth;

    const forgeRecipeLaneWidth = isDesktop
      ? Math.max(0, contentWidth - forgeStashWidth - paneGap)
      : contentWidth;
    const forgeRecipeColumnWidth = isDesktop
      ? resolveLaneColumnWidth(forgeRecipeLaneWidth, panelPad, columns, gap)
      : grid.columnWidth;

    const { leftWidth: deploymentDossierLaneWidth, rightWidth: deploymentStagingLaneWidth } = resolveSplitLanes(
      contentWidth,
      paneGap,
      DESKTOP_DEPLOYMENT_DOSSIER_RATIO,
    );
    const { leftWidth: shadowWarMapLaneWidth, rightWidth: shadowWarIntelLaneWidth } = resolveSplitLanes(
      contentWidth,
      paneGap,
      DESKTOP_SHADOW_WAR_MAP_RATIO,
    );

    const iconToken = isDesktop
      ? ICON_SIZE.desktop
      : isTablet
        ? ICON_SIZE.tablet
        : ICON_SIZE.mobile;

    const cellToken = isDesktop
      ? INVENTORY_CELL.desktop
      : isTablet
        ? INVENTORY_CELL.tablet
        : INVENTORY_CELL.mobile;

    return {
      ...scale,
      isTablet,
      activeViewportWidth,
      hubViewportWidth,
      contentWidth,
      columns: grid.columns,
      gap: grid.gap,
      columnWidth: grid.columnWidth,
      iconSize: scaleSize(iconToken),
      inventoryCellSize: scaleSize(cellToken),
      stashLaneWidth: isDesktop ? stashLaneWidth : contentWidth,
      deploymentLaneWidth: isDesktop ? deploymentLaneWidth : contentWidth,
      marketBuyLaneWidth: isDesktop ? marketBuyLaneWidth : contentWidth,
      marketBuyColumnWidth,
      forgeStashWidth,
      forgeRecipeColumnWidth,
      deploymentDossierLaneWidth: isDesktop ? deploymentDossierLaneWidth : contentWidth,
      deploymentStagingLaneWidth: isDesktop ? deploymentStagingLaneWidth : contentWidth,
      shadowWarMapLaneWidth: isDesktop ? shadowWarMapLaneWidth : contentWidth,
      shadowWarIntelLaneWidth: isDesktop ? shadowWarIntelLaneWidth : contentWidth,
      scaleFont: (baseSize: number) => scaleSize(baseSize),
    };
  }, [landscape.hubNavRailWidth, landscape.safeRight, scale]);
}
