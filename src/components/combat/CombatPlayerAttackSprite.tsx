import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, type ImageSourcePropType, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
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
  RANGED_ATTACK_SPRITE_HOLD_MS,
  RANGED_ATTACK_SPRITE_IN_MS,
  RANGED_ATTACK_SPRITE_OUT_MS,
} from './combatEnemyBarLayout';
import type { ClassType } from '../../types/game';
import type { WeaponFamilyId } from '../../types/weapon';
import {
  computeFootprintAttackLayout,
  computeFootprintIdleLayout,
  type FootprintBox,
} from '../../utils/combatPlayerPortrait';

const LINEAR = Easing.linear;
const PRIMED_GLOW = '#ff00ff';

export type CombatPlayerAttackSpriteHandle = {
  executeAttackAnimation: () => Promise<void>;
  executeRangedAttackAnimation: () => Promise<void>;
};

interface CombatPlayerAttackSpriteProps {
  idleSource: ImageSourcePropType;
  attackSource: ImageSourcePropType;
  operativeClass?: ClassType;
  weaponFamilyId?: WeaponFamilyId | null;
  /** Magenta primed glow — shares idle footprint. */
  primedGlowOpacity: SharedValue<number>;
}

/** Idle/attack crossfade with a locked art box so portrait swaps never resize the frame. */
const CombatPlayerAttackSprite = forwardRef<CombatPlayerAttackSpriteHandle, CombatPlayerAttackSpriteProps>(
  function CombatPlayerAttackSprite({
    idleSource,
    attackSource,
    operativeClass = 'AEGIS',
    weaponFamilyId = null,
    primedGlowOpacity,
  }, ref) {
    const idleOpacity = useSharedValue(1);
    const attackOpacity = useSharedValue(0);
    const runningRef = useRef(false);
    const [footprintBox, setFootprintBox] = useState<FootprintBox>({ width: 0, height: 0 });

    const onArtBoxLayout = useCallback((event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setFootprintBox((prev) => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ));
    }, []);

    const runCrossfade = useCallback(
      (inMs: number, holdMs: number, outMs: number) =>
        new Promise<void>((resolve) => {
          runningRef.current = true;
          cancelAnimation(idleOpacity);
          cancelAnimation(attackOpacity);

          const finish = () => {
            runningRef.current = false;
            resolve();
          };

          idleOpacity.value = withSequence(
            withTiming(0, { duration: inMs, easing: LINEAR }),
            withDelay(holdMs, withTiming(0, { duration: 0 })),
            withTiming(1, { duration: outMs, easing: LINEAR }, () => runOnJS(finish)()),
          );

          attackOpacity.value = withSequence(
            withTiming(1, { duration: inMs, easing: LINEAR }),
            withDelay(holdMs, withTiming(1, { duration: 0 })),
            withTiming(0, { duration: outMs, easing: LINEAR }),
          );

          const totalMs = inMs + holdMs + outMs;
          setTimeout(() => {
            if (runningRef.current) finish();
          }, totalMs + 16);
        }),
      [attackOpacity, idleOpacity],
    );

    const runMeleeCrossfade = useCallback(
      () => runCrossfade(
        FRONTLINE_MELEE_SPRITE_IN_MS,
        FRONTLINE_MELEE_SPRITE_HOLD_MS,
        FRONTLINE_MELEE_SPRITE_OUT_MS,
      ),
      [runCrossfade],
    );

    const runRangedCrossfade = useCallback(
      () => runCrossfade(
        RANGED_ATTACK_SPRITE_IN_MS,
        RANGED_ATTACK_SPRITE_HOLD_MS,
        RANGED_ATTACK_SPRITE_OUT_MS,
      ),
      [runCrossfade],
    );

    useImperativeHandle(
      ref,
      () => ({
        executeAttackAnimation: runMeleeCrossfade,
        executeRangedAttackAnimation: runRangedCrossfade,
      }),
      [runMeleeCrossfade, runRangedCrossfade],
    );

    const idleStyle = useAnimatedStyle(() => ({
      opacity: idleOpacity.value,
    }));

    const attackStyle = useAnimatedStyle(() => ({
      opacity: attackOpacity.value,
    }));

    const primedGlowStyle = useAnimatedStyle(() => ({
      opacity: primedGlowOpacity.value * 0.38,
    }));

    const hasDistinctAttackArt = idleSource !== attackSource;
    const idleLayerStyle = computeFootprintIdleLayout(footprintBox, operativeClass, weaponFamilyId);
    const attackLayerStyle = computeFootprintAttackLayout(footprintBox, operativeClass, weaponFamilyId);

    return (
      <View
        style={styles.artBox}
        onLayout={onArtBoxLayout}
        pointerEvents="none"
      >
        <Animated.View style={[idleLayerStyle, primedGlowStyle]} pointerEvents="none">
          <Animated.Image
            source={idleSource}
            resizeMode="contain"
            style={[styles.fill, styles.auraScale, { tintColor: PRIMED_GLOW }]}
          />
        </Animated.View>
        <Animated.Image
          source={idleSource}
          resizeMode="contain"
          style={[idleLayerStyle, idleStyle]}
        />
        {hasDistinctAttackArt ? (
          <Animated.Image
            source={attackSource}
            resizeMode="contain"
            style={[attackLayerStyle, attackStyle]}
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
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  auraScale: {
    transform: [{ scale: 1.08 }],
  },
});
