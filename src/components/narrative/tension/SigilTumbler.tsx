import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
import {
  NARRATIVE_UNIFIED_PANEL_BG,
  NARRATIVE_UNIFIED_PANEL_BORDER,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import HapticPressable from '../../HapticPressable';
import type { TensionMechanicProps } from './tensionMechanicTypes';
import {
  drainPerSec,
  generateSigilTumbler,
  isTimingGood,
  normalizeDeg,
  resonanceProximity,
  SIGIL_TUMBLER_CONFIG,
  tumblerPos,
  zoneForAngle,
  type SigilTumblerPuzzle,
  type SigilZone,
} from './sigilTumblerEngine';
import { logNarrativeMinigameCompleted } from '../../../data/narrative/narrativeMinigameTelemetry';

const CYAN = '#22d3ee';
const CYAN_DIM = '#0e3b45';
const VIOLET = '#a855f7';
const VIOLET_DIM = '#3a1d5c';
const WHITE_HOT = '#f0f9ff';
const RED_GLITCH = '#ef4444';
const AMBER = '#fbbf24';
const TERMINAL_GREEN = '#00ff33';
const BODY_MUTED = '#94A3B8';
const MUTED_WHITE = '#F8FAFC';
const DISC_FILL = '#04060a';

const TICK_MS = 40;

const SUCCESS_LINES = [
  'The final glyph seats. The seal splits open like a ritual iris.',
  'All four tumblers resonate as one. The ward yields.',
] as const;

const FAILURE_LINES = [
  'The resonance collapses. The ward folds shut around your pick.',
  'Stability shatters — the lock reseals in a burst of red static.',
] as const;

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function zoneColor(zone: SigilZone): string {
  if (zone === 'INSIDE') return CYAN;
  if (zone === 'NEAR') return AMBER;
  return RED_GLITCH;
}

function zoneLabel(zone: SigilZone): string {
  if (zone === 'INSIDE') return 'RESONANT — SET THE GLYPHS';
  if (zone === 'NEAR') return 'CLOSE — REFINE THE ANGLE';
  return 'SEEKING — SWEEP FOR RESONANCE';
}

/**
 * Sigil Tumbler — occult-tech lockpick for Mechanic_SigilTumbler.
 * Drag the wardpick to find the hidden resonance angle, hold tension, and set
 * four glyph tumblers on the beat before Stability drains. No run-state mutation.
 */
export default function SigilTumbler({
  onSuccess,
  onFailure,
  defaultPenalty,
  difficulty = 'MEDIUM',
  narrativeEventId,
}: TensionMechanicProps): React.JSX.Element {
  const { scaleSize, scaleSpacing, scaleFont } = useResponsiveLayout();
  const startedAtRef = useRef(Date.now());
  const seed = `sigil-tumbler:${narrativeEventId ?? 'live'}`;

  const puzzle = useMemo<SigilTumblerPuzzle>(() => generateSigilTumbler(seed), [seed]);

  const [wardAngle, setWardAngle] = useState(puzzle.startAngleDeg);
  const [tension, setTension] = useState(false);
  const [stability, setStability] = useState<number>(SIGIL_TUMBLER_CONFIG.stabilityMax);
  const [badAttempts, setBadAttempts] = useState(0);
  const [setCount, setSetCount] = useState(0);
  const [phasePos, setPhasePos] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resolveState, setResolveState] = useState<'playing' | 'success' | 'failure'>('playing');

  const wardAngleRef = useRef(wardAngle);
  const tensionRef = useRef(false);
  const stabilityRef = useRef<number>(SIGIL_TUMBLER_CONFIG.stabilityMax);
  const badRef = useRef(0);
  const setCountRef = useRef(0);
  const phaseRef = useRef(puzzle.tumblers[0]?.startPhase ?? 0);
  const resolvedRef = useRef(false);
  wardAngleRef.current = wardAngle;

  const glitch = useRef(new Animated.Value(0)).current;
  const irisOpen = useRef(new Animated.Value(0)).current;

  const dialSize = scaleSize(206);
  const center = dialSize / 2;
  const outerR = center - scaleSize(8);
  const innerR = outerR * 0.62;

  const finish = useCallback((win: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setTension(false);
    tensionRef.current = false;
    setResolveState(win ? 'success' : 'failure');
    setFeedback(null);
    if (win) {
      Animated.timing(irisOpen, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_SigilTumbler',
      difficulty,
      success: win,
      attemptsUsed: badRef.current,
      timeElapsedMs: Date.now() - startedAtRef.current,
      narrativeEventId,
    });
    if (win) onSuccess();
    else onFailure();
  }, [difficulty, irisOpen, narrativeEventId, onFailure, onSuccess]);

  const pulseGlitch = useCallback(() => {
    glitch.stopAnimation();
    glitch.setValue(0);
    Animated.sequence([
      Animated.timing(glitch, { toValue: 1, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(glitch, { toValue: 0, duration: 460, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [glitch]);

  // Real-time loop: tension drains stability by zone and advances the active pulse.
  useEffect(() => {
    if (resolveState !== 'playing') return undefined;
    const id = setInterval(() => {
      if (resolvedRef.current) return;
      const dt = TICK_MS / 1000;
      const angle = wardAngleRef.current;
      const zone = zoneForAngle(puzzle, angle);
      const prox = resonanceProximity(puzzle, angle);

      // Wardpick jitter when off-resonance (visual instability).
      const wobble = (1 - prox) * (Math.random() * 2 - 1) * 9;
      setJitter(wobble);

      if (tensionRef.current) {
        stabilityRef.current = Math.max(0, stabilityRef.current - drainPerSec(zone) * dt);
        setStability(stabilityRef.current);
        if (stabilityRef.current <= 0) {
          finish(false);
          return;
        }
        const active = puzzle.tumblers[setCountRef.current];
        if (active) {
          phaseRef.current = (phaseRef.current + dt / active.periodSec) % 1;
          setPhasePos(tumblerPos(phaseRef.current));
        }
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [finish, puzzle, resolveState]);

  const applyAngleFromTouch = useCallback((evt: GestureResponderEvent) => {
    const { locationX, locationY } = evt.nativeEvent;
    const dx = locationX - center;
    const dy = locationY - center;
    if (dx === 0 && dy === 0) return;
    // Screen y is down; negate so 0° = east, CCW positive (matches engine).
    const deg = normalizeDeg((Math.atan2(-dy, dx) * 180) / Math.PI);
    wardAngleRef.current = deg;
    setWardAngle(deg);
  }, [center]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => resolveState === 'playing',
        onMoveShouldSetPanResponder: () => resolveState === 'playing',
        onPanResponderGrant: applyAngleFromTouch,
        onPanResponderMove: applyAngleFromTouch,
      }),
    [applyAngleFromTouch, resolveState],
  );

  const handleSet = useCallback((index: number) => {
    if (resolvedRef.current || resolveState !== 'playing') return;
    if (index !== setCountRef.current) return;
    if (!tensionRef.current) {
      setFeedback('HOLD TENSION TO SEAT THE GLYPH');
      return;
    }
    const active = puzzle.tumblers[index];
    if (!active) return;
    const zone = zoneForAngle(puzzle, wardAngleRef.current);
    const good = zone === 'INSIDE' && isTimingGood(phaseRef.current, active.periodSec);
    if (good) {
      setCountRef.current += 1;
      setSetCount(setCountRef.current);
      phaseRef.current = puzzle.tumblers[setCountRef.current]?.startPhase ?? 0;
      setPhasePos(tumblerPos(phaseRef.current));
      if (setCountRef.current >= SIGIL_TUMBLER_CONFIG.tumblerCount) {
        finish(true);
      } else {
        setFeedback('GLYPH SEATED');
      }
    } else {
      badRef.current += 1;
      stabilityRef.current = Math.max(0, stabilityRef.current - SIGIL_TUMBLER_CONFIG.badSetPenalty);
      setBadAttempts(badRef.current);
      setStability(stabilityRef.current);
      setFeedback(
        zone === 'INSIDE' ? 'MISTIMED — GLYPH REJECTED' : 'OFF-RESONANCE — GLYPH REJECTED',
      );
      pulseGlitch();
      if (badRef.current >= SIGIL_TUMBLER_CONFIG.maxBadAttempts || stabilityRef.current <= 0) {
        finish(false);
      }
    }
  }, [finish, puzzle, pulseGlitch, resolveState]);

  const startTension = useCallback(() => {
    if (resolvedRef.current || resolveState !== 'playing') return;
    tensionRef.current = true;
    setTension(true);
    setFeedback(null);
  }, [resolveState]);

  const endTension = useCallback(() => {
    tensionRef.current = false;
    setTension(false);
  }, []);

  const zone = zoneForAngle(puzzle, wardAngle);
  const prox = resonanceProximity(puzzle, wardAngle);
  const ringColor = zoneColor(zone);
  const displayAngle = zone === 'INSIDE' ? wardAngle : wardAngle + jitter;
  const stabilityPct = Math.round((stability / SIGIL_TUMBLER_CONFIG.stabilityMax) * 100);

  const penaltyLine = useMemo(() => {
    if (!defaultPenalty) return null;
    return defaultPenalty.type === 'HP'
      ? `WARD BACKLASH RISK — ${defaultPenalty.amount} HP (applied on fail by narrative)`
      : `WARD BACKLASH RISK — +${defaultPenalty.amount} RESONANCE (applied on fail by narrative)`;
  }, [defaultPenalty]);

  const banner =
    resolveState === 'success'
      ? SUCCESS_LINES[puzzle.windowCenterDeg % SUCCESS_LINES.length]!
      : resolveState === 'failure'
        ? FAILURE_LINES[puzzle.windowCenterDeg % FAILURE_LINES.length]!
        : null;

  // Wardpick needle endpoint.
  const rad = (displayAngle * Math.PI) / 180;
  const needleX = center + Math.cos(rad) * (outerR - scaleSize(4));
  const needleY = center - Math.sin(rad) * (outerR - scaleSize(4));

  const irisGap = irisOpen.interpolate({ inputRange: [0, 1], outputRange: [0, innerR] });

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
          <Text style={[styles.title, { fontSize: scaleFont(11) }]}>SIGIL TUMBLER</Text>
          <Text style={[styles.subtitle, { fontSize: scaleFont(9), lineHeight: scaleFont(13) }]}>
            Find the resonance angle, hold tension, and seat all four glyphs on the beat.
          </Text>

          <View style={[styles.metaRow, { marginTop: scaleSpacing(6), gap: scaleSpacing(10) }]}>
            <View style={styles.stabilityBlock}>
              <View style={styles.traceHeader}>
                <Text style={[styles.meta, { fontSize: scaleFont(8), color: stabilityPct <= 30 ? RED_GLITCH : CYAN }]}>
                  STABILITY
                </Text>
                <Text style={[styles.meta, { fontSize: scaleFont(8), color: MUTED_WHITE }]}>{stabilityPct}%</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.trackFill,
                    { width: `${stabilityPct}%`, backgroundColor: stabilityPct <= 30 ? RED_GLITCH : stabilityPct <= 60 ? AMBER : CYAN },
                  ]}
                />
              </View>
            </View>
            <View style={styles.pips}>
              <Text style={[styles.meta, { fontSize: scaleFont(8), color: BODY_MUTED }]}>FAULTS </Text>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    { backgroundColor: i < badAttempts ? RED_GLITCH : 'transparent', borderColor: RED_GLITCH },
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={[styles.statusLine, { marginTop: scaleSpacing(4) }]}>
            <Text
              style={[
                styles.statusText,
                { fontSize: scaleFont(9), color: feedback ? (feedback.includes('SEATED') ? TERMINAL_GREEN : RED_GLITCH) : ringColor },
              ]}
            >
              {feedback ?? zoneLabel(zone)}
            </Text>
            <Text style={[styles.tumblerCount, { fontSize: scaleFont(9), color: MUTED_WHITE }]}>
              {`${setCount}/${SIGIL_TUMBLER_CONFIG.tumblerCount}`}
            </Text>
          </View>

          {/* Lock dial — drag anywhere to steer the wardpick. */}
          <View
            style={[styles.dialWrap, { width: dialSize, height: dialSize, marginTop: scaleSpacing(8) }]}
            {...panResponder.panHandlers}
          >
            <Svg width={dialSize} height={dialSize}>
              {/* neon backing grid */}
              {[0.35, 0.55, 0.75, 0.95].map((f) => (
                <Circle key={`bg-${f}`} cx={center} cy={center} r={outerR * f} fill="none" stroke="rgba(56, 89, 120, 0.14)" strokeWidth={1} />
              ))}
              <Line x1={center} y1={0} x2={center} y2={dialSize} stroke="rgba(56, 89, 120, 0.12)" strokeWidth={1} />
              <Line x1={0} y1={center} x2={dialSize} y2={center} stroke="rgba(56, 89, 120, 0.12)" strokeWidth={1} />

              {/* black glass disc */}
              <Circle cx={center} cy={center} r={outerR} fill={DISC_FILL} stroke={CYAN_DIM} strokeWidth={1.5} />

              {/* resonance hum — whole ring brightens toward the sweet spot */}
              <Circle
                cx={center}
                cy={center}
                r={outerR - scaleSize(2)}
                fill="none"
                stroke={ringColor}
                strokeWidth={zone === 'INSIDE' ? 4 : 2}
                opacity={0.25 + prox * 0.6}
              />

              {/* outer cyan circuit ticks */}
              {Array.from({ length: 36 }, (_, i) => {
                const a = (i * 10 * Math.PI) / 180;
                const r1 = outerR - scaleSize(2);
                const r2 = outerR - scaleSize(i % 3 === 0 ? 10 : 6);
                return (
                  <Line
                    key={`tick-${i}`}
                    x1={center + Math.cos(a) * r1}
                    y1={center - Math.sin(a) * r1}
                    x2={center + Math.cos(a) * r2}
                    y2={center - Math.sin(a) * r2}
                    stroke={CYAN}
                    strokeWidth={1}
                    opacity={0.3 + prox * 0.3}
                  />
                );
              })}

              {/* inner violet sigil ring */}
              <Circle cx={center} cy={center} r={innerR} fill="none" stroke={VIOLET} strokeWidth={1.5} opacity={0.5 + prox * 0.4} />
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i * 45 * Math.PI) / 180;
                return (
                  <Circle
                    key={`sigil-${i}`}
                    cx={center + Math.cos(a) * innerR}
                    cy={center - Math.sin(a) * innerR}
                    r={scaleSize(2.4)}
                    fill={VIOLET}
                    opacity={0.4 + prox * 0.5}
                  />
                );
              })}

              {/* success iris core */}
              {resolveState === 'success' ? (
                <>
                  <AnimatedCircleCore center={center} irisGap={irisGap} />
                </>
              ) : (
                <Circle cx={center} cy={center} r={scaleSize(6)} fill={zone === 'INSIDE' ? CYAN : VIOLET_DIM} opacity={0.8} />
              )}

              {/* wardpick needle */}
              <Line
                x1={center}
                y1={center}
                x2={needleX}
                y2={needleY}
                stroke={WHITE_HOT}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
              <Circle cx={needleX} cy={needleY} r={scaleSize(3.4)} fill={WHITE_HOT} />
            </Svg>

            {/* red glitch burst */}
            <Animated.View
              pointerEvents="none"
              style={[styles.glitch, { opacity: glitch.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]}
            />
          </View>

          {/* Tumbler chambers — tap the active glowing chamber on the beat. */}
          <View style={[styles.tumblerRow, { marginTop: scaleSpacing(10), gap: scaleSpacing(8) }]}>
            {puzzle.tumblers.map((t, i) => {
              const status = i < setCount ? 'SET' : i === setCount ? 'ACTIVE' : 'PENDING';
              const pos = status === 'SET' ? 1 : status === 'ACTIVE' ? phasePos : 0.12;
              const chamberH = scaleSize(74);
              const glyphColor = status === 'SET' ? TERMINAL_GREEN : status === 'ACTIVE' ? (zone === 'INSIDE' ? CYAN : VIOLET) : '#334155';
              const borderCol = status === 'ACTIVE' ? (zone === 'INSIDE' ? CYAN : AMBER) : status === 'SET' ? TERMINAL_GREEN : '#1f2937';
              return (
                <HapticPressable
                  key={`tumbler-${i}`}
                  disabled={status !== 'ACTIVE' || resolveState !== 'playing'}
                  onPress={() => handleSet(i)}
                  style={[styles.chamber, { height: chamberH, borderColor: borderCol }]}
                >
                  {/* sync line near top */}
                  <View style={[styles.syncLine, { top: scaleSize(8), backgroundColor: status === 'ACTIVE' && zone === 'INSIDE' ? CYAN : '#475569' }]} />
                  {/* rising glyph */}
                  <View
                    style={[
                      styles.glyphToken,
                      {
                        backgroundColor: glyphColor,
                        bottom: scaleSize(6) + pos * (chamberH - scaleSize(24)),
                        shadowColor: glyphColor,
                      },
                    ]}
                  />
                  <Text style={[styles.beatTag, { fontSize: scaleFont(6.5), color: borderCol }]}>
                    {t.beat === 'SLOW' ? '◇' : '◆◆'}
                  </Text>
                </HapticPressable>
              );
            })}
          </View>

          {/* Tension hold */}
          <HapticPressable
            onPressIn={startTension}
            onPressOut={endTension}
            disabled={resolveState !== 'playing'}
            style={[
              styles.tensionBtn,
              {
                marginTop: scaleSpacing(10),
                borderColor: tension ? ringColor : '#334155',
                backgroundColor: tension ? 'rgba(34, 211, 238, 0.12)' : 'rgba(0,0,0,0.4)',
              },
            ]}
          >
            <Text style={[styles.tensionText, { fontSize: scaleFont(10), color: tension ? ringColor : BODY_MUTED }]}>
              {tension ? '// HOLDING TENSION //' : '[ HOLD TENSION ]'}
            </Text>
          </HapticPressable>

          <Text style={[styles.instruction, { fontSize: scaleFont(8), marginTop: scaleSpacing(8) }]}>
            Drag the dial to aim the wardpick. Hold tension to feel the beat, then tap the glowing chamber as its glyph hits the sync line.
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
                  color: resolveState === 'success' ? TERMINAL_GREEN : RED_GLITCH,
                  marginTop: scaleSpacing(6),
                },
              ]}
            >
              {banner}
            </Text>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

function AnimatedCircleCore({ center, irisGap }: { center: number; irisGap: Animated.AnimatedInterpolation<number> }): React.JSX.Element {
  return (
    <AnimatedG>
      <AnimatedCircle cx={center} cy={center} r={irisGap} fill="rgba(34, 211, 238, 0.18)" stroke={CYAN} strokeWidth={2} />
    </AnimatedG>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  panel: { flex: 1, minHeight: 0, borderWidth: 1 },
  scrollBody: { flex: 1, minHeight: 0 },
  title: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1.5, color: CYAN },
  subtitle: { fontFamily: 'monospace', color: BODY_MUTED, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  stabilityBlock: { flex: 1, gap: 3 },
  traceHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.6 },
  track: { height: 8, borderWidth: 1, borderColor: '#123', backgroundColor: '#0B0F14', overflow: 'hidden' },
  trackFill: { height: '100%' },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pip: { width: 9, height: 9, borderWidth: 1, borderRadius: 2 },
  statusLine: { minHeight: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusText: { fontFamily: 'monospace', letterSpacing: 0.4, fontWeight: '700', flex: 1 },
  tumblerCount: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.6 },
  dialWrap: { alignSelf: 'center', position: 'relative' },
  glitch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: RED_GLITCH,
  },
  tumblerRow: { flexDirection: 'row', justifyContent: 'center' },
  chamber: {
    flex: 1,
    maxWidth: 74,
    borderWidth: 1.5,
    borderRadius: 4,
    backgroundColor: 'rgba(4, 6, 10, 0.9)',
    position: 'relative',
    overflow: 'hidden',
  },
  syncLine: { position: 'absolute', left: 4, right: 4, height: 2 },
  glyphToken: {
    position: 'absolute',
    left: '30%',
    right: '30%',
    height: 12,
    borderRadius: 2,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  beatTag: { position: 'absolute', bottom: 2, alignSelf: 'center', fontFamily: 'monospace', letterSpacing: 1 },
  tensionBtn: { borderWidth: 1.5, borderRadius: 4, paddingVertical: 12, alignItems: 'center' },
  tensionText: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1 },
  instruction: { fontFamily: 'monospace', color: '#6b7280', letterSpacing: 0.3, textAlign: 'center' },
  penalty: { fontFamily: 'monospace', color: '#7f1d1d', letterSpacing: 0.4 },
  banner: { fontFamily: 'monospace', letterSpacing: 0.3, textAlign: 'center' },
});
