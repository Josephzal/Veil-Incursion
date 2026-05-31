import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useTerminal } from '../context/TerminalContext';

interface TerminalSafeAreaProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
}

export default function TerminalSafeArea({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
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
