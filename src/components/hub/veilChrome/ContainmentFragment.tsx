import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { VEIL } from '../../../theme/veilTerminalTokens';

interface ContainmentFragmentProps {
  variant?: 'ring' | 'arcs' | 'seal';
  color?: string;
  opacity?: number;
  align?: 'right' | 'left' | 'center';
  size?: number;
}

/**
 * Incomplete occult containment geometry. Decorative only.
 * Never a complete centered sigil.
 */
export default function ContainmentFragment({
  variant = 'ring',
  color = VEIL.occult,
  opacity = 0.035,
  align = 'right',
  size = 120,
}: ContainmentFragmentProps): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      style={[
        styles.host,
        align === 'right' && styles.alignRight,
        align === 'left' && styles.alignLeft,
        align === 'center' && styles.alignCenter,
        { width: size, height: size, opacity },
      ]}
    >
      {variant === 'arcs' ? (
        <>
          <View
            style={[
              styles.arc,
              {
                width: size * 0.86,
                height: size * 0.86,
                borderColor: color,
                transform: [{ translateX: 6 }, { translateY: -4 }],
              },
            ]}
          />
          <View
            style={[
              styles.arc,
              {
                width: size * 0.64,
                height: size * 0.64,
                borderColor: VEIL.bone,
                opacity: 0.7,
                transform: [{ translateX: -8 }, { translateY: 10 }],
              },
            ]}
          />
        </>
      ) : variant === 'seal' ? (
        <>
          <View
            style={[
              styles.ring,
              {
                width: size * 0.9,
                height: size * 0.9,
                borderColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.segment,
              {
                width: size * 0.22,
                backgroundColor: color,
                top: size * 0.12,
                right: size * 0.18,
              },
            ]}
          />
        </>
      ) : (
        <View
          style={[
            styles.ringBroken,
            {
              width: size * 0.92,
              height: size * 0.92,
              borderColor: color,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    overflow: 'hidden',
  },
  alignRight: {
    right: 0,
    top: '50%',
    marginTop: -60,
  },
  alignLeft: {
    left: 0,
    top: 8,
  },
  alignCenter: {
    right: 16,
    top: 10,
  },
  ring: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  ringBroken: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    transform: [{ rotate: '28deg' }, { translateX: 10 }],
  },
  arc: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    borderBottomColor: 'transparent',
  },
  segment: {
    position: 'absolute',
    height: 1,
  },
});
