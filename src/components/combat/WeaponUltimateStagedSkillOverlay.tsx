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
  onComplete: (payload: { grade: WeaponUltimateGrade; stageScores: number[] }) => void;
}

/**
 * Art-independent staged hold skill for WU-4 ultimates.
 * Player holds CONFIRM through each stage; missed holds score low.
 * Timer auto-commits with whatever stage quality was earned.
 */
export default function WeaponUltimateStagedSkillOverlay({
  visible,
  ultimateId,
  simplified = false,
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
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!visible || !script) {
      finishedRef.current = false;
      scoresRef.current = [];
      holdingRef.current = false;
      progressRef.current = 0;
      stageIndexRef.current = 0;
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
      // Credit partial hold on the live stage, then pad remaining stages as misses.
      const live = holdingRef.current ? progressRef.current : 0;
      const scores = [...scoresRef.current];
      while (scores.length < stageIndexRef.current) scores.push(0);
      if (scores.length === stageIndexRef.current) scores.push(live);
      while (scores.length < script.stages.length) scores.push(0);
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
            holdingRef.current = true;
            setHolding(true);
          }}
          onPressOut={() => {
            if (finishedRef.current) return;
            if (progressRef.current >= 1) return;
            // Release early — bank partial score and advance.
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
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    elevation: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hud: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: 1,
  },
  timer: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#94a3b8',
  },
  stageLabel: {
    marginTop: 8,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 2,
  },
  instruction: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  track: {
    marginTop: 10,
    width: '70%',
    maxWidth: 280,
    height: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.55)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#94a3b8',
  },
  scoreHint: {
    fontFamily: 'monospace',
    fontSize: 8,
    color: '#64748b',
  },
  holdZone: {
    marginTop: 120,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.55)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  holdLabel: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 1,
  },
});
