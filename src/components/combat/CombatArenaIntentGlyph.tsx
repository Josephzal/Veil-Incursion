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
import { OTT } from '../../constants/occultTacticalTerminalTheme';

interface CombatArenaIntentGlyphProps {
  glyph: ArenaIntentGlyph;
  compact?: boolean;
}

/** Concept-style diamond intent tag above hostiles. */
export default function CombatArenaIntentGlyph({
  glyph,
}: CombatArenaIntentGlyphProps): React.JSX.Element {
  const pulse = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(pulse);
    if (glyph.arenaPriority === 1) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 400, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.95, { duration: 400, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = 1;
    }
    return () => cancelAnimation(pulse);
  }, [glyph.arenaPriority, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const accent =
    glyph.kind === 'CHANNEL' || glyph.kind === 'SUPPORT' || glyph.kind === 'SUMMON'
      ? OTT.fluxViolet
      : glyph.kind === 'GUARD'
        ? OTT.cyanSelect
        : glyph.accentColor;

  return (
    <Animated.View
      style={[styles.root, { borderColor: accent }, animatedStyle]}
      pointerEvents="none"
      accessibilityLabel={`Intent ${glyph.label}${glyph.countdownLabel ? ` ${glyph.countdownLabel}` : ''}`}
    >
      <Text style={[styles.symbol, { color: accent }]}>{glyph.symbol}</Text>
      <Text style={[styles.label, { color: accent }]} numberOfLines={1}>
        {glyph.countdownLabel ?? glyph.label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 2,
    backgroundColor: 'rgba(5, 7, 8, 0.82)',
    maxWidth: 96,
  },
  symbol: {
    fontFamily: OTT.mono,
    fontSize: 9,
    fontWeight: '800',
  },
  label: {
    fontFamily: OTT.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
});
