import React from 'react';
import { StyleSheet, View } from 'react-native';

interface CombatDashboardCommandColumnProps {
  children: React.ReactNode;
}

/** Left dashboard column — vitals + AP/end turn + 2×2 ability grid. */
export default function CombatDashboardCommandColumn({
  children,
}: CombatDashboardCommandColumnProps): React.JSX.Element {
  return (
    <View style={styles.column}>
      <View style={styles.deckHost}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  deckHost: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
