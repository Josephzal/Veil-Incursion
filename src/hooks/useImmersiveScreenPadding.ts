import { StyleSheet, type ViewStyle } from 'react-native';
import { LANDSCAPE_PANEL_PADDING } from '../constants/landscapeLayout';
import {
  resolveImmersiveContentPadding,
  resolveImmersiveFooterInset,
  resolveImmersiveHorizontalInset,
} from '../constants/immersiveLayout';
import { useLandscapeMetrics } from './useLandscapeMetrics';

/** Edge-to-edge screen padding — applies system inset gutters only where needed. */
export function useImmersiveScreenPadding(basePadding = LANDSCAPE_PANEL_PADDING): ViewStyle {
  const { safeTop, safeBottom, safeLeft, safeRight } = useLandscapeMetrics();
  const horizontal = resolveImmersiveHorizontalInset(safeLeft, safeRight);

  return {
    paddingTop: resolveImmersiveContentPadding(safeTop, basePadding),
    paddingBottom: resolveImmersiveFooterInset(safeBottom),
    paddingLeft: basePadding + horizontal.paddingLeft,
    paddingRight: basePadding + horizontal.paddingRight,
  };
}

/** @deprecated Prefer useImmersiveScreenPadding(). */
export function useImmersiveScreenPaddingStyle(basePadding = LANDSCAPE_PANEL_PADDING): ViewStyle {
  return useImmersiveScreenPadding(basePadding);
}

export const immersiveScreenStyles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
});
