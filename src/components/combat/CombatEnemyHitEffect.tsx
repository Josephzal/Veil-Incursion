import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface CombatEnemyHitEffectProps {
  hitFlashSeq?: number;
  /** Kept for API compatibility — full portrait tint removed (Phase 3M). */
  portraitSource?: unknown;
  children: React.ReactNode;
}

/**
 * Localized contact spark on damage — no opaque red full-character silhouette.
 */
export default function CombatEnemyHitEffect({
  hitFlashSeq = 0,
  children,
}: CombatEnemyHitEffectProps): React.JSX.Element {
  const lastSeqRef = useRef(0);
  const flashOpacity = useSharedValue(0);
  const flashScale = useSharedValue(0.6);

  useEffect(() => {
    if (hitFlashSeq <= 0 || hitFlashSeq === lastSeqRef.current) return;
    lastSeqRef.current = hitFlashSeq;

    flashOpacity.value = withSequence(
      withTiming(0.9, { duration: 40, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) }),
    );
    flashScale.value = withSequence(
      withTiming(1.15, { duration: 50, easing: Easing.out(Easing.back(1.2)) }),
      withTiming(0.8, { duration: 130 }),
    );
  }, [flashOpacity, flashScale, hitFlashSeq]);

  const sparkStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
    transform: [{ scale: flashScale.value }],
  }));

  return (
    <View style={styles.root}>
      {children}
      <Animated.View style={[styles.sparkHost, sparkStyle]} pointerEvents="none">
        <View style={styles.spark} />
        <View style={styles.sparkEdge} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  sparkHost: {
    position: 'absolute',
    bottom: '38%',
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  spark: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(226, 232, 240, 0.85)',
    backgroundColor: 'transparent',
  },
  sparkEdge: {
    position: 'absolute',
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(203, 213, 225, 0.7)',
    transform: [{ rotate: '-28deg' }],
  },
});
