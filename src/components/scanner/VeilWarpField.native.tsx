import React from 'react';
import { StyleSheet, View } from 'react-native';
import { VEIL_WARP_COLORS } from './veilWarpFieldConfig';

/**
 * Native atmosphere — static fallback only (no WebGL sweep coupling).
 * Preserves current native scanner presentation.
 */
export default function VeilWarpField(): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.fill}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: VEIL_WARP_COLORS.scannerBase,
  },
});
