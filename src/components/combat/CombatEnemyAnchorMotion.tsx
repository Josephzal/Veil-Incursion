import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
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
  FRONTLINE_MELEE_HOLD_MS,
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
/** Default hit recoil (non-Warden). Warden uses stronger timed impulse. */
const RECOIL_X = 10;
const RECOIL_X_REDUCED = 3;
const RETURN_EASING = Easing.out(Easing.cubic);

interface CombatEnemyAnchorMotionProps {
  children: React.ReactNode;
  /** null = idle at base placement */
  turnPhase?: EnemyTurnPhase | null;
  isBacklineDashing?: boolean;
  hitFlashSeq?: number;
  backlineMeleeDashSeq?: number;
  meleeDashDelta?: { x: number; y: number };
  frozen?: boolean;
  /** CombatEnemyWrapper scale — recoil is divided so configured px lands in screen space. */
  layoutUnitScale?: number;
}

export default function CombatEnemyAnchorMotion({
  children,
  turnPhase = null,
  isBacklineDashing = false,
  hitFlashSeq = 0,
  backlineMeleeDashSeq = 0,
  meleeDashDelta,
  frozen = false,
  layoutUnitScale = 1,
}: CombatEnemyAnchorMotionProps): React.JSX.Element {
  const lastHitRef = useRef(0);
  const lastDashRef = useRef(0);
  const lastTurnPhaseRef = useRef<EnemyTurnPhase | null>(null);
  const frozenRef = useRef(frozen);
  const backlineDashRef = useRef(isBacklineDashing);
  const turnPhaseRef = useRef(turnPhase);
  frozenRef.current = frozen;
  backlineDashRef.current = isBacklineDashing;
  turnPhaseRef.current = turnPhase;
  const idlePhase = useSharedValue(0);
  const breatheActive = useSharedValue(1);
  const stepX = useSharedValue(0);
  const stepScale = useSharedValue(1);
  const recoilX = useSharedValue(0);
  const recoilRot = useSharedValue(0);
  const meleeDashX = useSharedValue(0);
  const meleeDashY = useSharedValue(0);
  const motionLocked = useSharedValue(0);
  const resumeIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResumeIdleTimer = () => {
    if (resumeIdleTimerRef.current != null) {
      clearTimeout(resumeIdleTimerRef.current);
      resumeIdleTimerRef.current = null;
    }
  };

  const startIdleBreathe = () => {
    if (frozenRef.current || backlineDashRef.current || turnPhaseRef.current != null) return;
    cancelAnimation(idlePhase);
    idlePhase.value = 0;
    breatheActive.value = 1;
    idlePhase.value = withRepeat(
      withTiming(1, {
        duration: IDLE_HALF_MS,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  };

  // Don't cancel an in-flight Warden recoil when something else freezes the portrait.
  useEffect(() => {
    motionLocked.value = frozen ? 1 : 0;
    if (!frozen) return;

    let wardenActive = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const wardenMod = require('../../data/wardenStrikePresentation') as {
        isWardenStrikePresentationActive: () => boolean;
      };
      wardenActive = wardenMod.isWardenStrikePresentationActive();
    } catch {
      wardenActive = false;
    }

    clearResumeIdleTimer();
    cancelAnimation(idlePhase);
    cancelAnimation(meleeDashX);
    cancelAnimation(meleeDashY);
    cancelAnimation(stepX);
    cancelAnimation(stepScale);
    if (!wardenActive) {
      cancelAnimation(recoilX);
      cancelAnimation(recoilRot);
      recoilX.value = 0;
      recoilRot.value = 0;
    }

    idlePhase.value = 0;
    meleeDashX.value = 0;
    meleeDashY.value = 0;
    stepX.value = 0;
    stepScale.value = 1;
  }, [frozen, idlePhase, meleeDashX, meleeDashY, motionLocked, recoilRot, recoilX, stepScale, stepX]);

  useEffect(() => {
    if (turnPhase != null) {
      breatheActive.value = 0;
      return;
    }
    breatheActive.value = withTiming(1, {
      duration: FRONTLINE_RANGED_RETURN_IDLE_MS,
      easing: RETURN_EASING,
    });
  }, [breatheActive, turnPhase]);

  useEffect(() => {
    if (frozen || isBacklineDashing || turnPhase != null) {
      clearResumeIdleTimer();
      cancelAnimation(idlePhase);
      return;
    }

    startIdleBreathe();
    return () => {
      clearResumeIdleTimer();
      cancelAnimation(idlePhase);
    };
    // startIdleBreathe closes over frozen/dash/turnPhase — deps match those gates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen, idlePhase, isBacklineDashing, turnPhase]);

  useEffect(() => {
    if (frozen || isBacklineDashing) return;

    if (!turnPhase) {
      const prev = lastTurnPhaseRef.current;
      lastTurnPhaseRef.current = null;

      if (prev === 'melee_attack' || prev === 'ranged_attack') {
        cancelAnimation(stepX);
        cancelAnimation(stepScale);
        stepX.value = 0;
        stepScale.value = 1;
      } else if (prev === 'reading' || prev === 'buff') {
        stepX.value = withTiming(0, {
          duration: FRONTLINE_RANGED_RETURN_IDLE_MS,
          easing: RETURN_EASING,
        });
        stepScale.value = withTiming(1, {
          duration: FRONTLINE_RANGED_RETURN_IDLE_MS,
          easing: RETURN_EASING,
        });
      }
      return;
    }

    lastTurnPhaseRef.current = turnPhase;
    cancelAnimation(stepX);
    cancelAnimation(stepScale);

    if (turnPhase === 'reading' || turnPhase === 'buff' || turnPhase === 'ranged_attack') {
      stepX.value = withTiming(FRONTLINE_STAND_X, {
        duration: turnPhase === 'reading' ? FRONTLINE_STAND_MS : 0,
        easing: RETURN_EASING,
      });
      stepScale.value = withTiming(STAND_SCALE, {
        duration: turnPhase === 'reading' ? FRONTLINE_STAND_MS : 0,
        easing: RETURN_EASING,
      });
      return;
    }

    if (turnPhase === 'melee_attack') {
      stepX.value = withSequence(
        withTiming(FRONTLINE_MELEE_ATTACK_X, {
          duration: FRONTLINE_MELEE_SNAP_MS,
          easing: Easing.out(Easing.cubic),
        }),
        withDelay(
          FRONTLINE_MELEE_HOLD_MS,
          withTiming(FRONTLINE_MELEE_ATTACK_X, { duration: 0 }),
        ),
        withTiming(0, {
          duration: FRONTLINE_MELEE_RETURN_IDLE_MS,
          easing: RETURN_EASING,
        }),
      );
      stepScale.value = withSequence(
        withTiming(STAND_SCALE * 1.03, {
          duration: FRONTLINE_MELEE_SNAP_MS,
          easing: Easing.out(Easing.cubic),
        }),
        withDelay(
          FRONTLINE_MELEE_HOLD_MS,
          withTiming(STAND_SCALE * 1.03, { duration: 0 }),
        ),
        withTiming(1, {
          duration: FRONTLINE_MELEE_RETURN_IDLE_MS,
          easing: RETURN_EASING,
        }),
      );
    }
  }, [frozen, isBacklineDashing, stepScale, stepX, turnPhase]);

  useEffect(() => {
    if (hitFlashSeq <= 0 || hitFlashSeq === lastHitRef.current) return;
    lastHitRef.current = hitFlashSeq;
    let reducedMotion = false;
    let wardenActive = false;
    let recoilPx = RECOIL_X;
    let recoilOutMs = 50;
    let recoilReturnMs = 100;
    let recoilDeg = 0;
    let wardenReducedRecoilPx = RECOIL_X_REDUCED;
    let hitStopMs = 0;
    try {
      // Lazy — keep this file free of circular combat-presentation imports at module load.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const settingsMod = require('../../data/weaponCombatPresentation/presentationSettings') as {
        getCombatPresentationSettings: () => { reducedMotion: boolean };
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const wardenMod = require('../../data/wardenStrikePresentation') as {
        isWardenStrikePresentationActive: () => boolean;
        WARDEN_STRIKE_TIMELINE_MS: {
          enemyRecoilPx: number;
          enemyRecoilOutMs: number;
          enemyRecoilReturnMs: number;
          enemyRecoilDeg: number;
          reducedMotionRecoilPx: number;
          hitStop: number;
        };
        WARDEN_STRIKE_VFX_LAYER_TOGGLES: { enemyRecoil: boolean };
      };
      reducedMotion = settingsMod.getCombatPresentationSettings().reducedMotion;
      wardenActive = wardenMod.isWardenStrikePresentationActive();
      if (!wardenMod.WARDEN_STRIKE_VFX_LAYER_TOGGLES.enemyRecoil && wardenActive) {
        return;
      }
      if (wardenActive) {
        recoilPx = wardenMod.WARDEN_STRIKE_TIMELINE_MS.enemyRecoilPx;
        recoilOutMs = wardenMod.WARDEN_STRIKE_TIMELINE_MS.enemyRecoilOutMs;
        recoilReturnMs = wardenMod.WARDEN_STRIKE_TIMELINE_MS.enemyRecoilReturnMs;
        recoilDeg = wardenMod.WARDEN_STRIKE_TIMELINE_MS.enemyRecoilDeg;
        wardenReducedRecoilPx = wardenMod.WARDEN_STRIKE_TIMELINE_MS.reducedMotionRecoilPx;
        hitStopMs = reducedMotion
          ? Math.max(20, Math.floor(wardenMod.WARDEN_STRIKE_TIMELINE_MS.hitStop * 0.6))
          : wardenMod.WARDEN_STRIKE_TIMELINE_MS.hitStop;
      }
    } catch {
      reducedMotion = false;
    }
    if (reducedMotion) {
      recoilPx = wardenActive ? wardenReducedRecoilPx : RECOIL_X_REDUCED;
      recoilDeg = 0;
      recoilOutMs = 40;
      recoilReturnMs = 70;
    }
    let recoilSign = 1;
    if (wardenActive) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const approachMod = require('../../data/wardenStrikeApproach') as {
          getWardenRecoilSignX: () => number;
        };
        recoilSign = approachMod.getWardenRecoilSignX();
      } catch {
        recoilSign = 1;
      }
    }
    cancelAnimation(recoilX);
    cancelAnimation(recoilRot);
    clearResumeIdleTimer();
    recoilX.value = 0;
    recoilRot.value = 0;
    // Compensate CombatEnemyWrapper layoutUnitScale so configured CSS px is final screen motion.
    const parentScale = Math.max(0.35, layoutUnitScale || 1);
    const screenRecoilPx = recoilPx / parentScale;
    // Warden: freeze portrait idle through hit-stop, then recoil immediately on release.
    if (wardenActive && hitStopMs > 0) {
      cancelAnimation(idlePhase);
      idlePhase.value = 0;
      motionLocked.value = 1;
    }
    const recoilSequence = withSequence(
      withTiming(screenRecoilPx * recoilSign, {
        duration: recoilOutMs,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(0, {
        duration: recoilReturnMs,
        easing: RETURN_EASING,
      }),
    );
    recoilX.value = hitStopMs > 0
      ? withDelay(hitStopMs, recoilSequence)
      : recoilSequence;
    if (recoilDeg !== 0) {
      const rotSequence = withSequence(
        withTiming(recoilDeg, {
          duration: recoilOutMs,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0, {
          duration: recoilReturnMs,
          easing: RETURN_EASING,
        }),
      );
      recoilRot.value = hitStopMs > 0
        ? withDelay(hitStopMs, rotSequence)
        : rotSequence;
    }
    // Resume breathing after hit-stop + recoil settle (hit VFX window).
    const resumeIdleMs = hitStopMs + recoilOutMs + recoilReturnMs + 16;
    resumeIdleTimerRef.current = setTimeout(() => {
      resumeIdleTimerRef.current = null;
      startIdleBreathe();
    }, resumeIdleMs);

    if (wardenActive && hitStopMs > 0) {
      const unlockTimer = setTimeout(() => {
        motionLocked.value = frozen ? 1 : 0;
      }, hitStopMs);
      return () => {
        clearTimeout(unlockTimer);
        clearResumeIdleTimer();
      };
    }
    if (
      typeof __DEV__ !== 'undefined'
      && __DEV__
      && wardenActive
    ) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const toggles = require('../../data/wardenStrikePresentation') as {
          WARDEN_STRIKE_VFX_LAYER_TOGGLES: { recoilIsolationMode: boolean };
        };
        if (toggles.WARDEN_STRIKE_VFX_LAYER_TOGGLES.recoilIsolationMode) {
          // eslint-disable-next-line no-console
          console.info('[WARDEN RECOIL PROOF]', {
            configuredRecoilPx: recoilPx,
            layoutUnitScale: parentScale,
            screenRecoilPx,
            recoilDeg,
            recoilOutMs,
            recoilReturnMs,
            recoilSign,
          });
        }
      } catch {
        // ignore
      }
    }
    return () => {
      clearResumeIdleTimer();
    };
  }, [frozen, hitFlashSeq, idlePhase, layoutUnitScale, motionLocked, recoilRot, recoilX]);

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
        easing: RETURN_EASING,
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
        easing: RETURN_EASING,
      }),
    );
  }, [backlineMeleeDashSeq, frozen, idlePhase, meleeDashDelta, meleeDashX, meleeDashY, stepScale, stepX]);

  const motionStyle = useAnimatedStyle(() => {
    if (motionLocked.value === 1) {
      // Keep Warden recoil visible even if hit-stop locks other motion.
      return {
        transform: [
          { translateX: recoilX.value },
          { translateY: 0 },
          { rotate: `${recoilRot.value}deg` },
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
        { rotate: `${recoilRot.value}deg` },
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
