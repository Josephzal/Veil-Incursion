import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const PING_SIZE = 28;
const HITBOX = PING_SIZE + 16;

export type UltimatePingVariant = 'eviscerate' | 'zero_protocol' | 'cataclysm';

const VARIANT_STYLE: Record<UltimatePingVariant, { accent: string; glow: string; core: string }> = {
  eviscerate: { accent: '#ff1744', glow: 'rgba(255, 23, 68, 0.22)', core: '#ff4560' },
  zero_protocol: { accent: '#fbbf24', glow: 'rgba(251, 191, 36, 0.25)', core: '#fde68a' },
  cataclysm: { accent: '#a78bfa', glow: 'rgba(167, 139, 250, 0.28)', core: '#c4b5fd' },
};

interface UltimateReadyPingProps {
  ready: boolean;
  disabled?: boolean;
  variant: UltimatePingVariant;
  onPress: () => void;
}

export default function UltimateReadyPing({
  ready,
  disabled = false,
  variant,
  onPress,
}: UltimateReadyPingProps): React.JSX.Element | null {
  const palette = VARIANT_STYLE[variant];
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
  }, [ready, pulseOpacity, pulseScale, revealOpacity, revealScale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
    transform: [{ scale: revealScale.value }],
  }));

  if (!ready && disabled) return null;

  return (
    <Animated.View style={[styles.wrap, wrapStyle]} pointerEvents={ready && !disabled ? 'auto' : 'none'}>
      <Pressable onPress={onPress} disabled={!ready || disabled} style={styles.hitbox}>
        <Animated.View
          style={[styles.pulseRing, { borderColor: palette.accent, backgroundColor: palette.glow }, ringStyle]}
        />
        <View style={[styles.core, { backgroundColor: palette.core, borderColor: palette.accent }]} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: HITBOX,
    height: HITBOX,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  core: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
});
