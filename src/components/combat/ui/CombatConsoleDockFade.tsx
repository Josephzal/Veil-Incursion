import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Concept dock wash — transparent at the top edge, solid black at the bottom.
 * Mid stops lift card readability without flattening the arena.
 */
export default function CombatConsoleDockFade(): React.JSX.Element {
  const gradId = `consoleDockFade-${useId().replace(/:/g, '')}`;

  return (
    <View style={styles.root} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#050708" stopOpacity="0.05" />
            <Stop offset="0.22" stopColor="#050708" stopOpacity="0.35" />
            <Stop offset="0.5" stopColor="#050708" stopOpacity="0.72" />
            <Stop offset="0.78" stopColor="#050708" stopOpacity="0.92" />
            <Stop offset="1" stopColor="#050708" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
});
