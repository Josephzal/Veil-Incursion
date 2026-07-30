import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
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
  /** True while the weapon ultimate interaction popup is open. */
  interactionOpen?: boolean;
  variant: UltimatePingVariant;
  onPress: () => void;
  /** Canonical ultimate name for accessibility (e.g. "Fire GRAVEFALL"). */
  accessibilityLabel?: string;
  /** Short ready label shown under the orb when ready. */
  displayName?: string | null;
  /** Reason announced when the control is unavailable. */
  disabledReason?: string | null;
}

export default function UltimateReadyPing({
  ready,
  disabled = false,
  interactionOpen = false,
  variant,
  onPress,
  accessibilityLabel = 'Fire weapon ultimate',
  displayName = null,
  disabledReason = null,
}: UltimateReadyPingProps): React.JSX.Element | null {
  const palette = VARIANT_STYLE[variant];
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.35);
  const revealOpacity = useSharedValue(0);
  const revealScale = useSharedValue(0.88);
  const activatable = ready && !disabled && !interactionOpen;

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
    if (interactionOpen) {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = 1.08;
      pulseOpacity.value = 0.7;
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
  }, [ready, interactionOpen, pulseOpacity, pulseScale, revealOpacity, revealScale]);

  // Keyboard / controller: Space / Enter / U when focused & ready (web).
  useEffect(() => {
    if (Platform.OS !== 'web' || !activatable) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== 'u' && key !== 'enter' && key !== ' ') return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      event.preventDefault();
      onPress();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activatable, onPress]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
    transform: [{ scale: revealScale.value }],
  }));

  if (!ready && disabled) return null;

  const a11yLabel = interactionOpen
    ? `${displayName ?? 'Weapon ultimate'} interaction open`
    : !ready || disabled
      ? `${accessibilityLabel}. ${disabledReason ?? 'Unavailable'}`
      : `${accessibilityLabel}. Ready. Press U or Enter.`;

  return (
    <Animated.View style={[styles.wrap, wrapStyle]} pointerEvents={activatable ? 'auto' : 'none'}>
      <HapticPressable
        onPress={onPress}
        disabled={!activatable}
        style={[
          styles.hitbox,
          interactionOpen ? styles.hitboxActive : null,
          !activatable && ready ? styles.hitboxUnavailable : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{
          disabled: !activatable,
          busy: interactionOpen,
          selected: interactionOpen,
        }}
        accessibilityHint={activatable ? 'Opens the weapon ultimate interaction' : undefined}
      >
        <Animated.View
          style={[styles.pulseRing, { borderColor: palette.accent, backgroundColor: palette.glow }, ringStyle]}
        />
        <View
          style={[
            styles.core,
            {
              backgroundColor: palette.core,
              borderColor: palette.accent,
              opacity: activatable || interactionOpen ? 1 : 0.45,
            },
          ]}
        />
        <View style={[styles.focusRing, { borderColor: palette.accent }]} />
      </HapticPressable>
      {ready && displayName ? (
        <Text
          numberOfLines={1}
          style={[styles.readyLabel, { color: palette.accent }]}
          pointerEvents="none"
        >
          {interactionOpen ? 'ACTIVE' : displayName}
        </Text>
      ) : null}
      {Platform.OS === 'web' && activatable ? (
        <Text style={styles.inputHint} pointerEvents="none">U</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: HITBOX + 36,
    minHeight: HITBOX + 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hitbox: {
    width: HITBOX,
    height: HITBOX,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: HITBOX / 2,
  },
  hitboxActive: {
    borderWidth: 1.5,
    borderColor: 'rgba(248, 250, 252, 0.55)',
  },
  hitboxUnavailable: {
    opacity: 0.55,
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
  focusRing: {
    position: 'absolute',
    width: PING_SIZE + 10,
    height: PING_SIZE + 10,
    borderRadius: (PING_SIZE + 10) / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.35,
  },
  readyLabel: {
    marginTop: 4,
    fontSize: 8,
    letterSpacing: 0.8,
    fontWeight: '700',
    textTransform: 'uppercase',
    maxWidth: 96,
    textAlign: 'center',
  },
  inputHint: {
    position: 'absolute',
    right: 0,
    top: 0,
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(226, 232, 240, 0.55)',
  },
});
