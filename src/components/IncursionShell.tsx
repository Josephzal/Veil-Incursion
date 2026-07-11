import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalSafeArea from './TerminalSafeArea';
import KeepsakeInRunChoiceOverlay from './KeepsakeInRunChoiceOverlay';

interface IncursionShellProps {
  children: React.ReactNode;
}

/** Run screen wrapper — edge-to-edge under immersive OS chrome. */
export default function IncursionShell({ children }: IncursionShellProps): React.JSX.Element {
  return (
    <TerminalSafeArea edges={[]}>
      <View style={styles.root}>
        {children}
        <KeepsakeInRunChoiceOverlay />
      </View>
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
});
