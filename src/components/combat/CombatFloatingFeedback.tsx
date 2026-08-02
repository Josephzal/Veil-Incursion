import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../../utils/platformMotion';
import { textGlow } from '../../utils/adaptiveStyles';
import type { CombatFeedbackEvent } from '../../types/combatChance';

const MONO = 'monospace';

type FloatingFeedbackKind = Exclude<CombatFeedbackEvent['kind'], 'PLAYER_CRIT' | 'ENEMY_EVADE'>;

const LABELS: Record<FloatingFeedbackKind, string> = {
  PLAYER_EVADE: '[ MISS ]',
  ENEMY_CRIT: '[ CRITICAL WOUND ]',
};

const COLORS: Record<FloatingFeedbackKind, string> = {
  PLAYER_EVADE: '#9ca3af',
  ENEMY_CRIT: '#ef4444',
};

interface CombatFloatingFeedbackProps {
  event: CombatFeedbackEvent | null;
  onComplete?: () => void;
}

export default function CombatFloatingFeedback({
  event,
  onComplete,
}: CombatFloatingFeedbackProps): React.JSX.Element | null {
  const [visible, setVisible] = useState<FloatingFeedbackKind | null>(null);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.85)).current;
  const translateY = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!event || event.kind === 'PLAYER_CRIT' || event.kind === 'ENEMY_EVADE') return;
    setVisible(event.kind);
    opacity.stopAnimation();
    scale.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(0);
    scale.setValue(0.92);
    translateY.setValue(0);

    const durationMs = 900;
    const fadeInMs = 100;
    const fadeOutMs = 260;
    const holdMs = Math.max(0, durationMs - fadeInMs - fadeOutMs);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: fadeInMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(holdMs),
        Animated.timing(opacity, {
          toValue: 0,
          duration: fadeOutMs,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.timing(scale, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: -52,
        duration: durationMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setVisible(null);
      onComplete?.();
    });
  }, [event, onComplete, opacity, scale, translateY]);

  if (!visible) return null;

  const color = COLORS[visible];

  return (
    <View style={[styles.host, styles.hostPointerLock]}>
      <Animated.Text
        style={[
          styles.label,
          {
            color,
            opacity,
            transform: [{ scale }, { translateY }],
            ...textGlow({ color: 'rgba(0,0,0,0.85)', radius: 4, offset: { width: 0, height: 1 } }),
          },
        ]}
      >
        {LABELS[visible]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  hostPointerLock: {
    pointerEvents: 'none',
  },
  label: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
});
