import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { CombatClassImpactKind } from '../../utils/combatTelemetryFormat';

const AEGIS_RED = '#dc2626';
const AEGIS_CORE = '#fca5a5';
const HEX_CORE = '#fef3c7';
const HEX_STREAK = '#fbbf24';
const ENVOY_CORE = '#c4b5fd';
const ENVOY_RING = '#7c3aed';
const ENVOY_PARTICLE = '#a78bfa';
const ENVOY_PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

interface CombatEnemyClassImpactProps {
  impactFxSeq?: number;
  impactFxKind?: CombatClassImpactKind;
  children: React.ReactNode;
}

function EnvoyParticle({
  angleDeg,
  opacity,
  spread,
}: {
  angleDeg: number;
  opacity: SharedValue<number>;
  spread: SharedValue<number>;
}): React.JSX.Element {
  const style = useAnimatedStyle(() => {
    const rad = (angleDeg * Math.PI) / 180;
    const dist = 14 * spread.value;
    return {
      opacity: opacity.value * 0.9,
      transform: [
        { translateX: Math.cos(rad) * dist },
        { translateY: Math.sin(rad) * dist },
        { scale: 0.6 + spread.value * 0.5 },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.envoyParticle, { backgroundColor: ENVOY_PARTICLE }, style]}
    />
  );
}

/** Direct-hit class identity overlay — distinct from crit slash VFX. */
export default function CombatEnemyClassImpact({
  impactFxSeq = 0,
  impactFxKind,
  children,
}: CombatEnemyClassImpactProps): React.JSX.Element {
  const lastSeqRef = useRef(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const ringScale = useSharedValue(0.35);
  const particleSpread = useSharedValue(0);

  useEffect(() => {
    if (impactFxSeq <= 0 || impactFxSeq === lastSeqRef.current || !impactFxKind) return;
    lastSeqRef.current = impactFxSeq;

    opacity.value = 0;
    scale.value = 0.45;
    ringScale.value = 0.3;
    particleSpread.value = 0;

    opacity.value = withSequence(
      withTiming(1, { duration: 45, easing: Easing.out(Easing.quad) }),
      withTiming(0.7, { duration: 70 }),
      withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) }),
    );
    scale.value = withSequence(
      withTiming(1.05, { duration: 55, easing: Easing.out(Easing.back(1.2)) }),
      withTiming(0.92, { duration: 220 }),
    );
    ringScale.value = withSequence(
      withTiming(1.25, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(1.45, { duration: 120, easing: Easing.in(Easing.quad) }),
    );
    particleSpread.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [impactFxKind, impactFxSeq, opacity, particleSpread, ringScale, scale]);

  useEffect(() => () => {
    cancelAnimation(opacity);
    cancelAnimation(scale);
    cancelAnimation(ringScale);
    cancelAnimation(particleSpread);
  }, [opacity, particleSpread, ringScale, scale]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.85,
    transform: [{ scale: ringScale.value }],
  }));

  const renderAegisSlice = () => (
    <Animated.View style={[styles.overlayHost, overlayStyle]} pointerEvents="none">
      <View style={[styles.aegisSlashMain, { backgroundColor: AEGIS_RED, shadowColor: AEGIS_RED }]} />
      <View style={[styles.aegisSlashCross, { backgroundColor: AEGIS_CORE }]} />
      <View style={[styles.aegisSlashTailA, { backgroundColor: AEGIS_RED }]} />
      <View style={[styles.aegisSlashTailB, { backgroundColor: AEGIS_RED }]} />
    </Animated.View>
  );

  const renderHexBullet = () => (
    <Animated.View style={[styles.overlayHost, overlayStyle]} pointerEvents="none">
      <View style={[styles.hexCore, { backgroundColor: HEX_CORE, shadowColor: HEX_STREAK }]} />
      <View style={[styles.hexStreak, styles.hexStreakN, { backgroundColor: HEX_STREAK }]} />
      <View style={[styles.hexStreak, styles.hexStreakE, { backgroundColor: HEX_STREAK }]} />
      <View style={[styles.hexStreak, styles.hexStreakS, { backgroundColor: HEX_STREAK }]} />
      <View style={[styles.hexStreak, styles.hexStreakW, { backgroundColor: HEX_STREAK }]} />
      <View style={[styles.hexStreak, styles.hexStreakNE, { backgroundColor: HEX_CORE }]} />
      <View style={[styles.hexStreak, styles.hexStreakSW, { backgroundColor: HEX_CORE }]} />
    </Animated.View>
  );

  const renderEnvoyBurst = () => (
    <>
      <Animated.View style={[styles.ringHost, ringStyle]} pointerEvents="none">
        <View style={[styles.envoyRing, { borderColor: ENVOY_RING }]} />
        <View style={[styles.envoyRingInner, { backgroundColor: ENVOY_CORE }]} />
      </Animated.View>
      <Animated.View style={[styles.overlayHost, overlayStyle]} pointerEvents="none">
        <View style={[styles.envoyCore, { backgroundColor: ENVOY_CORE, shadowColor: ENVOY_RING }]} />
        {ENVOY_PARTICLE_ANGLES.map((angle) => (
          <EnvoyParticle
            key={`envoy-particle-${angle}`}
            angleDeg={angle}
            opacity={opacity}
            spread={particleSpread}
          />
        ))}
      </Animated.View>
    </>
  );

  return (
    <View style={styles.root}>
      {children}
      {impactFxKind === 'AEGIS_SLICE' ? renderAegisSlice() : null}
      {impactFxKind === 'HEX_BULLET' ? renderHexBullet() : null}
      {impactFxKind === 'ENVOY_BURST' ? renderEnvoyBurst() : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 7,
  },
  ringHost: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  aegisSlashMain: {
    position: 'absolute',
    width: 4,
    height: '72%',
    borderRadius: 1,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    transform: [{ rotate: '18deg' }],
  },
  aegisSlashCross: {
    position: 'absolute',
    width: 2,
    height: '58%',
    opacity: 0.9,
    transform: [{ rotate: '-62deg' }],
  },
  aegisSlashTailA: {
    position: 'absolute',
    width: 3,
    height: '22%',
    top: '18%',
    left: '44%',
    transform: [{ rotate: '32deg' }],
  },
  aegisSlashTailB: {
    position: 'absolute',
    width: 3,
    height: '18%',
    bottom: '20%',
    right: '42%',
    transform: [{ rotate: '-8deg' }],
  },
  hexCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
    shadowOpacity: 0.95,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  hexStreak: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  hexStreakN: { width: 14, top: '38%', transform: [{ rotate: '90deg' }] },
  hexStreakS: { width: 12, bottom: '38%', transform: [{ rotate: '90deg' }] },
  hexStreakE: { width: 14, right: '36%' },
  hexStreakW: { width: 12, left: '36%' },
  hexStreakNE: { width: 10, top: '42%', right: '38%', transform: [{ rotate: '-45deg' }] },
  hexStreakSW: { width: 9, bottom: '42%', left: '38%', transform: [{ rotate: '-45deg' }] },
  envoyRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    opacity: 0.75,
  },
  envoyRingInner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.35,
  },
  envoyCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowOpacity: 0.95,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  envoyParticle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
