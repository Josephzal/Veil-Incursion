import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { COMBAT_DASHBOARD_SCANLINE_OPACITY, COMBAT_DASHBOARD_TEXTURE_BG } from '../../constants/combatLayout';

/** Scanline texture for dashboard deck panels — sits behind opaque UI chrome. */
export default function CombatDashboardTexturedBackdrop(): React.JSX.Element {
  const scanlinePatternId = useId().replace(/:/g, '');

  return (
    <View pointerEvents="none" style={styles.layer}>
      <View style={styles.baseFill} />
      <View style={styles.scanlineLayer}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern id={scanlinePatternId} width={1} height={4} patternUnits="userSpaceOnUse">
              <Rect width={1} height={1} fill="rgba(255, 255, 255, 0.35)" />
              <Rect y={1} width={1} height={3} fill="transparent" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${scanlinePatternId})`} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  baseFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COMBAT_DASHBOARD_TEXTURE_BG,
  },
  scanlineLayer: {
    ...StyleSheet.absoluteFill,
    opacity: COMBAT_DASHBOARD_SCANLINE_OPACITY,
  },
});
