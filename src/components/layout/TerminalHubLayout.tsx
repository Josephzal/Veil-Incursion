import React from 'react';
import { ImageBackground, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { HUB_ATMOSPHERE_BACKGROUND, HUB_ATMOSPHERE_SCRIM } from '../../constants/hubAtmosphere';
import { HUB_NAV_MAIN_GAP, LANDSCAPE_PANEL_PADDING } from '../../constants/landscapeLayout';
import { resolveImmersiveFooterInset, resolveImmersiveTopInset } from '../../constants/immersiveLayout';
import { useLandscapeMetrics } from '../../hooks/useLandscapeMetrics';
import { useResponsiveScale } from '../../hooks/useResponsiveScale';
import TerminalNavRail from '../TerminalNavRail';
import type { TerminalView } from '../../types/terminalNav';

interface TerminalHubLayoutProps {
  activeView: TerminalView;
  onSelectView: (view: TerminalView) => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  mainStyle?: StyleProp<ViewStyle>;
}

/** Shared top inset so nav buttons align with the CabalPanel slate border. */
export function resolveHubContentTopInset(
  safeTop: number,
  panelPadding: number = LANDSCAPE_PANEL_PADDING,
): number {
  return panelPadding + resolveImmersiveTopInset(safeTop);
}

/** Overworld hub shell — atmospheric backdrop, left nav rail, main viewport. */
export default function TerminalHubLayout({
  activeView,
  onSelectView,
  children,
  style,
  mainStyle,
}: TerminalHubLayoutProps): React.JSX.Element {
  const { hubNavRailWidth, safeTop, safeBottom, safeRight, panelPadding } = useLandscapeMetrics();
  const { scaleSpacing } = useResponsiveScale();
  const contentTopInset = resolveHubContentTopInset(safeTop, panelPadding);
  const contentBottomInset = resolveImmersiveFooterInset(safeBottom);
  const mainRailStyle = {
    paddingTop: contentTopInset,
    paddingRight: Math.max(scaleSpacing(6), safeRight),
    paddingBottom: contentBottomInset,
    paddingLeft: scaleSpacing(2),
  };

  return (
    <ImageBackground
      source={HUB_ATMOSPHERE_BACKGROUND}
      style={[styles.root, styles.rootRail, style]}
      resizeMode="cover"
    >
      <View style={[styles.scrim, styles.scrimPointerLock]} />
      <View style={styles.content}>
        <TerminalNavRail
          activeView={activeView}
          onSelectView={onSelectView}
          width={hubNavRailWidth}
          contentTopInset={contentTopInset}
          contentBottomInset={contentBottomInset}
        />
        <View style={[styles.mainGap, { width: scaleSpacing(HUB_NAV_MAIN_GAP) }]} />
        <View style={[styles.mainRail, mainRailStyle, mainStyle]}>{children}</View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  rootRail: {
    flexDirection: 'row',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: HUB_ATMOSPHERE_SCRIM,
  },
  scrimPointerLock: {
    pointerEvents: 'none',
  },
  content: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    zIndex: 1,
  },
  mainGap: {
    flexShrink: 0,
  },
  mainRail: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
});
