import React from 'react';
import { StyleSheet, View } from 'react-native';
import { VEIL_WARP_COLORS, type VeilWarpFieldMode } from './veilWarpFieldConfig';

export interface VeilWarpFieldProps {
  mode?: VeilWarpFieldMode;
  transitDriven?: boolean;
  style?: object;
}

/**
 * Native atmosphere — static fallback only (no WebGL sweep coupling).
 * Transit overlay layers its own mint/violet tint when transitDriven.
 */
export default function VeilWarpField({
  mode = 'ambientScanner',
  transitDriven = false,
  style,
}: VeilWarpFieldProps): React.JSX.Element {
  const transit = transitDriven || mode !== 'ambientScanner';
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.fill, transit ? styles.transit : null, style]}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: VEIL_WARP_COLORS.scannerBase,
  },
  transit: {
    backgroundColor: VEIL_WARP_COLORS.voidBg,
  },
});
