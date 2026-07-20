import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Top chrome wash — solid black at the top edge, fading clear downward.
 * Mirrors the bottom console dock fade.
 */
export default function CombatTopDockFade(): React.JSX.Element {
  const gradId = `topDockFade-${useId().replace(/:/g, '')}`;

  return (
    <View style={styles.root} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#050708" stopOpacity="0.82" />
            <Stop offset="0.35" stopColor="#050708" stopOpacity="0.45" />
            <Stop offset="0.7" stopColor="#050708" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#050708" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '18%',
    zIndex: 2,
  },
});
