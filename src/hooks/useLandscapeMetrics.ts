import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LANDSCAPE_PANEL_PADDING,
  resolveLandscapeBreakpoint,
  shouldUseHorizontalSplit,
  shouldUseHubNavRail,
  type LandscapeBreakpoint,
} from '../constants/landscapeLayout';
import { useResponsiveScale } from './useResponsiveScale';

export interface LandscapeMetrics {
  width: number;
  height: number;
  breakpoint: LandscapeBreakpoint;
  useHorizontalSplit: boolean;
  useHubNavRail: boolean;
  hubNavRailWidth: number;
  panelPadding: number;
  safeTop: number;
  safeBottom: number;
  safeLeft: number;
  safeRight: number;
}

export function useLandscapeMetrics(): LandscapeMetrics {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { scaleSpacing, hubNavRailWidth: resolveHubNavRailWidthScaled } = useResponsiveScale();

  return useMemo(
    () => ({
      width,
      height,
      breakpoint: resolveLandscapeBreakpoint(width, height),
      useHorizontalSplit: shouldUseHorizontalSplit(width, height),
      useHubNavRail: shouldUseHubNavRail(width, height),
      hubNavRailWidth: resolveHubNavRailWidthScaled(width),
      panelPadding: scaleSpacing(LANDSCAPE_PANEL_PADDING),
      safeTop: insets.top,
      safeBottom: insets.bottom,
      safeLeft: insets.left,
      safeRight: insets.right,
    }),
    [
      height,
      insets.bottom,
      insets.left,
      insets.right,
      insets.top,
      resolveHubNavRailWidthScaled,
      scaleSpacing,
      width,
    ],
  );
}
