import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

const SLICE_ACCENT = '#ff1744';
const SLICE_GLOW = 'rgba(255, 23, 68, 0.22)';
const SLICE_CORE = '#ff4560';
const PING_SIZE = 28;
const HITBOX = PING_SIZE + 16;

interface VectorSlicePingProps {
  ready: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Absolute overlay placement inside the enemy viewport layer. */
  placement?: 'center' | 'bottom';
}

export default function VectorSlicePing({
  ready,
  disabled = false,
  onPress,
  placement = 'bottom',
}: VectorSlicePingProps): React.JSX.Element | null {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.35);
  const revealOpacity = useSharedValue(0);
  const revealScale = useSharedValue(0.88);

  useEffect(() => {
    if (!ready) {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = 1;
      pulseOpacity.value = 0.2;
      revealOpacity.value = withTiming(0, { duration: 160 });
      revealScale.value = withTiming(0.88, { duration: 160 });
      return;
    }
    revealOpacity.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
    revealScale.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.back(1.4)) });
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.45, { duration: 700, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 700, easing: Easing.in(Easing.cubic) }),
      ),
      -1,
      false,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 700 }),
        withTiming(0.25, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [ready, pulseScale, pulseOpacity, revealOpacity, revealScale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const bladeStyle = useAnimatedStyle(() => ({
    opacity: ready ? 1 : 0.35,
  }));

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
    transform: [{ scale: revealScale.value }],
  }));

  if (!ready && disabled) return null;

  const placementStyle = placement === 'center' ? styles.wrapCenter : styles.wrapBottom;

  return (
    <Animated.View
      style={[styles.wrap, placementStyle, wrapStyle]}
      pointerEvents={ready && !disabled ? 'auto' : 'none'}
    >
      <Pressable
        onPress={onPress}
        disabled={!ready || disabled}
        style={styles.hitbox}
        accessibilityLabel="Eviscerate ready"
      >
        <Animated.View
          style={[
            styles.pulseRing,
            { borderColor: SLICE_ACCENT },
            ringStyle,
          ]}
        />
        <View style={styles.slashField}>
          <View style={[styles.slashTrail, styles.slashTrailA]} />
          <View style={[styles.slashTrail, styles.slashTrailB]} />
          <Animated.View style={[styles.bladeCore, bladeStyle]}>
            <View style={styles.bladeEdge} />
            <View style={styles.bladeGlint} />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 14,
  },
  wrapCenter: {
    left: '50%',
    top: '50%',
    width: HITBOX,
    height: HITBOX,
    marginLeft: -HITBOX / 2,
    marginTop: -HITBOX / 2,
  },
  wrapBottom: {
    left: 0,
    right: 0,
    bottom: 12,
    height: HITBOX,
  },
  hitbox: {
    width: HITBOX,
    height: HITBOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: PING_SIZE,
    height: PING_SIZE,
    borderRadius: PING_SIZE / 2,
    borderWidth: 1.5,
    backgroundColor: SLICE_GLOW,
  },
  slashField: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slashTrail: {
    position: 'absolute',
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 120, 140, 0.55)',
  },
  slashTrailA: {
    transform: [{ rotate: '-38deg' }, { translateX: -4 }],
  },
  slashTrailB: {
    transform: [{ rotate: '-38deg' }, { translateX: 4 }],
  },
  bladeCore: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bladeEdge: {
    width: 3,
    height: 14,
    borderRadius: 1,
    backgroundColor: SLICE_CORE,
    borderWidth: 1,
    borderColor: '#ff8a9a',
    transform: [{ rotate: '-38deg' }],
    shadowColor: SLICE_ACCENT,
    shadowOpacity: 0.75,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  bladeGlint: {
    position: 'absolute',
    width: 1,
    height: 6,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    transform: [{ rotate: '-38deg' }, { translateX: -0.5 }, { translateY: -2 }],
  },
});
