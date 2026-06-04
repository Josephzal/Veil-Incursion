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
const PING_SIZE = 28;
const HITBOX = PING_SIZE + 16;

interface VectorSlicePingProps {
  ready: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Center on parent (enemy viewport). */
  anchored?: boolean;
}

export default function VectorSlicePing({
  ready,
  disabled = false,
  onPress,
  anchored = false,
}: VectorSlicePingProps): React.JSX.Element | null {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.35);

  useEffect(() => {
    if (!ready) {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = 1;
      pulseOpacity.value = 0.2;
      return;
    }
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
  }, [ready, pulseScale, pulseOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const coreStyle = useAnimatedStyle(() => ({
    opacity: ready ? 1 : 0.35,
  }));

  if (!ready && disabled) return null;

  return (
    <View
      style={[styles.wrap, anchored ? styles.wrapAnchored : null]}
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
        <Animated.View
          style={[
            styles.core,
            { backgroundColor: SLICE_ACCENT, borderColor: SLICE_ACCENT },
            coreStyle,
          ]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
    minHeight: HITBOX + 8,
  },
  wrapAnchored: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: HITBOX,
    height: HITBOX,
    marginLeft: -HITBOX / 2,
    marginTop: -HITBOX / 2,
    paddingBottom: 0,
    minHeight: 0,
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
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
});
