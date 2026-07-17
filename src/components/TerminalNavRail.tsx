import React from 'react';
import { StyleSheet, View } from 'react-native';
import TacticalButton from './TacticalButton';
import { resolveTerminalNavItems } from '../constants/terminalNav';
import { useResponsiveScale } from '../hooks/useResponsiveScale';
import { useTerminal } from '../context/TerminalContext';
import { TerminalView } from '../types/terminalNav';
import { SELECT_ACCENT } from '../constants/dossierSurface';

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
  const { scaleSpacing } = useResponsiveScale();
  const navItems = resolveTerminalNavItems();

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
      <View style={[styles.navStack, { gap: scaleSpacing(5) }]}>
        {navItems.map((item) => {
          const isActive = activeView === item.key;
          return (
            <TacticalButton
              key={item.key}
              label={item.label}
              active={isActive}
              onPress={() => onSelectView(item.key)}
              accentColor={isActive ? SELECT_ACCENT : theme.statusColor}
              mutedColor={theme.mutedColor}
              variant="rail"
              style={isActive ? styles.activeRailTab : undefined}
            />
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
  },
  activeRailTab: {
    borderWidth: 1,
    borderColor: 'rgba(88, 223, 168, 0.4)',
  },
});
