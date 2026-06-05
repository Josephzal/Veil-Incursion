import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import PersistentTerminalLog from './PersistentTerminalLog';

interface MacroLogAnchoredLayoutProps {
  children: React.ReactNode;
  showMacroLog?: boolean;
  style?: ViewStyle;
  showInventory?: boolean;
  onInventoryPress?: () => void;
}

/**
 * Strict two-zone column: scrollable/flex content above, macro log pinned to screen baseline.
 * Use inside IncursionShell for combat, scanner, narrative, boon, and sanctuary screens.
 */
export default function MacroLogAnchoredLayout({
  children,
  showMacroLog = true,
  style,
  showInventory = false,
  onInventoryPress,
}: MacroLogAnchoredLayoutProps): React.JSX.Element {
  return (
    <View style={[styles.root, style]}>
      <View style={styles.content}>{children}</View>
      {showMacroLog ? (
        <PersistentTerminalLog
          docked
          showEndRun
          showInventory={showInventory}
          onInventoryPress={onInventoryPress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
});
