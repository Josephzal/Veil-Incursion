import React, { useEffect } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { EnemyPortraitAnim, EnemyPortraitGlow } from '../../utils/combatTelemetryFormat';

const GLOW_TINT: Record<Exclude<EnemyPortraitGlow, 'none'>, string> = {
  'player-selected': '#f8fafc',
  'enemy-attacking': '#ef4444',
  'enemy-charging': '#fde68a',
};

const GLOW_SCALE: Record<Exclude<EnemyPortraitGlow, 'none'>, number> = {
  'player-selected': 1.05,
  'enemy-attacking': 1.05,
  'enemy-charging': 1.09,
};

const GLOW_OPACITY: Record<Exclude<EnemyPortraitGlow, 'none'>, number> = {
  'player-selected': 0.3,
  'enemy-attacking': 0.3,
  'enemy-charging': 0.38,
};

const LUNGE_DISTANCE = 22;
const LUNGE_MS = 320;
const SHIMMY_RADIUS_X = 5;
const SHIMMY_RADIUS_Y = 4;
const SHIMMY_MS = 760;

interface CombatEnemyPortraitSkiaProps {
  source: ImageSourcePropType;
  glow: EnemyPortraitGlow;
  anim?: EnemyPortraitAnim;
}

/** Silhouette glow via duplicate tinted Image; intent-driven lunge / shimmy on enemy turn. */
export default function CombatEnemyPortraitSkia({
  source,
  glow,
  anim = 'none',
}: CombatEnemyPortraitSkiaProps): React.JSX.Element {
  const glowTint = glow !== 'none' ? GLOW_TINT[glow] : null;
  const glowScale = glow !== 'none' ? GLOW_SCALE[glow] : 1.05;
  const glowOpacity = glow !== 'none' ? GLOW_OPACITY[glow] : 0.3;

  const lungeX = useSharedValue(0);
  const shimmyPhase = useSharedValue(0);
  const animMode = useSharedValue(0);

  useEffect(() => {
    animMode.value = anim === 'shimmy' ? 2 : anim === 'lunge' ? 1 : 0;
  }, [anim, animMode]);

  useEffect(() => {
    if (anim === 'lunge') {
      lungeX.value = withSequence(
        withTiming(-LUNGE_DISTANCE, {
          duration: LUNGE_MS * 0.45,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0, {
          duration: LUNGE_MS * 0.55,
          easing: Easing.inOut(Easing.cubic),
        }),
      );
      return;
    }
    lungeX.value = withTiming(0, { duration: 120 });
  }, [anim, lungeX]);

  useEffect(() => {
    if (anim === 'shimmy') {
      shimmyPhase.value = withRepeat(
        withTiming(Math.PI * 2, { duration: SHIMMY_MS, easing: Easing.linear }),
        -1,
        false,
      );
      return;
    }
    cancelAnimation(shimmyPhase);
    shimmyPhase.value = withTiming(0, { duration: 120 });
  }, [anim, shimmyPhase]);

  const motionStyle = useAnimatedStyle(() => {
    if (animMode.value === 2) {
      return {
        transform: [
          { translateX: Math.cos(shimmyPhase.value) * SHIMMY_RADIUS_X },
          { translateY: Math.sin(shimmyPhase.value) * SHIMMY_RADIUS_Y },
        ],
      };
    }
    return {
      transform: [{ translateX: lungeX.value }],
    };
  });

  return (
    <View style={styles.root} collapsable={false}>
      <Animated.View style={[styles.motionWrap, motionStyle]}>
        {glowTint ? (
          <Image
            source={source}
            resizeMode="contain"
            style={[
              styles.portrait,
              styles.glowDuplicate,
              {
                tintColor: glowTint,
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
        ) : null}
        <Image
          source={source}
          resizeMode="contain"
          style={styles.portrait}
        />
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
  motionWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  glowDuplicate: {
    position: 'absolute',
  },
});
