import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalSafeArea from '../components/TerminalSafeArea';

interface IncursionShellProps {
  children: React.ReactNode;
}

export default function IncursionShell({ children }: IncursionShellProps): React.JSX.Element {
  return (
    <TerminalSafeArea edges={['top', 'left', 'right']}>
      <View style={styles.root}>{children}</View>
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
});
