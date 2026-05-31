import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTerminal } from '../context/TerminalContext';
import { TerminalView } from '../types/terminalNav';

const NAV_ITEMS: Array<{ key: TerminalView; label: string }> = [
  { key: 'BADGE', label: '01 // IDENTITY BADGE' },
  { key: 'MAP', label: '02 // VECTOR MAP' },
  { key: 'MANIFEST', label: '03 // ASSET MANIFEST' },
];

interface TerminalNavHeaderProps {
  activeView: TerminalView;
  onSelectView: (view: TerminalView) => void;
}

export default function TerminalNavHeader({
  activeView,
  onSelectView,
}: TerminalNavHeaderProps): React.JSX.Element {
  const { theme } = useTerminal();

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: theme.borderColor,
          borderBottomWidth: theme.borderWidth,
          backgroundColor: theme.backgroundColor,
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
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    zIndex: 10,
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
});
