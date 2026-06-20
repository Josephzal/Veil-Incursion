import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CLASS_DEFINITIONS } from '../data/classes';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useTerminal } from '../context/TerminalContext';
import { ALL_OPERATIVE_CLASSES } from '../types/operativeClass';
import type { ClassType } from '../types/game';
import { TerminalView } from '../types/terminalNav';

const NAV_ITEMS: Array<{ key: TerminalView; label: string }> = [
  { key: 'BADGE', label: 'IDENTITY BADGE' },
  { key: 'MAP', label: 'SHADOW WAR' },
  { key: 'SAFEHOUSE', label: 'SAFEHOUSE' },
];

const CLASS_SHORT_LABEL: Record<ClassType, string> = {
  AEGIS: 'AEGIS',
  HEX_SHOT: 'HEX SHOT',
  ENVOY: 'ENVOY',
};

interface TerminalNavHeaderProps {
  activeView: TerminalView;
  onSelectView: (view: TerminalView) => void;
}

export default function TerminalNavHeader({
  activeView,
  onSelectView,
}: TerminalNavHeaderProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, setActiveClass } = usePlayerAccount();

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.backgroundColor }]}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.borderColor,
            borderBottomWidth: theme.borderWidth,
          },
        ]}
      >
        {NAV_ITEMS.map((item) => {
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
              <Text
                style={[
                  styles.navLabel,
                  { color: active ? theme.statusColor : theme.mutedColor },
                ]}
                numberOfLines={2}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.classRow,
          {
            borderBottomColor: theme.borderColor,
            borderBottomWidth: theme.borderWidth,
          },
        ]}
      >
        <Text style={[styles.classRowLabel, { color: theme.mutedColor }]}>CLASS</Text>
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
  );
}

const styles = StyleSheet.create({
  wrapper: { zIndex: 10 },
  header: {
    flexDirection: 'row',
  },
  navCell: {
    flex: 1,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1,
  },
  navLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: 10,
  },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  classRowLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    width: 36,
  },
  classCell: {
    flex: 1,
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
