import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import {
  HUB_NAV_INACTIVE_BG,
  HUB_NAV_INACTIVE_BORDER,
  HUB_NAV_INACTIVE_TOP_HIGHLIGHT,
} from '../constants/hubAtmosphere';
import { resolveTerminalNavItems } from '../constants/terminalNav';
import { useTerminal } from '../context/TerminalContext';
import { TerminalView } from '../types/terminalNav';

interface TerminalNavRailProps {
  activeView: TerminalView;
  onSelectView: (view: TerminalView) => void;
  width: number;
  contentTopInset: number;
  contentBottomInset: number;
}

/** Vertical hub navigation — tactile hardware-style interface tabs. */
export default function TerminalNavRail({
  activeView,
  onSelectView,
  width,
  contentTopInset,
  contentBottomInset,
}: TerminalNavRailProps): React.JSX.Element {
  const { theme } = useTerminal();
  const navItems = resolveTerminalNavItems();
  const accentColor = theme.statusColor;

  return (
    <View
      style={[
        styles.rail,
        {
          width,
          paddingTop: contentTopInset,
          paddingBottom: contentBottomInset,
        },
      ]}
    >
      <View style={styles.navStack}>
        {navItems.map((item) => {
          const active = activeView === item.key;

          return (
            <HapticPressable
              key={item.key}
              onPress={() => onSelectView(item.key)}
              style={[
                styles.navCellPressable,
                active ? styles.navCellActive : styles.navCellInactive,
                active
                  ? {
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}24`,
                      shadowColor: accentColor,
                    }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.navLabel,
                  { color: active ? accentColor : `${theme.mutedColor}bb` },
                ]}
                numberOfLines={3}
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
    paddingHorizontal: 2,
    backgroundColor: 'transparent',
  },
  navStack: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 5,
  },
  navCellPressable: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden',
  },
  navCellInactive: {
    backgroundColor: HUB_NAV_INACTIVE_BG,
    borderWidth: 1,
    borderColor: HUB_NAV_INACTIVE_BORDER,
    borderTopWidth: 1,
    borderTopColor: HUB_NAV_INACTIVE_TOP_HIGHLIGHT,
  },
  navCellActive: {
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.85,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  navLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.1,
    textAlign: 'center',
    lineHeight: 10,
  },
});
