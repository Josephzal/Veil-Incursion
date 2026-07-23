import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LANDSCAPE_PRIMARY_SPLIT_RATIO, LANDSCAPE_PANEL_GAP } from '../../constants/landscapeLayout';
import { useLandscapeMetrics } from '../../hooks/useLandscapeMetrics';
import { useResponsiveScale } from '../../hooks/useResponsiveScale';

interface LandscapeSplitPaneProps {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  /** Primary flex share when split horizontally (0–1). */
  primaryRatio?: number;
  /** When false, always stack vertically even on wide screens. */
  allowHorizontalSplit?: boolean;
  /** Override default pane gap (scaled LANDSCAPE_PANEL_GAP). */
  gap?: number;
  style?: StyleProp<ViewStyle>;
  primaryStyle?: StyleProp<ViewStyle>;
  secondaryStyle?: StyleProp<ViewStyle>;
}

/**
 * Two-pane run layout — side-by-side on wide landscape, stacked on compact height.
 */
export default function LandscapeSplitPane({
  primary,
  secondary,
  primaryRatio = LANDSCAPE_PRIMARY_SPLIT_RATIO,
  allowHorizontalSplit = true,
  gap,
  style,
  primaryStyle,
  secondaryStyle,
}: LandscapeSplitPaneProps): React.JSX.Element {
  const { useHorizontalSplit } = useLandscapeMetrics();
  const { scaleSpacing } = useResponsiveScale();
  const horizontal = allowHorizontalSplit && useHorizontalSplit;
  const secondaryFlex = Math.max(0.2, 1 - primaryRatio);
  const paneGap = gap ?? scaleSpacing(LANDSCAPE_PANEL_GAP);

  if (horizontal) {
    return (
      <View style={[styles.root, styles.rootHorizontal, { gap: paneGap }, style]}>
        <View style={[styles.primaryHorizontal, { flex: primaryRatio }, primaryStyle]}>
          {primary}
        </View>
        <View style={[styles.secondaryHorizontal, { flex: secondaryFlex }, secondaryStyle]}>
          {secondary}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, styles.rootVertical, { gap: paneGap }, style]}>
      <View style={[styles.primaryVertical, primaryStyle]}>{primary}</View>
      <View style={[styles.secondaryVertical, secondaryStyle]}>{secondary}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  rootHorizontal: {
    flexDirection: 'row',
  },
  rootVertical: {
    flexDirection: 'column',
  },
  primaryHorizontal: {
    minWidth: 0,
    minHeight: 0,
  },
  secondaryHorizontal: {
    minWidth: 0,
    minHeight: 0,
  },
  primaryVertical: {
    flex: 1,
    minHeight: 0,
  },
  secondaryVertical: {
    flexShrink: 0,
    minHeight: 0,
  },
});
