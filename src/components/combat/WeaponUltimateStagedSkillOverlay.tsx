import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import type { WeaponUltimateId } from '../../data/weaponUltimateRegistry';
import { getWu4StagedScript } from '../../data/weaponUltimateStagedScripts';
import { gradeFromStageScores } from '../../data/weaponUltimateNewResolveEngine';
import type { WeaponUltimateGrade } from '../../types/weaponUltimateInteraction';

interface WeaponUltimateStagedSkillOverlayProps {
  visible: boolean;
  ultimateId: WeaponUltimateId | null;
  simplified?: boolean;
  /** Fired when the window expires with no meaningful player input — must not commit. */
  onCancel?: () => void;
  onComplete: (payload: { grade: WeaponUltimateGrade; stageScores: number[] }) => void;
}

/**
 * Art-independent staged hold skill for WU-4 ultimates.
 * Player holds CONFIRM through each stage; missed holds score low.
 * Timer expiry with zero interaction cancels free — never auto-commits.
 */
export default function WeaponUltimateStagedSkillOverlay({
  visible,
  ultimateId,
  simplified = false,
  onCancel,
  onComplete,
}: WeaponUltimateStagedSkillOverlayProps): React.JSX.Element | null {
  const script = ultimateId ? getWu4StagedScript(ultimateId) : null;
  const [stageIndex, setStageIndex] = useState(0);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const scoresRef = useRef<number[]>([]);
  const finishedRef = useRef(false);
  const holdingRef = useRef(false);
  const progressRef = useRef(0);
  const stageIndexRef = useRef(0);
  const interactedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onCancelRef = useRef(onCancel);
  onCompleteRef.current = onComplete;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!visible || !script) {
      finishedRef.current = false;
      scoresRef.current = [];
      holdingRef.current = false;
      progressRef.current = 0;
      stageIndexRef.current = 0;
      interactedRef.current = false;
      setStageIndex(0);
      setHolding(false);
      setHoldProgress(0);
      return;
    }

    finishedRef.current = false;
    scoresRef.current = [];
    holdingRef.current = false;
    progressRef.current = 0;
    stageIndexRef.current = 0;
    interactedRef.current = false;
    setStageIndex(0);
    setHolding(false);
    setHoldProgress(0);

    if (simplified) {
      const timer = setTimeout(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onCompleteRef.current({ grade: 'STANDARD', stageScores: [0.4, 0.4, 0.4] });
      }, 400);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const live = holdingRef.current ? progressRef.current : 0;
      const scores = [...scoresRef.current];
      while (scores.length < stageIndexRef.current) scores.push(0);
      if (scores.length === stageIndexRef.current) scores.push(live);
      while (scores.length < script.stages.length) scores.push(0);
      const anyInput = interactedRef.current || scores.some((s) => s > 0.05);
      if (!anyInput) {
        onCancelRef.current?.();
        return;
      }
      onCompleteRef.current({
        grade: gradeFromStageScores(scores),
        stageScores: scores,
      });
    }, script.durationMs);

    return () => clearTimeout(timer);
  }, [visible, ultimateId, simplified, script]);

  useEffect(() => {
    if (!visible || !holding || simplified || !script || finishedRef.current) return undefined;
    const started = Date.now();
    const needMs = 420;
    const tick = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / needMs);
      progressRef.current = p;
      setHoldProgress(p);
      if (p >= 1) {
        clearInterval(tick);
        holdingRef.current = false;
        setHolding(false);
        const nextScores = [...scoresRef.current, 1];
        scoresRef.current = nextScores;
        const nextIdx = stageIndexRef.current + 1;
        if (nextIdx >= script.stages.length) {
          if (finishedRef.current) return;
          finishedRef.current = true;
          onCompleteRef.current({
            grade: gradeFromStageScores(nextScores),
            stageScores: nextScores,
          });
          return;
        }
        stageIndexRef.current = nextIdx;
        setStageIndex(nextIdx);
        progressRef.current = 0;
        setHoldProgress(0);
      }
    }, 32);
    return () => clearInterval(tick);
  }, [holding, visible, simplified, script]);

  if (!visible || !script) return null;

  const stage = script.stages[Math.min(stageIndex, script.stages.length - 1)];
  const barWidth = `${Math.round(holdProgress * 100)}%` as `${number}%`;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.title}>{script.title}</Text>
        <Text style={styles.timer}>
          {simplified
            ? 'SIMPLIFIED — STANDARD COMMIT'
            : `STAGE ${stageIndex + 1}/${script.stages.length} — HOLD CONFIRM`}
        </Text>
        <Text style={styles.stageLabel}>{stage.label}</Text>
        <Text style={styles.instruction}>{stage.instruction}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: barWidth }]} />
        </View>
        <Text style={styles.scoreHint}>
          {`LOCKED ${scoresRef.current.filter((s) => s >= 0.85).length}/${script.stages.length}`}
        </Text>
      </View>
      {!simplified ? (
        <HapticPressable
          style={styles.holdZone}
          onPressIn={() => {
            if (finishedRef.current) return;
            interactedRef.current = true;
            holdingRef.current = true;
            setHolding(true);
          }}
          onPressOut={() => {
            if (finishedRef.current) return;
            if (progressRef.current >= 1) return;
            interactedRef.current = true;
            const partial = progressRef.current;
            holdingRef.current = false;
            setHolding(false);
            const nextScores = [...scoresRef.current, partial];
            scoresRef.current = nextScores;
            const nextIdx = stageIndexRef.current + 1;
            if (nextIdx >= script.stages.length) {
              if (finishedRef.current) return;
              finishedRef.current = true;
              onCompleteRef.current({
                grade: gradeFromStageScores(nextScores),
                stageScores: nextScores,
              });
              return;
            }
            stageIndexRef.current = nextIdx;
            setStageIndex(nextIdx);
            progressRef.current = 0;
            setHoldProgress(0);
          }}
          accessibilityLabel={`Hold to complete ${stage.label}`}
        >
          <Text style={styles.holdLabel}>[ HOLD CONFIRM ]</Text>
        </HapticPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hud: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 1.2,
  },
  timer: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#94a3b8',
  },
  stageLabel: {
    marginTop: 4,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  instruction: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  track: {
    marginTop: 8,
    width: '70%',
    maxWidth: 280,
    height: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(51, 65, 85, 0.9)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#38bdf8',
  },
  scoreHint: {
    marginTop: 4,
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#64748b',
  },
  holdZone: {
    marginTop: 48,
    minWidth: 220,
    paddingVertical: 28,
    paddingHorizontal: 36,
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.85)',
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdLabel: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: '#e0f2fe',
    letterSpacing: 1,
  },
});
