import React from 'react';
import { StyleSheet, View } from 'react-native';

const GRID_STEP = 18;
const GRID_COLS = 24;
const GRID_ROWS = 16;

/** Faint tactical grid behind map containers. */
export default function TacticalGridBackdrop(): React.JSX.Element {
  const verticalLines = Array.from({ length: GRID_COLS + 1 }, (_, index) => index * GRID_STEP);
  const horizontalLines = Array.from({ length: GRID_ROWS + 1 }, (_, index) => index * GRID_STEP);

  return (
    <View pointerEvents="none" style={styles.root}>
      {verticalLines.map((left) => (
        <View key={`v-${left}`} style={[styles.lineV, { left }]} />
      ))}
      {horizontalLines.map((top) => (
        <View key={`h-${top}`} style={[styles.lineH, { top }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  lineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  lineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
