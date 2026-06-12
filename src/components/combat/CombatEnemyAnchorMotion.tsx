import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
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
  FRONTLINE_IMPACT_HOLD_MS,
  FRONTLINE_IMPACT_SNAP_MS,
  FRONTLINE_IMPACT_SNAP_X,
  FRONTLINE_RETURN_MS,
  FRONTLINE_STEP_OUT_MS,
  FRONTLINE_STEP_OUT_X,
} from './combatEnemyBarLayout';

const IDLE_CYCLE_MS = 3200;
const IDLE_HALF_MS = IDLE_CYCLE_MS / 2;
const IDLE_TRAVEL_Y = 1.5;
const IDLE_SCALE_MIN = 0.99;
const STEP_OUT_SCALE = 1.05;
const RECOIL_X = 15;

interface CombatEnemyAnchorMotionProps {
  children: React.ReactNode;
  isActingTurn?: boolean;
  isExecutingAttack?: boolean;
  isBacklineDashing?: boolean;
  hitFlashSeq?: number;
  backlineMeleeDashSeq?: number;
  meleeDashDelta?: { x: number; y: number };
  frozen?: boolean;
}

export default function CombatEnemyAnchorMotion({
  children,
  isActingTurn = false,
  isExecutingAttack = false,
  isBacklineDashing = false,
  hitFlashSeq = 0,
  backlineMeleeDashSeq = 0,
  meleeDashDelta,
  frozen = false,
}: CombatEnemyAnchorMotionProps): React.JSX.Element {
  const lastHitRef = useRef(0);
  const lastDashRef = useRef(0);
  const idlePhase = useSharedValue(0);
  const stepX = useSharedValue(0);
  const stepScale = useSharedValue(1);
  const recoilX = useSharedValue(0);
  const meleeDashX = useSharedValue(0);
  const meleeDashY = useSharedValue(0);
  const motionLocked = useSharedValue(0);

  useEffect(() => {
    motionLocked.value = frozen ? 1 : 0;
    if (!frozen) return;

    cancelAnimation(idlePhase);
    cancelAnimation(meleeDashX);
    cancelAnimation(meleeDashY);
    cancelAnimation(stepX);
    cancelAnimation(recoilX);
    cancelAnimation(stepScale);

    idlePhase.value = 0;
    meleeDashX.value = 0;
    meleeDashY.value = 0;
    stepX.value = 0;
    recoilX.value = 0;
    stepScale.value = 1;
  }, [frozen, idlePhase, meleeDashX, meleeDashY, motionLocked, recoilX, stepScale, stepX]);

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
    if (frozen || isBacklineDashing || isExecutingAttack) return;

    if (isActingTurn) {
      stepX.value = withTiming(FRONTLINE_STEP_OUT_X, {
        duration: FRONTLINE_STEP_OUT_MS,
        easing: Easing.out(Easing.cubic),
      });
      stepScale.value = withTiming(STEP_OUT_SCALE, {
        duration: FRONTLINE_STEP_OUT_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    stepX.value = withTiming(0, {
      duration: FRONTLINE_RETURN_MS,
      easing: Easing.out(Easing.cubic),
    });
    stepScale.value = withTiming(1, {
      duration: FRONTLINE_RETURN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [frozen, isActingTurn, isBacklineDashing, isExecutingAttack, stepScale, stepX]);

  useEffect(() => {
    if (frozen || isBacklineDashing) return;

    if (!isExecutingAttack) {
      return;
    }

    stepX.value = withSequence(
      withTiming(FRONTLINE_STEP_OUT_X, {
        duration: FRONTLINE_STEP_OUT_MS,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(FRONTLINE_STEP_OUT_X, { duration: FRONTLINE_IMPACT_HOLD_MS }),
      withTiming(FRONTLINE_STEP_OUT_X + FRONTLINE_IMPACT_SNAP_X, {
        duration: FRONTLINE_IMPACT_SNAP_MS,
        easing: Easing.out(Easing.quad),
      }),
    );
    stepScale.value = withTiming(STEP_OUT_SCALE, {
      duration: FRONTLINE_STEP_OUT_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [frozen, isBacklineDashing, isExecutingAttack, stepScale, stepX]);

  useEffect(() => {
    if (isExecutingAttack || frozen || isBacklineDashing) return;
    stepX.value = withTiming(0, {
      duration: FRONTLINE_RETURN_MS,
      easing: Easing.out(Easing.cubic),
    });
    stepScale.value = withTiming(1, {
      duration: FRONTLINE_RETURN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [frozen, isBacklineDashing, isExecutingAttack, stepScale, stepX]);

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
    cancelAnimation(stepX);
    cancelAnimation(meleeDashX);
    cancelAnimation(meleeDashY);
    idlePhase.value = 0;
    stepX.value = 0;
    stepScale.value = 1;

    const dashTargetX = meleeDashDelta?.x ?? -120;
    const dashTargetY = meleeDashDelta?.y ?? 24;

    meleeDashX.value = withSequence(
      withTiming(BACKLINE_MELEE_DASH_WINDUP_X, {
        duration: BACKLINE_MELEE_DASH_WINDUP_MS,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(dashTargetX, {
        duration: BACKLINE_MELEE_DASH_MS,
        easing: Easing.inOut(Easing.cubic),
      }),
      withTiming(dashTargetX, { duration: BACKLINE_MELEE_DASH_HOLD_MS }),
      withTiming(0, {
        duration: BACKLINE_MELEE_DASH_RETURN_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
    meleeDashY.value = withSequence(
      withTiming(0, { duration: BACKLINE_MELEE_DASH_WINDUP_MS }),
      withTiming(dashTargetY, {
        duration: BACKLINE_MELEE_DASH_MS,
        easing: Easing.inOut(Easing.cubic),
      }),
      withTiming(dashTargetY, { duration: BACKLINE_MELEE_DASH_HOLD_MS }),
      withTiming(0, {
        duration: BACKLINE_MELEE_DASH_RETURN_MS,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [backlineMeleeDashSeq, frozen, idlePhase, meleeDashDelta, meleeDashX, meleeDashY, stepScale, stepX]);

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
        {
          translateY: idlePhase.value * -IDLE_TRAVEL_Y + meleeDashY.value,
        },
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
