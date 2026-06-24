import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CLASS_DEFINITIONS } from '../data/classes';
import { LANDSCAPE_PANEL_PADDING } from '../constants/landscapeLayout';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { ALL_OPERATIVE_CLASSES } from '../types/operativeClass';
import type { ClassType } from '../types/game';
import { TERMINAL_NAV_ITEMS } from '../constants/terminalNav';
import { TerminalView } from '../types/terminalNav';

const CLASS_SHORT_LABEL: Record<ClassType, string> = {
  AEGIS: 'AEGIS',
  HEX_SHOT: 'HEX SHOT',
  ENVOY: 'ENVOY',
};

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
  const { account, setActiveClass } = usePlayerAccount();

  return (
    <View
      style={[
        styles.rail,
        {
          width,
          borderRightColor: theme.borderColor,
          backgroundColor: theme.backgroundColor,
        },
      ]}
    >
      <Text style={[styles.railTitle, { color: theme.mutedColor }]}>TERMINAL // NAV</Text>

      <View style={styles.navStack}>
        {TERMINAL_NAV_ITEMS.map((item) => {
          const active = activeView === item.key;
          return (
            <Pressable
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
              <Text style={[styles.navShort, { color: active ? theme.statusColor : theme.mutedColor }]}>
                {item.shortLabel}
              </Text>
              <Text
                style={[styles.navLabel, { color: active ? theme.statusColor : theme.mutedColor }]}
                numberOfLines={2}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.classSection, { borderTopColor: theme.borderColor }]}>
        <Text style={[styles.classRowLabel, { color: theme.mutedColor }]}>CLASS</Text>
        <View style={styles.classStack}>
          {ALL_OPERATIVE_CLASSES.map((classId) => {
            const active = account.activeClass === classId;
            const unlocked = account.unlockedClasses.includes(classId);
            const label = CLASS_SHORT_LABEL[classId];
            const fullName = CLASS_DEFINITIONS[classId].displayName;

            return (
              <Pressable
                key={classId}
                disabled={!unlocked}
                onPress={() => setActiveClass(classId)}
                style={({ pressed }) => [
                  styles.classCell,
                  {
                    borderColor: active ? theme.statusColor : theme.borderColor,
                    borderWidth: active ? theme.borderWidth + 1 : 1,
                    backgroundColor: active ? `${theme.statusColor}22` : 'transparent',
                    opacity: !unlocked ? 0.35 : pressed ? 0.75 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${fullName}`}
                accessibilityState={{ selected: active, disabled: !unlocked }}
              >
                <Text
                  style={[
                    styles.classLabel,
                    { color: active ? theme.statusColor : unlocked ? theme.textColor : theme.mutedColor },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexShrink: 0,
    alignSelf: 'stretch',
    borderRightWidth: 1,
    paddingTop: LANDSCAPE_PANEL_PADDING,
    paddingHorizontal: 8,
    paddingBottom: LANDSCAPE_PANEL_PADDING,
    gap: 10,
  },
  railTitle: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1,
    textAlign: 'center',
  },
  navStack: {
    gap: 6,
  },
  navCell: {
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navShort: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  navLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
    lineHeight: 10,
  },
  classSection: {
    marginTop: 'auto',
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 6,
  },
  classRowLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  classStack: {
    gap: 6,
  },
  classCell: {
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
