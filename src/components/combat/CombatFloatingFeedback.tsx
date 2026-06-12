import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { CombatFeedbackEvent } from '../../types/combatChance';

const MONO = 'monospace';

type FloatingFeedbackKind = Exclude<CombatFeedbackEvent['kind'], 'PLAYER_CRIT'>;

const LABELS: Record<FloatingFeedbackKind, string> = {
  PLAYER_EVADE: '[ MISS ]',
  ENEMY_EVADE: '[ EVADED ]',
  ENEMY_CRIT: '[ CRITICAL WOUND ]',
};

const COLORS: Record<FloatingFeedbackKind, string> = {
  PLAYER_EVADE: '#9ca3af',
  ENEMY_EVADE: '#9ca3af',
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
  const translateY = React.useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (!event || event.kind === 'PLAYER_CRIT') return;
    setVisible(event.kind);
    opacity.setValue(0);
    scale.setValue(0.9);
    translateY.setValue(10);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -6,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        delay: 320,
        useNativeDriver: true,
      }).start(() => {
        setVisible(null);
        onComplete?.();
      });
    });
  }, [event, onComplete, opacity, scale, translateY]);

  if (!visible) return null;

  const color = COLORS[visible];

  return (
    <View style={styles.host} pointerEvents="none">
      <Animated.Text
        style={[
          styles.label,
          {
            color,
            opacity,
            transform: [{ scale }, { translateY }],
            textShadowColor: 'rgba(0,0,0,0.85)',
            textShadowRadius: 4,
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
  label: {
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    textShadowOffset: { width: 0, height: 1 },
  },
});
