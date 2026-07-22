import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { VEIL } from '../../../theme/veilTerminalTokens';

interface OccultInterferenceProps {
  active?: boolean;
  reduceMotion?: boolean;
  color?: string;
}

/**
 * Faint selected-record contamination: partial ring + displaced edge.
 * Decorative only; text remains stationary.
 */
export default function OccultInterference({
  active = false,
  reduceMotion = false,
  color = VEIL.occult,
}: OccultInterferenceProps): React.JSX.Element | null {
  const shift = useRef(new Animated.Value(reduceMotion || !active ? 0 : 3)).current;

  useEffect(() => {
    if (!active || reduceMotion) {
      shift.setValue(0);
      return undefined;
    }
    shift.setValue(3);
    const anim = Animated.timing(shift, {
      toValue: 0,
      duration: 190,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [active, reduceMotion, shift]);

  if (!active) return null;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={styles.host}
    >
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: color,
            transform: [{ translateX: shift }, { translateY: Animated.multiply(shift, -0.4) }],
          },
        ]}
      />
      <View style={[styles.smear, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    right: 0,
    top: '18%',
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    opacity: 0.03,
  },
  smear: {
    position: 'absolute',
    right: 10,
    top: 8,
    bottom: 8,
    width: 1,
    opacity: 0.028,
  },
});
