import React, { useEffect, useRef } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  BACKLINE_MELEE_DASH_HOLD_MS,
  BACKLINE_MELEE_DASH_MS,
  BACKLINE_MELEE_DASH_RETURN_MS,
  BACKLINE_MELEE_DASH_WINDUP_MS,
  BACKLINE_MELEE_DASH_WINDUP_X,
  backlineMeleeDashTranslateX,
} from './combatEnemyBarLayout';

const IDLE_CYCLE_MS = 3200;
const IDLE_HALF_MS = IDLE_CYCLE_MS / 2;
const IDLE_TRAVEL_Y = 1.5;
const IDLE_SCALE_MIN = 0.99;
const STEP_OUT_X = -20;
const STEP_OUT_SCALE = 1.05;
const STEP_OUT_MS = 280;
const STEP_RETURN_MS = 320;
const RECOIL_X = 15;

interface CombatEnemyAnchorMotionProps {
  children: React.ReactNode;
  isActingTurn?: boolean;
  isBacklineDashing?: boolean;
  hitFlashSeq?: number;
  backlineMeleeDashSeq?: number;
  frozen?: boolean;
}

export default function CombatEnemyAnchorMotion({
  children,
  isActingTurn = false,
  isBacklineDashing = false,
  hitFlashSeq = 0,
  backlineMeleeDashSeq = 0,
  frozen = false,
}: CombatEnemyAnchorMotionProps): React.JSX.Element {
  const lastHitRef = useRef(0);
  const lastDashRef = useRef(0);
  const idlePhase = useSharedValue(0);
  const stepX = useSharedValue(0);
  const stepScale = useSharedValue(1);
  const recoilX = useSharedValue(0);
  const meleeDashX = useSharedValue(0);
  const motionLocked = useSharedValue(0);

  useEffect(() => {
    motionLocked.value = frozen ? 1 : 0;
    if (!frozen) return;

    cancelAnimation(idlePhase);
    cancelAnimation(meleeDashX);
    cancelAnimation(stepX);
    cancelAnimation(recoilX);
    cancelAnimation(stepScale);

    idlePhase.value = 0;
    meleeDashX.value = 0;
    stepX.value = 0;
    recoilX.value = 0;
    stepScale.value = 1;
  }, [frozen, idlePhase, meleeDashX, motionLocked, recoilX, stepScale, stepX]);

  useEffect(() => {
    if (frozen || isBacklineDashing) {
      cancelAnimation(idlePhase);
      if (!frozen) {
        idlePhase.value = withTiming(0, { duration: 180, easing: Easing.inOut(Easing.sin) });
      }
      return;
    }

    idlePhase.value = withRepeat(
      withTiming(1, {
        duration: IDLE_HALF_MS,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );

    return () => cancelAnimation(idlePhase);
  }, [frozen, idlePhase, isBacklineDashing]);

  useEffect(() => {
    if (frozen || isBacklineDashing) return;

    if (isActingTurn) {
      stepX.value = withTiming(STEP_OUT_X, {
        duration: STEP_OUT_MS,
        easing: Easing.out(Easing.cubic),
      });
      stepScale.value = withTiming(STEP_OUT_SCALE, {
        duration: STEP_OUT_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    stepX.value = withTiming(0, {
      duration: STEP_RETURN_MS,
      easing: Easing.out(Easing.cubic),
    });
    stepScale.value = withTiming(1, {
      duration: STEP_RETURN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [frozen, isActingTurn, isBacklineDashing, stepScale, stepX]);

  useEffect(() => {
    if (hitFlashSeq <= 0 || hitFlashSeq === lastHitRef.current) return;
    lastHitRef.current = hitFlashSeq;
    recoilX.value = RECOIL_X;
    recoilX.value = withSpring(0, {
      damping: 14,
      stiffness: 220,
      mass: 0.8,
    });
  }, [hitFlashSeq, recoilX]);

  useEffect(() => {
    if (frozen || backlineMeleeDashSeq <= 0 || backlineMeleeDashSeq === lastDashRef.current) return;
    lastDashRef.current = backlineMeleeDashSeq;

    cancelAnimation(idlePhase);
    idlePhase.value = 0;
    stepX.value = 0;
    stepScale.value = 1;

    const dashTarget = backlineMeleeDashTranslateX(Dimensions.get('window').width);
    meleeDashX.value = withSequence(
      withTiming(BACKLINE_MELEE_DASH_WINDUP_X, {
        duration: BACKLINE_MELEE_DASH_WINDUP_MS,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(dashTarget, {
        duration: BACKLINE_MELEE_DASH_MS,
        easing: Easing.in(Easing.cubic),
      }),
      withTiming(dashTarget, { duration: BACKLINE_MELEE_DASH_HOLD_MS }),
      withTiming(0, {
        duration: BACKLINE_MELEE_DASH_RETURN_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [backlineMeleeDashSeq, frozen, idlePhase, meleeDashX, stepScale, stepX]);

  const motionStyle = useAnimatedStyle(() => {
    if (motionLocked.value === 1) {
      return {
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { scale: 1 },
        ],
      };
    }

    const breatheScale = 1 - idlePhase.value * (1 - IDLE_SCALE_MIN);
    return {
      transform: [
        { translateX: stepX.value + recoilX.value + meleeDashX.value },
        { translateY: idlePhase.value * -IDLE_TRAVEL_Y },
        { scale: stepScale.value * breatheScale },
      ],
    };
  });

  return (
    <Animated.View style={[styles.root, motionStyle]} pointerEvents="box-none">
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
});
