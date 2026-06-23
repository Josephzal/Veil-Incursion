import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalSafeArea from '../components/TerminalSafeArea';

interface IncursionShellProps {
  children: React.ReactNode;
  /** Edge-to-edge layout — no safe-area inset (combat immersive). */
  immersive?: boolean;
}

export default function IncursionShell({
  children,
  immersive = false,
}: IncursionShellProps): React.JSX.Element {
  return (
    <TerminalSafeArea edges={immersive ? [] : ['top', 'left', 'right']}>
      <View style={styles.root}>{children}</View>
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
});
