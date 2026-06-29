import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import {
  DESKTOP_BADGE_PRIMARY_RATIO,
  DESKTOP_MIN_WIDTH,
  DESKTOP_SAFEHOUSE_LEFT_RATIO,
  DESKTOP_SCANNER_PRIMARY_RATIO,
  resolveDesktopHubNavRailWidth,
  resolveDesktopScale,
  scaleSpacingMetric,
  scaleUiMetric,
} from '../constants/responsiveScale';
import { LANDSCAPE_PRIMARY_SPLIT_RATIO } from '../constants/landscapeLayout';

export interface ResponsiveScaleMetrics {
  /** True when running on web at desktop width. */
  isDesktop: boolean;
  isWeb: boolean;
  screenWidth: number;
  screenHeight: number;
  /** Always 1.0 on iOS/Android. */
  scale: number;
  scaleSize: (value: number) => number;
  scaleSpacing: (value: number) => number;
  hubNavRailWidth: (screenWidth: number) => number;
  scannerPrimaryRatio: number;
  badgePrimaryRatio: number;
  safehouseLeftRatio: number;
}

export function useResponsiveScale(): ResponsiveScaleMetrics {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= DESKTOP_MIN_WIDTH;
  const scale = isDesktop ? resolveDesktopScale(width) : 1;

  return useMemo(
    () => ({
      isDesktop,
      isWeb,
      screenWidth: width,
      screenHeight: height,
      scale,
      scaleSize: (value: number) => scaleUiMetric(value, scale),
      scaleSpacing: (value: number) => scaleSpacingMetric(value, scale),
      hubNavRailWidth: (screenWidth: number) => resolveDesktopHubNavRailWidth(screenWidth, scale),
      scannerPrimaryRatio: isDesktop ? DESKTOP_SCANNER_PRIMARY_RATIO : LANDSCAPE_PRIMARY_SPLIT_RATIO,
      badgePrimaryRatio: isDesktop ? DESKTOP_BADGE_PRIMARY_RATIO : 0.58,
      safehouseLeftRatio: isDesktop ? DESKTOP_SAFEHOUSE_LEFT_RATIO : 0.5,
    }),
    [height, isDesktop, isWeb, scale, width],
  );
}
