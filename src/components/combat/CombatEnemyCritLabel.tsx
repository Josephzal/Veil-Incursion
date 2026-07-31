import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { textGlow } from '../../utils/adaptiveStyles';
import { isWardenStrikePresentationActive } from '../../data/wardenStrikePresentation';
import type { DamageChannel } from '../../types/aegisCombat';

const MONO = 'monospace';

function critColor(channel?: DamageChannel): string {
  return channel === 'OCCULT' ? '#c084fc' : '#fbbf24';
}

interface CombatEnemyCritLabelProps {
  critImpactSeq?: number;
  channel?: DamageChannel;
}

/**
 * Compact [ CRITICAL ] floater for non-Warden hits.
 * During Warden, CombatWardenCalloutStack owns CRITICAL so remounted portals
 * cannot republish a stale critImpactSeq onto the wrong target.
 */
export default function CombatEnemyCritLabel({
  critImpactSeq = 0,
  channel,
}: CombatEnemyCritLabelProps): React.JSX.Element | null {
  const lastSeqRef = useRef(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const translateY = useRef(new Animated.Value(6)).current;
  const [visible, setVisible] = React.useState(false);

  useEffect(() => {
    if (isWardenStrikePresentationActive()) {
      setVisible(false);
      return;
    }
    // critImpactSeq is only advanced when critical HP damage was dealt.
    if (critImpactSeq <= 0 || critImpactSeq === lastSeqRef.current) return;
    lastSeqRef.current = critImpactSeq;
    setVisible(true);
    opacity.setValue(0);
    scale.setValue(0.75);
    translateY.setValue(8);

    // Sit clearly above the damage number.
    const peakY = -22;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(scale, {
        toValue: 1.08,
        duration: 160,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: peakY,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        delay: 180,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start(() => setVisible(false));
    });
  }, [channel, critImpactSeq, opacity, scale, translateY]);

  if (!visible) return null;

  const color = critColor(channel);

  return (
    <Animated.Text
      style={[
        styles.label,
        {
          color,
          opacity,
          transform: [{ scale }, { translateY }],
          ...textGlow({ color, radius: 8, offset: { width: 0, height: 0 } }),
          pointerEvents: 'none',
        },
      ]}
    >
      CRITICAL
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textAlign: 'center'
  },
});
