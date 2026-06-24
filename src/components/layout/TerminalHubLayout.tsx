import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { HUB_NAV_MAIN_GAP, LANDSCAPE_PANEL_PADDING } from '../../constants/landscapeLayout';
import { resolveImmersiveFooterInset } from '../../constants/immersiveLayout';
import { useLandscapeMetrics } from '../../hooks/useLandscapeMetrics';
import TerminalNavRail from '../TerminalNavRail';
import type { TerminalView } from '../../types/terminalNav';

interface TerminalHubLayoutProps {
  activeView: TerminalView;
  onSelectView: (view: TerminalView) => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  mainStyle?: StyleProp<ViewStyle>;
}

/** Overworld hub shell — always uses left nav rail for full viewport height. */
export default function TerminalHubLayout({
  activeView,
  onSelectView,
  children,
  style,
  mainStyle,
}: TerminalHubLayoutProps): React.JSX.Element {
  const { hubNavRailWidth, safeTop, safeBottom, safeRight } = useLandscapeMetrics();
  const mainRailStyle = {
    paddingTop: LANDSCAPE_PANEL_PADDING + safeTop,
    paddingRight: LANDSCAPE_PANEL_PADDING + safeRight,
    paddingBottom: resolveImmersiveFooterInset(safeBottom),
    paddingLeft: 4,
  };

  return (
    <View style={[styles.root, styles.rootRail, style]}>
      <TerminalNavRail
        activeView={activeView}
        onSelectView={onSelectView}
        width={hubNavRailWidth}
      />
      <View style={styles.mainGap} />
      <View style={[styles.mainRail, mainRailStyle, mainStyle]}>{children}</View>
    </View>
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
  mainGap: {
    width: HUB_NAV_MAIN_GAP,
    flexShrink: 0,
  },
  mainRail: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
});
