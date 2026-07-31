import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, type ImageSourcePropType } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { EnemyTurnPhase } from '../../utils/combatTelemetryFormat';
import {
  BACKLINE_MELEE_SPRITE_HOLD_MS,
  BACKLINE_MELEE_SPRITE_IN_MS,
  BACKLINE_MELEE_SPRITE_OUT_MS,
  BACKLINE_MELEE_SPRITE_WINDUP_MS,
  FRONTLINE_MELEE_SPRITE_HOLD_MS,
  FRONTLINE_MELEE_SPRITE_IN_MS,
  FRONTLINE_MELEE_SPRITE_OUT_MS,
  RANGED_ATTACK_SPRITE_HOLD_MS,
  RANGED_ATTACK_SPRITE_IN_MS,
  RANGED_ATTACK_SPRITE_OUT_MS,
} from './combatEnemyBarLayout';
import {
  CombatEnemyEnrageOverlaySynced,
  CombatEnemyIntentShimmerSynced,
  ENRAGE_PULSE_MS,
  enemySpriteStyles,
  type IntentShimmerKind,
} from './CombatEnemyIntentShimmer';

/** Standalone/manual choreography when enableLocalMotion is true. */
export const WINDUP_DURATION = 200;
export const LUNGE_DURATION = 150;
export const HOLD_DURATION = 400;
export const RETREAT_DURATION = 250;
export const WINDUP_X = -10;
export const LUNGE_X = 40;

const LINEAR = Easing.linear;

export type AnimatedEnemySpriteHandle = {
  executeAttackAnimation: () => Promise<void>;
};

interface AnimatedEnemySpriteProps {
  idleSource: ImageSourcePropType;
  attackSource: ImageSourcePropType;
  /** Anchor motion phase — drives crossfade in sync with grid lunge. */
  turnPhase?: EnemyTurnPhase | null;
  /** Backline dash counter — triggers crossfade on forward dash. */
  backlineDashSeq?: number;
  /** When true, use backline dash timing instead of frontline melee. */
  isBacklineDashing?: boolean;
  /** When false, only crossfades — CombatEnemyAnchorMotion handles translateX. */
  enableLocalMotion?: boolean;
  /** Tinted duplicate on the attack layer — opacity tracks attack crossfade. */
  attackGlow?: {
    tint: string;
    opacity: number;
    scale?: number;
  } | null;
  intentShimmer?: IntentShimmerKind | null;
  /** Persistent crimson pulse while enraged — synced to idle/attack crossfade. */
  isEnraged?: boolean;
}

