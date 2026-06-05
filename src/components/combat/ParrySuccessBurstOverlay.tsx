import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ParryArenaLayout } from '../../utils/parryCollision';
import ParrySuccessHalo from './ParrySuccessHalo';

interface ParrySuccessBurstOverlayProps {
  arena: ParryArenaLayout;
  burstEpoch?: number;
}

/** Success halo only — no parry rings. Shown briefly after a perfect counter. */
export default function ParrySuccessBurstOverlay({
  arena,
  burstEpoch = 0,
}: ParrySuccessBurstOverlayProps): React.JSX.Element {
  return (
    <View style={styles.root} pointerEvents="none">
      <ParrySuccessHalo
        burstEpoch={burstEpoch}
        cx={arena.cx}
        cy={arena.cy}
        baseR={arena.baseR}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 35,
    elevation: 35,
  },
});
