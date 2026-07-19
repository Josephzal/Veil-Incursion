import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { ArenaIntentGlyph } from '../../data/combatArenaTelegraphEngine';

const MONO = 'monospace';

interface CombatArenaIntentGlyphProps {
  glyph: ArenaIntentGlyph;
  /** Compact mode for dense multi-enemy layouts. */
  compact?: boolean;
}

/**
 * Phase 1 (+ polish) — arena intent badge above hostile portraits.
 * Symbol + optional CH-N / T-N countdown. Side intel remains secondary.
 */
export default function CombatArenaIntentGlyph({
  glyph,
  compact = false,
}: CombatArenaIntentGlyphProps): React.JSX.Element {
  const pulse = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(pulse);
    if (glyph.arenaPriority === 1) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 380, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.96, { duration: 380, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else if (glyph.arenaPriority === 2 && glyph.countdownLabel) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 640, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.98, { duration: 640, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = 1;
    }
    return () => cancelAnimation(pulse);
  }, [glyph.arenaPriority, glyph.countdownLabel, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const borderColor = glyph.accentColor;
  const bg =
    glyph.arenaPriority === 1
      ? 'rgba(69, 10, 10, 0.94)'
      : glyph.arenaPriority === 2
        ? 'rgba(15, 23, 42, 0.94)'
        : 'rgba(2, 6, 23, 0.9)';

  return (
    <Animated.View
      style={[
        styles.root,
        compact ? styles.rootCompact : null,
        glyph.arenaPriority === 1 ? styles.rootUrgent : null,
        {
          borderColor,
          backgroundColor: bg,
          shadowColor: borderColor,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
      accessibilityLabel={`Intent ${glyph.label}${glyph.countdownLabel ? ` ${glyph.countdownLabel}` : ''}`}
    >
      <Text style={[styles.symbol, { color: borderColor }, compact && styles.symbolCompact]}>
        {glyph.symbol}
      </Text>
      <View style={styles.textCol}>
        <Text style={[styles.label, { color: borderColor }, compact && styles.labelCompact]} numberOfLines={1}>
          {glyph.label}
        </Text>
        {glyph.countdownLabel ? (
          <Text
            style={[
              styles.countdown,
              glyph.arenaPriority === 1 && styles.countdownUrgent,
              compact && styles.countdownCompact,
            ]}
            numberOfLines={1}
          >
            {glyph.countdownLabel}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderRadius: 2,
    maxWidth: 92,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 4,
  },
  rootCompact: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    maxWidth: 78,
    gap: 3,
  },
  rootUrgent: {
    shadowOpacity: 0.7,
    shadowRadius: 7,
  },
  symbol: {
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
  },
  symbolCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  textCol: {
    flexShrink: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: MONO,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  labelCompact: {
    fontSize: 7,
    letterSpacing: 0.35,
  },
  countdown: {
    fontFamily: MONO,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.35,
    color: '#fecaca',
    marginTop: 1,
  },
  countdownUrgent: {
    color: '#fee2e2',
  },
  countdownCompact: {
    fontSize: 6,
  },
});
