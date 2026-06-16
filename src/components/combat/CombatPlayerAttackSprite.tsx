import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  FRONTLINE_MELEE_SPRITE_HOLD_MS,
  FRONTLINE_MELEE_SPRITE_IN_MS,
  FRONTLINE_MELEE_SPRITE_OUT_MS,
} from './combatEnemyBarLayout';

const LINEAR = Easing.linear;

export type CombatPlayerAttackSpriteHandle = {
  executeAttackAnimation: () => Promise<void>;
};

interface CombatPlayerAttackSpriteProps {
  idleSource: ImageSourcePropType;
  attackSource: ImageSourcePropType;
}

/** Idle/attack crossfade with a locked art box so portrait swaps never resize the frame. */
const CombatPlayerAttackSprite = forwardRef<CombatPlayerAttackSpriteHandle, CombatPlayerAttackSpriteProps>(
  function CombatPlayerAttackSprite({ idleSource, attackSource }, ref) {
    const idleOpacity = useSharedValue(1);
    const attackOpacity = useSharedValue(0);
    const runningRef = useRef(false);

    const runCrossfade = useCallback(
      () =>
        new Promise<void>((resolve) => {
          runningRef.current = true;
          cancelAnimation(idleOpacity);
          cancelAnimation(attackOpacity);

          const finish = () => {
            runningRef.current = false;
            resolve();
          };

          idleOpacity.value = withSequence(
            withTiming(0, { duration: FRONTLINE_MELEE_SPRITE_IN_MS, easing: LINEAR }),
            withDelay(FRONTLINE_MELEE_SPRITE_HOLD_MS, withTiming(0, { duration: 0 })),
            withTiming(1, { duration: FRONTLINE_MELEE_SPRITE_OUT_MS, easing: LINEAR }, () => runOnJS(finish)()),
          );

          attackOpacity.value = withSequence(
            withTiming(1, { duration: FRONTLINE_MELEE_SPRITE_IN_MS, easing: LINEAR }),
            withDelay(FRONTLINE_MELEE_SPRITE_HOLD_MS, withTiming(1, { duration: 0 })),
            withTiming(0, { duration: FRONTLINE_MELEE_SPRITE_OUT_MS, easing: LINEAR }),
          );

          const totalMs =
            FRONTLINE_MELEE_SPRITE_IN_MS + FRONTLINE_MELEE_SPRITE_HOLD_MS + FRONTLINE_MELEE_SPRITE_OUT_MS;
          setTimeout(() => {
            if (runningRef.current) finish();
          }, totalMs + 16);
        }),
      [attackOpacity, idleOpacity],
    );

    useImperativeHandle(ref, () => ({ executeAttackAnimation: runCrossfade }), [runCrossfade]);

    const idleStyle = useAnimatedStyle(() => ({
      opacity: idleOpacity.value,
    }));

    const attackStyle = useAnimatedStyle(() => ({
      opacity: attackOpacity.value,
    }));

    const hasDistinctAttackArt = idleSource !== attackSource;

    return (
      <View style={styles.artBox} pointerEvents="none">
        <Animated.Image
          source={idleSource}
          resizeMode="contain"
          style={[styles.spriteLayer, idleStyle]}
        />
        {hasDistinctAttackArt ? (
          <Animated.Image
            source={attackSource}
            resizeMode="contain"
            style={[styles.spriteLayer, attackStyle]}
          />
        ) : null}
      </View>
    );
  },
);

export default CombatPlayerAttackSprite;

const styles = StyleSheet.create({
  artBox: {
    width: '100%',
    height: '100%',
    minHeight: 120,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  spriteLayer: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    minHeight: 120,
    backgroundColor: 'transparent',
  },
});
