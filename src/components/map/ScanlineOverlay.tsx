import React from 'react';
import { StyleSheet, View } from 'react-native';

const SCANLINE_COUNT = 48;

/** CRT-style horizontal scanline overlay — pointerEvents none. */
export default function ScanlineOverlay(): React.JSX.Element {
  return (
    <View pointerEvents="none" style={styles.root}>
      {Array.from({ length: SCANLINE_COUNT }, (_, index) => (
        <View key={index} style={styles.line} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    opacity: 0.12,
  },
  line: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});
