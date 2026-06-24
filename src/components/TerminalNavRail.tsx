import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { LANDSCAPE_PANEL_PADDING } from '../constants/landscapeLayout';
import { resolveImmersiveFooterInset, resolveImmersiveTopInset } from '../constants/immersiveLayout';
import { resolveTerminalNavItems } from '../constants/terminalNav';
import { useTerminal } from '../context/TerminalContext';
import { useLandscapeMetrics } from '../hooks/useLandscapeMetrics';
import { TerminalView } from '../types/terminalNav';

interface TerminalNavRailProps {
  activeView: TerminalView;
  onSelectView: (view: TerminalView) => void;
  width: number;
}

/** Vertical hub navigation for wide landscape terminals. */
export default function TerminalNavRail({
  activeView,
  onSelectView,
  width,
}: TerminalNavRailProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { safeTop, safeBottom } = useLandscapeMetrics();
  const navItems = resolveTerminalNavItems();

  return (
    <View
      style={[
        styles.rail,
        {
          width,
          borderRightColor: theme.borderColor,
          backgroundColor: theme.backgroundColor,
          paddingTop: LANDSCAPE_PANEL_PADDING + resolveImmersiveTopInset(safeTop),
          paddingBottom: resolveImmersiveFooterInset(safeBottom),
        },
      ]}
    >
      <Text style={[styles.railTitle, { color: theme.mutedColor }]}>TERMINAL // NAV</Text>

      <View style={styles.navStack}>
        {navItems.map((item) => {
          const active = activeView === item.key;
          return (
            <HapticPressable
              key={item.key}
              onPress={() => onSelectView(item.key)}
              style={[
                styles.navCell,
                {
                  borderColor: active ? theme.statusColor : theme.borderColor,
                  borderWidth: active ? theme.borderWidth + 1 : 1,
                  backgroundColor: active ? `${theme.primaryColor}14` : 'transparent',
                },
              ]}
            >
              <Text
                style={[styles.navLabel, { color: active ? theme.statusColor : theme.mutedColor }]}
                numberOfLines={4}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {item.label}
              </Text>
            </HapticPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexShrink: 0,
    alignSelf: 'stretch',
    borderRightWidth: 1,
    paddingHorizontal: 3,
    gap: 6,
  },
  railTitle: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.8,
    textAlign: 'center',
    flexShrink: 0,
  },
  navStack: {
    flex: 1,
    justifyContent: 'space-evenly',
    gap: 4,
  },
  navCell: {
    flex: 1,
    maxHeight: 48,
    minHeight: 24,
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '90%',
  },
  navLabel: {
    fontFamily: 'monospace',
    fontSize: 6,
    fontWeight: '700',
    letterSpacing: 0.25,
    textAlign: 'center',
    lineHeight: 8,
  },
});
