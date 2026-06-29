import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

const SCANLINE_OPACITY = 0.028;
const STATIC_OPACITY = 0.035;

/** Faint CRT scanlines + static grain for terminal surfaces (modals, panels). */
export default function TerminalOverlay(): React.JSX.Element {
  const uid = useId().replace(/:/g, '');
  const scanlineId = `terminalScanlines-${uid}`;
  const staticId = `terminalStatic-${uid}`;

  return (
    <View style={styles.root}>
      <View style={styles.scanlineLayer}>
        <Svg width="100%" height="100%" style={styles.svgFill}>
          <Defs>
            <Pattern id={scanlineId} width={1} height={4} patternUnits="userSpaceOnUse">
              <Rect width={1} height={1} fill="rgba(0, 0, 0, 0.55)" />
              <Rect y={1} width={1} height={3} fill="transparent" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${scanlineId})`} />
        </Svg>
      </View>

      <View style={styles.staticLayer}>
        <Svg width="100%" height="100%" style={styles.svgFill}>
          <Defs>
            <Pattern id={staticId} width={3} height={3} patternUnits="userSpaceOnUse">
              <Rect width={1} height={1} fill="rgba(255, 255, 255, 0.12)" />
              <Rect x={2} y={1} width={1} height={1} fill="rgba(255, 255, 255, 0.06)" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${staticId})`} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  svgFill: {
    ...StyleSheet.absoluteFill,
  },
  scanlineLayer: {
    ...StyleSheet.absoluteFill,
    opacity: SCANLINE_OPACITY,
  },
  staticLayer: {
    ...StyleSheet.absoluteFill,
    opacity: STATIC_OPACITY,
  },
});
