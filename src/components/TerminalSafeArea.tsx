import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useTerminal } from '../context/TerminalContext';

interface TerminalSafeAreaProps {
  children: React.ReactNode;
  /** Edge-to-edge by default — pass explicit edges to reserve system inset bands. */
  edges?: Edge[];
  style?: ViewStyle;
}

export default function TerminalSafeArea({
  children,
  edges = [],
  style,
}: TerminalSafeAreaProps): React.JSX.Element {
  const { theme } = useTerminal();

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.backgroundColor }, style]}
      edges={edges}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
