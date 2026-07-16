import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import {
  NARRATIVE_UNIFIED_PANEL_BG,
  NARRATIVE_UNIFIED_PANEL_BORDER,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import HapticPressable from '../../HapticPressable';
import type { TensionMechanicProps } from './tensionMechanicTypes';
import {
  adjustParams,
  concordance,
  generateRiteOfConcordance,
  isThreadCleansed,
  riteWaveY,
  RITE_CONFIG,
  type RiteOfConcordancePuzzle,
  type RiteProperty,
  type RiteWaveParams,
} from './riteOfConcordanceEngine';
import { logNarrativeMinigameCompleted } from '../../../data/narrative/narrativeMinigameTelemetry';

const CYAN = '#22d3ee';
const CYAN_SOFT = '#67e8f9';
const VIOLET = '#a855f7';
const WHITE_BLUE = '#bae6fd';
const WHITE_HOT = '#f0f9ff';
const CORRUPT = '#e0447a';
const CORRUPT_SOFT = 'rgba(224, 68, 122, 0.55)';
const RED = '#ef4444';
const RED_BLACK = '#450a0a';
const AMBER = '#fbbf24';
const BODY_MUTED = '#94A3B8';
const MUTED_WHITE = '#F8FAFC';
const DISC_FILL = '#04060a';

const TICK_MS = 100;
const { threadCount: THREAD_COUNT, alignmentThreshold: THRESHOLD, stabilityMax: STABILITY_MAX } = RITE_CONFIG;

const THREAD_LABEL: Record<number, string> = { 0: 'BLOOD', 1: 'ASH', 2: 'VOID' };

const SUCCESS_LINES = [
  'The three chants fall into concordance. The ritual seal fractures and evaporates.',
  'All corruption is purified. The rite yields its clean reward.',
] as const;

const FAILURE_LINES = [
  'The counter-chant collapses. RITE CONTAMINATED.',
  'Dissonance floods the circle — the threads snap red and the offering is lost.',
] as const;

/**
 * Rite of Concordance — occult ritual-cleanse minigame for Mechanic_RiteOfConcordance.
 * Tune each thread's counter-chant (Phase / Frequency / Intensity) to overlay the
 * corruption trace to Concordance ≥ threshold; survive Dissonance Bursts; cleanse
 * all three threads before Stability drains. No run-state mutation.
 */
export default function RiteOfConcordance({
  onSuccess,
  onFailure,
  defaultPenalty,
  difficulty,
  narrativeEventId,
}: TensionMechanicProps): React.JSX.Element {
  const { scaleSize, scaleSpacing, scaleFont } = useResponsiveLayout();
  const startedAtRef = useRef(Date.now());
  const seed = `rite-of-concordance:${narrativeEventId ?? 'live'}`;

  const puzzle = useMemo<RiteOfConcordancePuzzle>(() => generateRiteOfConcordance(seed), [seed]);

  const [params, setParams] = useState<RiteWaveParams[]>(() => puzzle.threads.map((t) => ({ ...t.start })));
  const [locked, setLocked] = useState<boolean[]>(() => puzzle.threads.map(() => false));
  const [selected, setSelected] = useState(0);
  const [stability, setStability] = useState<number>(STABILITY_MAX);
  const [burstThread, setBurstThread] = useState<number | null>(null);
  const [burstRemaining, setBurstRemaining] = useState(0);
  const [drift, setDrift] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [resolveState, setResolveState] = useState<'playing' | 'success' | 'failure'>('playing');
  const [boardW, setBoardW] = useState(0);

  const paramsRef = useRef(params);
  const lockedRef = useRef(locked);
  const selectedRef = useRef(selected);
  const stabilityRef = useRef<number>(STABILITY_MAX);
  const resolvedRef = useRef(false);
  const elapsedRef = useRef(0);
  const nextBurstAtRef = useRef(puzzle.burstIntervalsSec[0] ?? 7);
  const burstIdxRef = useRef(0);
  const burstThreadRef = useRef<number | null>(null);
  const burstEndsAtRef = useRef(0);
  const wrongAdjustCdRef = useRef(0);
  paramsRef.current = params;
  lockedRef.current = locked;
  selectedRef.current = selected;

  const failLock = useRef(new Animated.Value(0)).current;

  const finish = useCallback((win: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolveState(win ? 'success' : 'failure');
    setBurstThread(null);
    burstThreadRef.current = null;
    setMessage(null);
    if (!win) {
      Animated.timing(failLock, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_RiteOfConcordance',
      difficulty,
      success: win,
      timeElapsedMs: Date.now() - startedAtRef.current,
      narrativeEventId,
    });
    if (win) onSuccess();
    else onFailure();
  }, [difficulty, failLock, narrativeEventId, onFailure, onSuccess]);

  const cleanseThread = useCallback((index: number) => {
    if (lockedRef.current[index]) return;
    const nextLocked = lockedRef.current.map((v, i) => (i === index ? true : v));
    lockedRef.current = nextLocked;
    setLocked(nextLocked);
    setBurstThread(null);
    burstThreadRef.current = null;
    setMessage(`${THREAD_LABEL[index]} THREAD CLEANSED`);
    if (nextLocked.every(Boolean)) {
      finish(true);
      return;
    }
    // Advance selection to the next uncleansed thread.
    const nextIdx = nextLocked.findIndex((v) => !v);
    if (nextIdx >= 0) {
      selectedRef.current = nextIdx;
      setSelected(nextIdx);
    }
  }, [finish]);

  const dropStability = useCallback((amount: number, msg: string) => {
    stabilityRef.current = Math.max(0, stabilityRef.current - amount);
    setStability(stabilityRef.current);
    setMessage(msg);
    if (stabilityRef.current <= 0) finish(false);
  }, [finish]);

  // Real-time loop: drives waveform drift + Dissonance Burst scheduling/resolution.
  useEffect(() => {
    if (resolveState !== 'playing') return undefined;
    const id = setInterval(() => {
      if (resolvedRef.current) return;
      const dt = TICK_MS / 1000;
      elapsedRef.current += dt;
      setDrift((d) => (d + dt * 0.14) % 1);
      if (wrongAdjustCdRef.current > 0) wrongAdjustCdRef.current -= dt;

      const anyUnlocked = lockedRef.current.some((v) => !v);
      if (!anyUnlocked) return;

      const activeBurst = burstThreadRef.current;
      if (activeBurst != null) {
        const align = concordance(paramsRef.current[activeBurst]!, puzzle.threads[activeBurst]!.target);
        if (isThreadCleansed(align)) {
          cleanseThread(activeBurst);
          burstIdxRef.current += 1;
          nextBurstAtRef.current = elapsedRef.current
            + (puzzle.burstIntervalsSec[burstIdxRef.current % puzzle.burstIntervalsSec.length] ?? 7);
          setBurstRemaining(0);
          return;
        }
        const remaining = burstEndsAtRef.current - elapsedRef.current;
        setBurstRemaining(Math.max(0, remaining));
        if (remaining <= 0) {
          burstThreadRef.current = null;
          setBurstThread(null);
          burstIdxRef.current += 1;
          nextBurstAtRef.current = elapsedRef.current
            + (puzzle.burstIntervalsSec[burstIdxRef.current % puzzle.burstIntervalsSec.length] ?? 7);
          dropStability(RITE_CONFIG.burstFailPenalty, 'DISSONANCE LANDED // STABILITY LOST');
        }
        return;
      }

      // No active burst — start one when scheduled.
      if (elapsedRef.current >= nextBurstAtRef.current) {
        const pick = puzzle.burstThreadPicks[burstIdxRef.current % puzzle.burstThreadPicks.length] ?? 0;
        let target = pick;
        if (lockedRef.current[target]) {
          const alt = lockedRef.current.findIndex((v) => !v);
          target = alt >= 0 ? alt : target;
        }
        if (!lockedRef.current[target]) {
          burstThreadRef.current = target;
          burstEndsAtRef.current = elapsedRef.current + RITE_CONFIG.burstWindowSec;
          setBurstThread(target);
          setBurstRemaining(RITE_CONFIG.burstWindowSec);
          selectedRef.current = target;
          setSelected(target);
          setMessage(`DISSONANCE RISING // ${THREAD_LABEL[target]} THREAD`);
        }
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [cleanseThread, dropStability, puzzle, resolveState]);

  const selectThread = useCallback((index: number) => {
    if (resolvedRef.current || lockedRef.current[index]) return;
    const activeBurst = burstThreadRef.current;
    if (activeBurst != null && index !== activeBurst) {
      if (wrongAdjustCdRef.current <= 0) {
        wrongAdjustCdRef.current = 0.5;
        dropStability(RITE_CONFIG.wrongAdjustPenalty, 'FOCUS THE DESTABILIZED THREAD');
      }
      return;
    }
    selectedRef.current = index;
    setSelected(index);
  }, [dropStability]);

  const adjust = useCallback((property: RiteProperty, dir: 1 | -1) => {
    if (resolvedRef.current || resolveState !== 'playing') return;
    const idx = selectedRef.current;
    if (lockedRef.current[idx]) return;
    setParams((prev) => prev.map((p, i) => (i === idx ? adjustParams(p, property, dir) : p)));
    setMessage(null);
  }, [resolveState]);

  const cleanseSelected = useCallback(() => {
    if (resolvedRef.current || resolveState !== 'playing') return;
    const idx = selectedRef.current;
    if (lockedRef.current[idx]) return;
    const align = concordance(paramsRef.current[idx]!, puzzle.threads[idx]!.target);
    if (isThreadCleansed(align)) {
      cleanseThread(idx);
      if (burstThreadRef.current === idx) {
        burstIdxRef.current += 1;
        nextBurstAtRef.current = elapsedRef.current
          + (puzzle.burstIntervalsSec[burstIdxRef.current % puzzle.burstIntervalsSec.length] ?? 7);
      }
    } else {
      setMessage('CONCORDANCE TOO LOW — TUNE THE COUNTER-CHANT');
    }
  }, [cleanseThread, puzzle, resolveState]);

  // --- Geometry -------------------------------------------------------------
  const bandW = boardW > 0 ? boardW : scaleSize(280);
  const bandH = scaleSize(48);
  const wavePad = scaleSize(6);
  const amp = bandH / 2 - scaleSize(6);
  const SAMPLES = 22;

  const buildWave = useCallback(
    (p: RiteWaveParams): { d: string; points: { x: number; y: number }[] } => {
      const midY = bandH / 2;
      const drawParams: RiteWaveParams = { ...p, phase: p.phase + drift };
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < SAMPLES; i += 1) {
        const t = i / (SAMPLES - 1);
        const x = wavePad + t * (bandW - wavePad * 2);
        const y = midY - riteWaveY(drawParams, t) * amp;
        points.push({ x, y });
      }
      const d = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
      return { d, points };
    },
    [amp, bandH, bandW, drift, wavePad],
  );

  const cleansedCount = locked.filter(Boolean).length;
  const stabilityPct = Math.round((stability / STABILITY_MAX) * 100);

  const selectedAlign = concordance(params[selected]!, puzzle.threads[selected]!.target);
  const selectedReady = !locked[selected] && isThreadCleansed(selectedAlign);

  const guidance = message
    ?? (burstThread != null
      ? `DISSONANCE ON ${THREAD_LABEL[burstThread]} — RAISE CONCORDANCE`
      : 'ALIGN COUNTER-CHANT TO THE CORRUPTION TRACE');
  const guidanceColor = message
    ? (/CLEANSED|STABILIZED/.test(message) ? WHITE_BLUE
      : /LOST|LANDED|LOW|FOCUS/.test(message) ? RED
        : /RISING/.test(message) ? AMBER : MUTED_WHITE)
    : burstThread != null ? RED : BODY_MUTED;

  const penaltyLine = useMemo(() => {
    if (!defaultPenalty) return null;
    return defaultPenalty.type === 'HP'
      ? `CONTAMINATION RISK — ${defaultPenalty.amount} HP (applied on fail by narrative)`
      : `CONTAMINATION RISK — +${defaultPenalty.amount} RESONANCE (applied on fail by narrative)`;
  }, [defaultPenalty]);

  const banner =
    resolveState === 'success'
      ? SUCCESS_LINES[puzzle.threads.length % SUCCESS_LINES.length]!
      : resolveState === 'failure'
        ? FAILURE_LINES[puzzle.threads.length % FAILURE_LINES.length]!
        : null;

  return (
    <View style={[styles.root, { padding: scaleSpacing(Math.min(NARRATIVE_UNIFIED_PANEL_PADDING, 8)) }]}>
      <View
        style={[
          styles.panel,
          { borderColor: NARRATIVE_UNIFIED_PANEL_BORDER, backgroundColor: NARRATIVE_UNIFIED_PANEL_BG },
        ]}
      >
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={{ padding: scaleSpacing(12), alignItems: 'stretch' }}
          showsVerticalScrollIndicator
        >
          <Text style={[styles.title, { fontSize: scaleFont(11) }]}>RITE OF CONCORDANCE // CLEANSE ACTIVE</Text>
          <Text style={[styles.subtitle, { fontSize: scaleFont(9), lineHeight: scaleFont(13) }]}>
            Align each counter-chant to the corruption trace. Purify all three ritual threads before the rite destabilizes.
          </Text>

          <View style={[styles.metaRow, { marginTop: scaleSpacing(6), gap: scaleSpacing(12) }]}>
            <View style={styles.stabilityBlock}>
              <View style={styles.traceHeader}>
                <Text style={[styles.meta, { fontSize: scaleFont(8), color: stabilityPct <= 30 ? RED : VIOLET }]}>PURITY / STABILITY</Text>
                <Text style={[styles.meta, { fontSize: scaleFont(8), color: MUTED_WHITE }]}>{stabilityPct}%</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.trackFill,
                    { width: `${stabilityPct}%`, backgroundColor: stabilityPct <= 30 ? RED : stabilityPct <= 60 ? AMBER : CYAN },
                  ]}
                />
              </View>
            </View>
            <Text style={[styles.meta, { fontSize: scaleFont(9), color: cleansedCount === THREAD_COUNT ? WHITE_BLUE : MUTED_WHITE }]}>
              {`${cleansedCount}/${THREAD_COUNT} PURE`}
            </Text>
          </View>

          <View style={[styles.statusLine, { marginTop: scaleSpacing(4) }]}>
            <Text style={[styles.statusText, { fontSize: scaleFont(9), color: guidanceColor }]} numberOfLines={2}>
              {guidance}
            </Text>
          </View>

          {/* Three ritual threads (glyph waveforms). */}
          <View style={{ alignSelf: 'stretch', marginTop: scaleSpacing(8), gap: scaleSpacing(8) }} onLayout={(e: LayoutChangeEvent) => setBoardW(e.nativeEvent.layout.width)}>
            {puzzle.threads.map((thread, i) => {
              const isLocked = locked[i]!;
              const isBurst = burstThread === i;
              const isSel = selected === i;
              const align = concordance(params[i]!, thread.target);
              const pct = Math.round(align * 100);
              const targetWave = buildWave(thread.target);
              const playerWave = buildWave(params[i]!);
              const borderColor = isLocked ? WHITE_BLUE : isBurst ? RED : isSel ? CYAN : '#243040';
              return (
                <HapticPressable
                  key={thread.id}
                  onPress={() => selectThread(i)}
                  disabled={isLocked || resolveState !== 'playing'}
                  style={[
                    styles.band,
                    {
                      borderColor,
                      borderWidth: isSel || isBurst || isLocked ? 2 : 1,
                      backgroundColor: isBurst ? 'rgba(69,10,10,0.35)' : 'rgba(0,0,0,0.35)',
                    },
                  ]}
                >
                  <View style={styles.bandHeader}>
                    <Text style={[styles.bandLabel, { fontSize: scaleFont(8.5), color: isLocked ? WHITE_BLUE : isBurst ? RED : VIOLET }]}>
                      {`${thread.id} THREAD`}
                    </Text>
                    <Text
                      style={[
                        styles.bandPct,
                        { fontSize: scaleFont(8.5), color: isLocked ? WHITE_BLUE : isBurst ? RED : pct >= THRESHOLD * 100 ? CYAN : BODY_MUTED },
                      ]}
                    >
                      {isLocked ? 'CLEANSED' : isBurst ? `DISSONANCE ${burstRemaining.toFixed(1)}s` : `${pct}% PURE`}
                    </Text>
                  </View>
                  <Svg width={bandW} height={bandH}>
                    <Rect x={0} y={0} width={bandW} height={bandH} fill={DISC_FILL} rx={scaleSize(4)} />
                    <Line x1={wavePad} y1={bandH / 2} x2={bandW - wavePad} y2={bandH / 2} stroke="rgba(56,89,120,0.18)" strokeWidth={1} />

                    {isLocked ? (
                      // Purified: single clean white-blue chant.
                      <G>
                        <Path d={playerWave.d} stroke={WHITE_BLUE} strokeWidth={2} fill="none" opacity={0.95} />
                        {playerWave.points.filter((_, k) => k % 2 === 0).map((pt, k) => (
                          <Circle key={`lk-${k}`} cx={pt.x} cy={pt.y} r={scaleSize(2)} fill={WHITE_HOT} />
                        ))}
                      </G>
                    ) : (
                      <G>
                        {/* corruption trace (target) */}
                        <Path d={targetWave.d} stroke={CORRUPT_SOFT} strokeWidth={2} fill="none" />
                        {targetWave.points.filter((_, k) => k % 2 === 0).map((pt, k) => (
                          <Path
                            key={`ct-${k}`}
                            d={`M ${pt.x - scaleSize(2)} ${pt.y} L ${pt.x + scaleSize(2)} ${pt.y} M ${pt.x} ${pt.y - scaleSize(2)} L ${pt.x} ${pt.y + scaleSize(2)}`}
                            stroke={CORRUPT}
                            strokeWidth={1.4}
                            opacity={isBurst ? 0.9 : 0.7}
                          />
                        ))}
                        {/* cleansing counter-chant (player) */}
                        <Path d={playerWave.d} stroke={CYAN} strokeWidth={1.6} fill="none" opacity={0.9} />
                        {playerWave.points.filter((_, k) => k % 2 === 1).map((pt, k) => (
                          <Circle key={`pl-${k}`} cx={pt.x} cy={pt.y} r={scaleSize(2)} fill={pct >= THRESHOLD * 100 ? WHITE_HOT : CYAN_SOFT} />
                        ))}
                      </G>
                    )}
                  </Svg>
                </HapticPressable>
              );
            })}
          </View>

          {/* Per-thread counter-chant controls. */}
          <View style={[styles.controls, { marginTop: scaleSpacing(10), gap: scaleSpacing(6) }]}>
            <ControlRow
              label="PHASE"
              hint="chant timing"
              leftLabel="◀"
              rightLabel="▶"
              onLeft={() => adjust('phase', -1)}
              onRight={() => adjust('phase', 1)}
              disabled={locked[selected]! || resolveState !== 'playing'}
              scaleFont={scaleFont}
              scaleSpacing={scaleSpacing}
            />
            <ControlRow
              label="FREQUENCY"
              hint="ritual cadence"
              leftLabel="−"
              rightLabel="+"
              onLeft={() => adjust('frequency', -1)}
              onRight={() => adjust('frequency', 1)}
              disabled={locked[selected]! || resolveState !== 'playing'}
              scaleFont={scaleFont}
              scaleSpacing={scaleSpacing}
            />
            <ControlRow
              label="INTENSITY"
              hint="offering pressure"
              leftLabel="−"
              rightLabel="+"
              onLeft={() => adjust('intensity', -1)}
              onRight={() => adjust('intensity', 1)}
              disabled={locked[selected]! || resolveState !== 'playing'}
              scaleFont={scaleFont}
              scaleSpacing={scaleSpacing}
            />
          </View>

          <HapticPressable
            onPress={cleanseSelected}
            disabled={!selectedReady || resolveState !== 'playing'}
            style={[
              styles.cleanseBtn,
              {
                marginTop: scaleSpacing(8),
                borderColor: selectedReady ? WHITE_HOT : '#243040',
                borderWidth: selectedReady ? 2 : 1,
                backgroundColor: selectedReady ? 'rgba(34,211,238,0.16)' : 'rgba(0,0,0,0.4)',
                opacity: selectedReady ? 1 : 0.55,
              },
            ]}
          >
            <Text style={[styles.cleanseText, { fontSize: scaleFont(10), color: selectedReady ? WHITE_HOT : BODY_MUTED }]}>
              {`[ CLEANSE ${THREAD_LABEL[selected]} THREAD ]`}
            </Text>
          </HapticPressable>

          <Text style={[styles.instruction, { fontSize: scaleFont(8), marginTop: scaleSpacing(8) }]}>
            Select a thread, then tune Phase / Frequency / Intensity until the cyan counter-chant overlays the red corruption trace ({Math.round(THRESHOLD * 100)}% concordance), and seal it. When a thread flickers with Dissonance, raise its concordance before the burst lands.
          </Text>

          {penaltyLine ? (
            <Text style={[styles.penalty, { fontSize: scaleFont(8), marginTop: scaleSpacing(4) }]}>{penaltyLine}</Text>
          ) : null}

          {banner ? (
            <Text
              style={[
                styles.banner,
                {
                  fontSize: scaleFont(10),
                  lineHeight: scaleFont(14),
                  color: resolveState === 'success' ? WHITE_BLUE : RED,
                  marginTop: scaleSpacing(6),
                },
              ]}
            >
              {banner}
            </Text>
          ) : null}
        </ScrollView>

        {/* failure contamination lock */}
        <Animated.View pointerEvents="none" style={[styles.failLock, { opacity: failLock.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]} />
      </View>
    </View>
  );
}

function ControlRow({
  label,
  hint,
  leftLabel,
  rightLabel,
  onLeft,
  onRight,
  disabled,
  scaleFont,
  scaleSpacing,
}: {
  label: string;
  hint: string;
  leftLabel: string;
  rightLabel: string;
  onLeft: () => void;
  onRight: () => void;
  disabled: boolean;
  scaleFont: (n: number) => number;
  scaleSpacing: (n: number) => number;
}): React.JSX.Element {
  return (
    <View style={[styles.controlRow, { gap: scaleSpacing(6) }]}>
      <View style={styles.controlLabelCol}>
        <Text style={[styles.controlLabel, { fontSize: scaleFont(9) }]}>{label}</Text>
        <Text style={[styles.controlHint, { fontSize: scaleFont(7) }]}>{hint}</Text>
      </View>
      <HapticPressable onPress={onLeft} disabled={disabled} style={[styles.stepBtn, { opacity: disabled ? 0.4 : 1 }]}>
        <Text style={[styles.stepText, { fontSize: scaleFont(12), color: disabled ? '#475569' : CYAN }]}>{leftLabel}</Text>
      </HapticPressable>
      <HapticPressable onPress={onRight} disabled={disabled} style={[styles.stepBtn, { opacity: disabled ? 0.4 : 1 }]}>
        <Text style={[styles.stepText, { fontSize: scaleFont(12), color: disabled ? '#475569' : CYAN }]}>{rightLabel}</Text>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  panel: { flex: 1, minHeight: 0, borderWidth: 1, position: 'relative' },
  scrollBody: { flex: 1, minHeight: 0 },
  title: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1, color: CYAN },
  subtitle: { fontFamily: 'monospace', color: BODY_MUTED, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  stabilityBlock: { flex: 1, gap: 3 },
  traceHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.6 },
  track: { height: 8, borderWidth: 1, borderColor: '#123', backgroundColor: '#0B0F14', overflow: 'hidden' },
  trackFill: { height: '100%' },
  statusLine: { minHeight: 26, justifyContent: 'center' },
  statusText: { fontFamily: 'monospace', letterSpacing: 0.4, fontWeight: '700' },
  band: { borderRadius: 5, padding: 4, alignSelf: 'stretch' },
  bandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 2 },
  bandLabel: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1 },
  bandPct: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.6 },
  controls: { alignSelf: 'stretch' },
  controlRow: { flexDirection: 'row', alignItems: 'center' },
  controlLabelCol: { flex: 1 },
  controlLabel: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.8, color: MUTED_WHITE },
  controlHint: { fontFamily: 'monospace', color: '#6b7280', letterSpacing: 0.3 },
  stepBtn: {
    width: 54,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  stepText: { fontFamily: 'monospace', fontWeight: '700' },
  cleanseBtn: { borderRadius: 4, paddingVertical: 12, alignItems: 'center' },
  cleanseText: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1 },
  instruction: { fontFamily: 'monospace', color: '#6b7280', letterSpacing: 0.3, textAlign: 'center' },
  penalty: { fontFamily: 'monospace', color: '#7f1d1d', letterSpacing: 0.4 },
  banner: { fontFamily: 'monospace', letterSpacing: 0.3, textAlign: 'center' },
  failLock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: RED_BLACK, borderWidth: 2, borderColor: RED },
});
