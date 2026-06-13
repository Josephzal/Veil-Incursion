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
import type { EnemyTurnPhase } from '../../utils/combatTelemetryFormat';
import {
  BACKLINE_MELEE_DASH_HOLD_MS,
  BACKLINE_MELEE_DASH_MS,
  BACKLINE_MELEE_DASH_RETURN_MS,
  BACKLINE_MELEE_DASH_WINDUP_MS,
  BACKLINE_MELEE_DASH_WINDUP_X,
  FRONTLINE_MELEE_ATTACK_X,
  FRONTLINE_MELEE_RETURN_IDLE_MS,
  FRONTLINE_MELEE_SNAP_MS,
  FRONTLINE_RANGED_RETURN_IDLE_MS,
  FRONTLINE_STAND_MS,
  FRONTLINE_STAND_X,
} from './combatEnemyBarLayout';

const IDLE_CYCLE_MS = 3200;
const IDLE_HALF_MS = IDLE_CYCLE_MS / 2;
const IDLE_TRAVEL_Y = 1.5;
const IDLE_SCALE_MIN = 0.99;
const STAND_SCALE = 1.05;
const RECOIL_X = 15;

interface CombatEnemyAnchorMotionProps {
  children: React.ReactNode;
  /** null = idle at base placement */
  turnPhase?: EnemyTurnPhase | null;
  isBacklineDashing?: boolean;
  hitFlashSeq?: number;
  backlineMeleeDashSeq?: number;
  meleeDashDelta?: { x: number; y: number };
  frozen?: boolean;
}

export default function CombatEnemyAnchorMotion({
  children,
  turnPhase = null,
  isBacklineDashing = false,
  hitFlashSeq = 0,
  backlineMeleeDashSeq = 0,
  meleeDashDelta,
  frozen = false,
}: CombatEnemyAnchorMotionProps): React.JSX.Element {
  const lastHitRef = useRef(0);
  const lastDashRef = useRef(0);
  const idlePhase = useSharedValue(0);
  const breatheActive = useSharedValue(1);
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
    if (frozen || isBacklineDashing || turnPhase != null) {
      cancelAnimation(idlePhase);
      if (!frozen && turnPhase == null) {
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
  }, [frozen, idlePhase, isBacklineDashing, turnPhase]);

  useEffect(() => {
    breatheActive.value = turnPhase == null ? 1 : 0;
  }, [breatheActive, turnPhase]);

  useEffect(() => {
    if (frozen || isBacklineDashing) return;

    cancelAnimation(stepX);
    cancelAnimation(stepScale);

    if (!turnPhase) {
      stepX.value = withTiming(0, {
        duration: FRONTLINE_RANGED_RETURN_IDLE_MS,
        easing: Easing.out(Easing.cubic),
      });
      stepScale.value = withTiming(1, {
        duration: FRONTLINE_RANGED_RETURN_IDLE_MS,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    if (turnPhase === 'reading' || turnPhase === 'buff' || turnPhase === 'ranged_attack') {
      stepX.value = withTiming(FRONTLINE_STAND_X, {
        duration: turnPhase === 'reading' ? FRONTLINE_STAND_MS : 0,
        easing: Easing.out(Easing.cubic),
      });
      stepScale.value = withTiming(STAND_SCALE, {
        duration: turnPhase === 'reading' ? FRONTLINE_STAND_MS : 0,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    if (turnPhase === 'melee_attack') {
      stepX.value = withSequence(
        withTiming(FRONTLINE_STAND_X, { duration: 0 }),
        withSpring(FRONTLINE_MELEE_ATTACK_X, {
          damping: 16,
          stiffness: 480,
          mass: 0.55,
        }),
        withTiming(0, {
          duration: FRONTLINE_MELEE_RETURN_IDLE_MS,
          easing: Easing.in(Easing.quad),
        }),
      );
      stepScale.value = withSequence(
        withTiming(STAND_SCALE, { duration: 0 }),
        withTiming(STAND_SCALE * 1.03, { duration: FRONTLINE_MELEE_SNAP_MS }),
        withTiming(1, {
          duration: FRONTLINE_MELEE_RETURN_IDLE_MS,
          easing: Easing.in(Easing.quad),
        }),
      );
    }
  }, [frozen, isBacklineDashing, stepScale, stepX, turnPhase]);

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
        easing: Easing.in(Easing.quad),
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
        easing: Easing.in(Easing.quad),
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

    const breatheScale = 1 - idlePhase.value * (1 - IDLE_SCALE_MIN) * breatheActive.value;

    return {
      transform: [
        { translateX: stepX.value + recoilX.value + meleeDashX.value },
        {
          translateY: idlePhase.value * -IDLE_TRAVEL_Y * breatheActive.value + meleeDashY.value,
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