const AnimatedEnemySprite = forwardRef<AnimatedEnemySpriteHandle, AnimatedEnemySpriteProps>(
  function AnimatedEnemySprite(
    {
      idleSource,
      attackSource,
      turnPhase = null,
      backlineDashSeq = 0,
      isBacklineDashing = false,
      enableLocalMotion = false,
      attackGlow = null,
      intentShimmer = null,
      isEnraged = false,
    },
    ref,
  ) {
    const translateX = useSharedValue(0);
    const idleOpacity = useSharedValue(1);
    const attackOpacity = useSharedValue(0);
    const enragePulseOpacity = useSharedValue(0);
    const lastTurnPhaseRef = useRef<EnemyTurnPhase | null>(null);
    const lastDashSeqRef = useRef(0);
    const runningRef = useRef(false);

    const snapIdle = useCallback(() => {
      cancelAnimation(idleOpacity);
      cancelAnimation(attackOpacity);
      idleOpacity.value = 1;
      attackOpacity.value = 0;
    }, [attackOpacity, idleOpacity]);

    const runCrossfade = useCallback(
      (
        fadeInMs: number,
        holdMs: number,
        fadeOutMs: number,
        windupMs = 0,
      ) =>
        new Promise<void>((resolve) => {
          runningRef.current = true;
          cancelAnimation(idleOpacity);
          cancelAnimation(attackOpacity);

          const finish = () => {
            runningRef.current = false;
            resolve();
          };

          idleOpacity.value = withSequence(
            withTiming(1, { duration: windupMs }),
            withTiming(0, { duration: fadeInMs, easing: LINEAR }),
            withDelay(holdMs, withTiming(0, { duration: 0 })),
            withTiming(1, { duration: fadeOutMs, easing: LINEAR }, () => runOnJS(finish)()),
          );

          attackOpacity.value = withSequence(
            withTiming(0, { duration: windupMs }),
            withTiming(1, { duration: fadeInMs, easing: LINEAR }),
            withDelay(holdMs, withTiming(1, { duration: 0 })),
            withTiming(0, { duration: fadeOutMs, easing: LINEAR }),
          );

          const totalMs = windupMs + fadeInMs + holdMs + fadeOutMs;
          setTimeout(() => {
            if (runningRef.current) finish();
          }, totalMs + 16);
        }),
      [attackOpacity, idleOpacity],
    );

    const runFrontlineMeleeCrossfade = useCallback(
      () =>
        // Keep attack art up for the full lunge (snap + hold); fade only on return.
        runCrossfade(
          FRONTLINE_MELEE_SPRITE_IN_MS,
          FRONTLINE_MELEE_SPRITE_HOLD_MS,
          FRONTLINE_MELEE_SPRITE_OUT_MS,
        ),
      [runCrossfade],
    );

    const runBacklineMeleeCrossfade = useCallback(
      () =>
        runCrossfade(
          BACKLINE_MELEE_SPRITE_IN_MS,
          BACKLINE_MELEE_SPRITE_HOLD_MS,
          BACKLINE_MELEE_SPRITE_OUT_MS,
          BACKLINE_MELEE_SPRITE_WINDUP_MS,
        ),
      [runCrossfade],
    );

    const runRangedCrossfadeIn = useCallback(
      () =>
        new Promise<void>((resolve) => {
          runningRef.current = true;
          cancelAnimation(attackOpacity);
          cancelAnimation(idleOpacity);

          const finish = () => {
            runningRef.current = false;
            resolve();
          };

          attackOpacity.value = withSequence(
            withTiming(1, { duration: RANGED_ATTACK_SPRITE_IN_MS, easing: LINEAR }),
            withDelay(RANGED_ATTACK_SPRITE_HOLD_MS, withTiming(1, { duration: 0 })),
          );
          idleOpacity.value = withSequence(
            withTiming(0, { duration: RANGED_ATTACK_SPRITE_IN_MS, easing: LINEAR }),
            withDelay(RANGED_ATTACK_SPRITE_HOLD_MS, withTiming(0, { duration: 0 }, () => runOnJS(finish)())),
          );
        }),
      [attackOpacity, idleOpacity],
    );

    const runRangedCrossfadeOut = useCallback(
      () =>
        new Promise<void>((resolve) => {
          runningRef.current = true;
          cancelAnimation(attackOpacity);
          cancelAnimation(idleOpacity);

          const finish = () => {
            runningRef.current = false;
            idleOpacity.value = 1;
            attackOpacity.value = 0;
            resolve();
          };

          attackOpacity.value = withTiming(0, { duration: RANGED_ATTACK_SPRITE_OUT_MS, easing: LINEAR });
          idleOpacity.value = withTiming(
            1,
            { duration: RANGED_ATTACK_SPRITE_OUT_MS, easing: LINEAR },
            () => runOnJS(finish)(),
          );
        }),
      [attackOpacity, idleOpacity],
    );

    const runStandaloneAttack = useCallback(
      () =>
        new Promise<void>((resolve) => {
          if (runningRef.current) {
            resolve();
            return;
          }
          runningRef.current = true;

          cancelAnimation(translateX);
          cancelAnimation(idleOpacity);
          cancelAnimation(attackOpacity);

          idleOpacity.value = 1;
          attackOpacity.value = 0;
          translateX.value = 0;

          const finish = () => {
            runningRef.current = false;
            resolve();
          };

          translateX.value = withSequence(
            withTiming(WINDUP_X, { duration: WINDUP_DURATION }),
            withTiming(LUNGE_X, { duration: LUNGE_DURATION }),
            withDelay(HOLD_DURATION, withTiming(LUNGE_X, { duration: 0 })),
            withTiming(0, { duration: RETREAT_DURATION }),
          );

          idleOpacity.value = withSequence(
            withTiming(1, { duration: WINDUP_DURATION }),
            withTiming(0, { duration: LUNGE_DURATION, easing: LINEAR }),
            withDelay(HOLD_DURATION, withTiming(0, { duration: 0 })),
            withTiming(1, { duration: RETREAT_DURATION, easing: LINEAR }, () => runOnJS(finish)()),
          );

          attackOpacity.value = withSequence(
            withTiming(0, { duration: WINDUP_DURATION }),
            withTiming(1, { duration: LUNGE_DURATION, easing: LINEAR }),
            withDelay(HOLD_DURATION, withTiming(1, { duration: 0 })),
            withTiming(0, { duration: RETREAT_DURATION, easing: LINEAR }),
          );

          if (!enableLocalMotion) {
            const totalMs = WINDUP_DURATION + LUNGE_DURATION + HOLD_DURATION + RETREAT_DURATION;
            setTimeout(() => {
              if (runningRef.current) finish();
            }, totalMs + 16);
          }
        }),
      [attackOpacity, enableLocalMotion, idleOpacity, translateX],
    );

    useImperativeHandle(
      ref,
      () => ({ executeAttackAnimation: enableLocalMotion ? runStandaloneAttack : runFrontlineMeleeCrossfade }),
      [enableLocalMotion, runFrontlineMeleeCrossfade, runStandaloneAttack],
    );

    useEffect(() => {
      if (backlineDashSeq <= 0 || backlineDashSeq === lastDashSeqRef.current) return;
      lastDashSeqRef.current = backlineDashSeq;
      void runBacklineMeleeCrossfade();
    }, [backlineDashSeq, runBacklineMeleeCrossfade]);

    useEffect(() => {
      const prev = lastTurnPhaseRef.current;
      lastTurnPhaseRef.current = turnPhase;

      // Reading / buff = telegraph step only — never show attack art.
      if (turnPhase === 'reading' || turnPhase === 'buff') {
        snapIdle();
        return;
      }

      if (turnPhase === 'melee_attack' && prev !== 'melee_attack' && !isBacklineDashing) {
        void runFrontlineMeleeCrossfade();
        return;
      }

      if (turnPhase === 'ranged_attack' && prev !== 'ranged_attack') {
        void runRangedCrossfadeIn();
        return;
      }

      if (turnPhase == null) {
        if (prev === 'ranged_attack' || prev === 'melee_attack') {
          if (prev === 'melee_attack') {
            snapIdle();
          } else {
            void runRangedCrossfadeOut();
          }
          return;
        }
        if (prev != null) {
          snapIdle();
        }
      }
    }, [
      runFrontlineMeleeCrossfade,
      runRangedCrossfadeIn,
      runRangedCrossfadeOut,
      snapIdle,
      turnPhase,
      isBacklineDashing,
    ]);

    useEffect(() => {
      if (isEnraged) {
        enragePulseOpacity.value = withRepeat(
          withSequence(
            withTiming(0.6, { duration: ENRAGE_PULSE_MS / 2, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.3, { duration: ENRAGE_PULSE_MS / 2, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        );
        return () => cancelAnimation(enragePulseOpacity);
      }
      enragePulseOpacity.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) });
    }, [enragePulseOpacity, isEnraged]);

    const motionStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    const idleStyle = useAnimatedStyle(() => ({
      opacity: idleOpacity.value,
    }));

    const attackStyle = useAnimatedStyle(() => ({
      opacity: attackOpacity.value,
    }));

    const attackGlowStyle = useAnimatedStyle(() => ({
      opacity: attackOpacity.value * (attackGlow?.opacity ?? 0),
    }));

    const hasDistinctAttackArt = idleSource !== attackSource;
    const showAttackLayer = hasDistinctAttackArt || attackGlow != null || intentShimmer != null;

    return (
      <Animated.View style={[styles.root, enableLocalMotion ? motionStyle : null]}>
        <CombatEnemyIntentShimmerSynced
          kind={intentShimmer}
          idleSource={idleSource}
          attackSource={attackSource}
          idleOpacity={idleOpacity}
          attackOpacity={attackOpacity}
          layer="back"
        />
        <Animated.Image
          source={idleSource}
          resizeMode="contain"
          style={[enemySpriteStyles.enemySprite, styles.layer, idleStyle]}
          nativeID="enemy-sprite-idle"
          accessibilityLabel="enemy-sprite-idle"
        />
        {attackGlow ? (
          <Animated.Image
            source={attackSource}
            resizeMode="contain"
            style={[
              enemySpriteStyles.enemySprite,
              styles.layer,
              attackGlowStyle,
              {
                tintColor: attackGlow.tint,
                transform: [{ scale: attackGlow.scale ?? 1.05 }],
              },
            ]}
            nativeID="enemy-sprite-attack-glow"
            accessibilityLabel="enemy-sprite-attack-glow"
          />
        ) : null}
        {showAttackLayer ? (
          <Animated.Image
            source={attackSource}
            resizeMode="contain"
            style={[enemySpriteStyles.enemySprite, styles.layer, attackStyle]}
            nativeID="enemy-sprite-attack"
            accessibilityLabel="enemy-sprite-attack"
          />
        ) : null}
        {isEnraged ? (
          <CombatEnemyEnrageOverlaySynced
            idleSource={idleSource}
            attackSource={attackSource}
            idleOpacity={idleOpacity}
            attackOpacity={attackOpacity}
            pulseOpacity={enragePulseOpacity}
          />
        ) : null}
        <CombatEnemyIntentShimmerSynced
          kind={intentShimmer}
          idleSource={idleSource}
          attackSource={attackSource}
          idleOpacity={idleOpacity}
          attackOpacity={attackOpacity}
          layer="front"
        />
      </Animated.View>
    );
  },
);

export default AnimatedEnemySprite;

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
