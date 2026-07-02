import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

interface HarvestContainmentReticleProps {
  accentColor: string;
}

/** Low-opacity targeting overlay for the containment field. */
export default function HarvestContainmentReticle({
  accentColor,
}: HarvestContainmentReticleProps): React.JSX.Element {
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Svg width="100%" height="100%" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet">
        <Circle
          cx="100"
          cy="100"
          r="72"
          stroke={accentColor}
          strokeWidth="1"
          fill="none"
          opacity={0.35}
        />
        <Circle
          cx="100"
          cy="100"
          r="44"
          stroke={accentColor}
          strokeWidth="1"
          fill="none"
          opacity={0.25}
        />
        <Line x1="100" y1="18" x2="100" y2="42" stroke={accentColor} strokeWidth="1" opacity={0.3} />
        <Line x1="100" y1="158" x2="100" y2="182" stroke={accentColor} strokeWidth="1" opacity={0.3} />
        <Line x1="18" y1="100" x2="42" y2="100" stroke={accentColor} strokeWidth="1" opacity={0.3} />
        <Line x1="158" y1="100" x2="182" y2="100" stroke={accentColor} strokeWidth="1" opacity={0.3} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.1,
    zIndex: 0,
  },
});
