import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LANDSCAPE_PANEL_PADDING } from '../../constants/landscapeLayout';
import { useLandscapeMetrics } from '../../hooks/useLandscapeMetrics';
import TerminalNavHeader from '../TerminalNavHeader';
import TerminalNavRail from '../TerminalNavRail';
import type { TerminalView } from '../../types/terminalNav';

interface TerminalHubLayoutProps {
  activeView: TerminalView;
  onSelectView: (view: TerminalView) => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  mainStyle?: StyleProp<ViewStyle>;
}

/**
 * Overworld hub shell — left nav rail on wide landscape, top nav tabs on compact.
 */
export default function TerminalHubLayout({
  activeView,
  onSelectView,
  children,
  style,
  mainStyle,
}: TerminalHubLayoutProps): React.JSX.Element {
  const { useHubNavRail, hubNavRailWidth } = useLandscapeMetrics();

  if (useHubNavRail) {
    return (
      <View style={[styles.root, styles.rootRail, style]}>
        <TerminalNavRail
          activeView={activeView}
          onSelectView={onSelectView}
          width={hubNavRailWidth}
        />
        <View style={[styles.mainRail, mainStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.root, styles.rootCompact, style]}>
      <TerminalNavHeader activeView={activeView} onSelectView={onSelectView} />
      <View style={[styles.mainCompact, mainStyle]}>{children}</View>
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
  rootCompact: {
    flexDirection: 'column',
  },
  mainRail: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    padding: LANDSCAPE_PANEL_PADDING,
  },
  mainCompact: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: LANDSCAPE_PANEL_PADDING,
    paddingTop: 8,
    paddingBottom: LANDSCAPE_PANEL_PADDING,
  },
});
