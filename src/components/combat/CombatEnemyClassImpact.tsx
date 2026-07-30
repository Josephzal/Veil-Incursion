import React from 'react';
import { StyleSheet, View } from 'react-native';

interface CombatEnemyClassImpactProps {
  impactFxSeq?: number;
  impactFxKind?: string;
  children: React.ReactNode;
}

/**
 * Class impact overlays (mustard star / purple burst / red slash fills) removed
 * from normal combat. Weapon presentation host owns contact feedback.
 * Preserves layout wrapper so unit trees stay stable.
 */
export default function CombatEnemyClassImpact({
  children,
}: CombatEnemyClassImpactProps): React.JSX.Element {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
});
