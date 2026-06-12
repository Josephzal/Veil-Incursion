import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type IntentShimmerKind = 'fortify' | 'evade';

const SHIMMER_COLORS: Record<IntentShimmerKind, string> = {
  fortify: 'rgba(251, 146, 60, 0.32)',
  evade: 'rgba(248, 250, 252, 0.26)',
};

interface CombatEnemyIntentShimmerProps {
  kind: IntentShimmerKind | null;
}

/** Low-opacity vertical sweep over the enemy portrait image only. */
export default function CombatEnemyIntentShimmer({
  kind,
}: CombatEnemyIntentShimmerProps): React.JSX.Element | null {
  const sweep = useSharedValue(-0.55);

  useEffect(() => {
    if (!kind) {
      cancelAnimation(sweep);
      sweep.value = -0.55;
      return;
    }
    sweep.value = -0.55;
    sweep.value = withRepeat(
      withTiming(1.35, { duration: kind === 'fortify' ? 1100 : 900, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(sweep);
    };
  }, [kind, sweep]);

  const bandStyle = useAnimatedStyle(() => ({
    top: `${sweep.value * 100}%` as `${number}%`,
  }));

  if (!kind) return null;

  return (
    <View style={styles.clip} pointerEvents="none">
      <Animated.View
        style={[
          styles.band,
          bandStyle,
          { backgroundColor: SHIMMER_COLORS[kind] },
        ]}
      />
      <Animated.View
        style={[
          styles.bandSoft,
          bandStyle,
          { backgroundColor: SHIMMER_COLORS[kind] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 4,
  },
  band: {
    position: 'absolute',
    left: '-8%',
    width: '116%',
    height: '38%',
    opacity: 0.95,
  },
  bandSoft: {
    position: 'absolute',
    left: '-4%',
    width: '108%',
    height: '18%',
    opacity: 0.45,
    marginTop: 14,
  },
});
