import React from 'react';
import { StyleSheet, View } from 'react-native';

interface EnemyEntityProps {
  /** Animated sprite subtree — breathing/motion applies here only. */
  sprite: React.ReactNode;
  vitals?: React.ReactNode;
  showVitals?: boolean;
}

/** Static hostile shell — sprite animates independently of HP/fracture bars. */
export default function EnemyEntity({
  sprite,
  vitals,
  showVitals = false,
}: EnemyEntityProps): React.JSX.Element {
  return (
    <View style={styles.staticContainer}>
      <View style={styles.spriteSlot}>{sprite}</View>
      {showVitals && vitals ? (
        <View style={styles.hpBarContainer} pointerEvents="none">
          {vitals}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  staticContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  spriteSlot: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  hpBarContainer: {
    position: 'absolute',
    bottom: -20,
    width: '57.5%',
    alignSelf: 'center',
    zIndex: 14,
  },
});
