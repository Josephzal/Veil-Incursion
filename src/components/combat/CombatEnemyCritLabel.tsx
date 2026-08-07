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
  // Seed to current seq so remounts never replay a stale CRITICAL.
  const lastSeqRef = useRef(critImpactSeq);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const translateY = useRef(new Animated.Value(0)).current;
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
    opacity.stopAnimation();
    scale.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(1);
    scale.setValue(0.92);
    translateY.setValue(0);

    const durationMs = 860;
    const fadeOutMs = 220;
    const holdMs = Math.max(0, durationMs - fadeOutMs);

    Animated.parallel([
      Animated.sequence([
        Animated.delay(holdMs),
        Animated.timing(opacity, {
          toValue: 0,
          duration: fadeOutMs,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.timing(scale, {
        toValue: 1.06,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: -56,
        duration: durationMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(({ finished }) => {
      if (finished) setVisible(false);
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
