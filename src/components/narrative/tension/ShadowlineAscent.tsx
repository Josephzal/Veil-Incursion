import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  applyShadowlineAction,
  dangersAtBeat,
  generateShadowlineBoard,
  initialShadowlineState,
  isActionLegal,
  SHADOWLINE_CONFIG,
  type ShadowCell,
  type ShadowlineActionKind,
  type ShadowlineBoard,
  type ShadowlineState,
} from './shadowlineAscentEngine';
import { logNarrativeMinigameCompleted } from '../../../data/narrative/narrativeMinigameTelemetry';

const CYAN = '#22d3ee';
const VIOLET = '#a855f7';
const RUNNER = '#ede9fe';
const RUNNER_GLOW = '#c4b5fd';
const WHITE_HOT = '#f5f3ff';
const RED = '#ef4444';
const ORANGE = '#fb923c';
const RED_BLACK = '#450a0a';
const SHADOW_FILL = '#160726';
const SHADOW_STROKE = 'rgba(126, 58, 173, 0.55)';
const BODY_MUTED = '#94A3B8';
const MUTED_WHITE = '#F8FAFC';
const DISC_FILL = '#04060a';

const { lanes: LANES, steps: STEPS, exitRow: EXIT_ROW, exposureLimit: EXPOSURE_LIMIT } = SHADOWLINE_CONFIG;

const SUCCESS_LINES = [
  'The Runner Trace slips through the top seal and vanishes.',
  'Your signal threads the last threshold. The shaft never saw you.',
] as const;

const FAILURE_LINES = [
  'The shaft locks red. SIGNATURE EXPOSED.',
  'Detection floods the lattice. Your trace is burned across the feed.',
] as const;

interface DangerView {
  crossRow: number | null;
  watchLane: number | null;
  sigilCells: ShadowCell[];
}

/**
 * Shadowline Ascent — turn-based occult stealth shaft for Mechanic_ShadowlineAscent.
 * Climb the Runner Trace to the Exit Glyph without hitting 3 Exposure. Every
 * action advances detection one beat; Shadow Pockets hide you; the one-use
 * Dampener shrouds a single action. No run-state mutation.
 */
export default function ShadowlineAscent({
  onSuccess,
  onFailure,
  defaultPenalty,
  difficulty,
  narrativeEventId,
}: TensionMechanicProps): React.JSX.Element {
  const { scaleSize, scaleSpacing, scaleFont } = useResponsiveLayout();
  const startedAtRef = useRef(Date.now());
  const seed = `shadowline:${narrativeEventId ?? 'live'}`;

  const board = useMemo<ShadowlineBoard>(() => generateShadowlineBoard(seed), [seed]);

  const [state, setState] = useState<ShadowlineState>(() => initialShadowlineState());
  const [dampArmed, setDampArmed] = useState(false);
  const [trail, setTrail] = useState<ShadowCell[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [blinkOn, setBlinkOn] = useState(true);
  const resolvedRef = useRef(false);

  const exposureFlash = useRef(new Animated.Value(0)).current;
  const failLock = useRef(new Animated.Value(0)).current;
  const successFade = useRef(new Animated.Value(0)).current;

  // Blink loop for the bright/imminent danger.
  useEffect(() => {
    const id = setInterval(() => setBlinkOn((b) => !b), 460);
    return () => clearInterval(id);
  }, []);

  const finish = useCallback((win: boolean) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    if (win) {
      Animated.timing(successFade, {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(failLock, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    }
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_ShadowlineAscent',
      difficulty,
      success: win,
      attemptsUsed: EXPOSURE_LIMIT - Math.max(0, EXPOSURE_LIMIT - state.exposure),
      timeElapsedMs: Date.now() - startedAtRef.current,
      narrativeEventId,
    });
    if (win) onSuccess();
    else onFailure();
  }, [difficulty, failLock, narrativeEventId, onFailure, onSuccess, state.exposure, successFade]);

  const flashExposure = useCallback(() => {
    exposureFlash.stopAnimation();
    exposureFlash.setValue(0);
    Animated.sequence([
      Animated.timing(exposureFlash, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(exposureFlash, { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]).start();
  }, [exposureFlash]);

  const doAction = useCallback(
    (action: ShadowlineActionKind) => {
      if (resolvedRef.current || state.status !== 'PLAYING') return;
      if (!isActionLegal(state, action)) return;
      const res = applyShadowlineAction(board, state, action, dampArmed);
      setTrail((t) => [{ lane: state.lane, row: state.row }, ...t].slice(0, 3));
      setState(res.next);
      setDampArmed(false);
      if (res.hit) {
        flashExposure();
        setMessage(`DETECTED // ${res.hitKinds.join('+')} // EXPOSURE +1`);
      } else if (res.dampConsumed) {
        setMessage('DAMPENER BURNED // ACTION SHROUDED');
      } else if (res.reachedExit) {
        setMessage('EXIT SEAL BREACHED');
      } else {
        setMessage(null);
      }
      if (res.next.status === 'SUCCESS') finish(true);
      else if (res.next.status === 'FAILURE') finish(false);
    },
    [board, dampArmed, finish, flashExposure, state],
  );

  const toggleDamp = useCallback(() => {
    if (resolvedRef.current || state.status !== 'PLAYING') return;
    if (state.dampCharges <= 0) return;
    setDampArmed((d) => !d);
  }, [state.dampCharges, state.status]);

  // --- Geometry -------------------------------------------------------------
  const stepH = scaleSize(22);
  const laneGap = scaleSize(52);
  const padX = scaleSize(34);
  const padTop = scaleSize(30);
  const padBottom = scaleSize(24);
  const svgW = padX * 2 + (LANES - 1) * laneGap;
  const svgH = padTop + padBottom + (STEPS - 1) * stepH;
  const laneX = useCallback((lane: number) => padX + lane * laneGap, [padX, laneGap]);
  const rowY = useCallback((row: number) => svgH - padBottom - row * stepH, [svgH, padBottom, stepH]);
  const nodeR = scaleSize(3.2);
  const runnerR = scaleSize(7);

  const playing = state.status === 'PLAYING';
  const brightBeat = state.beat + 1;
  const previewBeat = state.beat + 2;
  const bright: DangerView = playing ? dangersAtBeat(board, brightBeat) : { crossRow: null, watchLane: null, sigilCells: [] };
  const preview: DangerView = playing ? dangersAtBeat(board, previewBeat) : { crossRow: null, watchLane: null, sigilCells: [] };

  const laneSpanX0 = laneX(0);
  const laneSpanX1 = laneX(LANES - 1);

  const banner =
    state.status === 'SUCCESS'
      ? SUCCESS_LINES[board.exitLane % SUCCESS_LINES.length]!
      : state.status === 'FAILURE'
        ? FAILURE_LINES[board.exitLane % FAILURE_LINES.length]!
        : null;

  const penaltyLine = useMemo(() => {
    if (!defaultPenalty) return null;
    return defaultPenalty.type === 'HP'
      ? `EXPOSED SIGNATURE RISK — ${defaultPenalty.amount} HP (applied on fail by narrative)`
      : `EXPOSED SIGNATURE RISK — +${defaultPenalty.amount} RESONANCE (applied on fail by narrative)`;
  }, [defaultPenalty]);

  const guidance = message
    ?? (dampArmed
      ? 'DAMPENER ARMED — YOUR NEXT ACTION IGNORES DETECTION'
      : 'CLIMB TO THE EXIT GLYPH — AVOID THE BRIGHT SCAN, HIDE IN SHADOW');
  const guidanceColor = message
    ? (message.startsWith('DETECTED') ? RED : message.startsWith('DAMPENER') || message.startsWith('EXIT') ? CYAN : MUTED_WHITE)
    : dampArmed ? VIOLET : BODY_MUTED;

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
          <Text style={[styles.title, { fontSize: scaleFont(11) }]}>SHADOWLINE ASCENT</Text>
          <Text style={[styles.subtitle, { fontSize: scaleFont(9), lineHeight: scaleFont(13) }]}>
            Climb the Runner Trace up the detection shaft to the Exit Glyph before your Signature is Exposed.
          </Text>

          <View style={[styles.metaRow, { marginTop: scaleSpacing(6), gap: scaleSpacing(12) }]}>
            <View style={styles.pips}>
              <Text style={[styles.meta, { fontSize: scaleFont(8), color: state.exposure >= 2 ? RED : BODY_MUTED }]}>EXPOSURE </Text>
              {Array.from({ length: EXPOSURE_LIMIT }, (_, i) => (
                <View
                  key={`exp-${i}`}
                  style={[styles.pip, { backgroundColor: i < state.exposure ? RED : 'transparent', borderColor: RED }]}
                />
              ))}
            </View>
            <View style={styles.pips}>
              <Text style={[styles.meta, { fontSize: scaleFont(8), color: state.dampCharges > 0 ? VIOLET : '#475569' }]}>DAMPENER </Text>
              <View style={[styles.pip, { backgroundColor: state.dampCharges > 0 ? VIOLET : 'transparent', borderColor: VIOLET, borderRadius: 6 }]} />
            </View>
          </View>

          <View style={[styles.statusLine, { marginTop: scaleSpacing(4) }]}>
            <Text style={[styles.statusText, { fontSize: scaleFont(9), color: guidanceColor }]} numberOfLines={2}>
              {guidance}
            </Text>
          </View>

          {/* Vertical occult detection shaft. */}
          <View style={[styles.shaftWrap, { width: svgW, height: svgH, marginTop: scaleSpacing(8) }]}>
            <Svg width={svgW} height={svgH}>
              <Rect x={0} y={0} width={svgW} height={svgH} fill={DISC_FILL} rx={scaleSize(6)} />

              {/* horizontal threshold lines */}
              {Array.from({ length: STEPS }, (_, r) => (
                <Line
                  key={`thr-${r}`}
                  x1={laneSpanX0 - scaleSize(10)}
                  y1={rowY(r)}
                  x2={laneSpanX1 + scaleSize(10)}
                  y2={rowY(r)}
                  stroke="rgba(56, 89, 120, 0.16)"
                  strokeWidth={1}
                />
              ))}

              {/* vertical neon lanes */}
              {Array.from({ length: LANES }, (_, l) => (
                <Line
                  key={`lane-${l}`}
                  x1={laneX(l)}
                  y1={rowY(0)}
                  x2={laneX(l)}
                  y2={rowY(EXIT_ROW)}
                  stroke={l === board.exitLane ? VIOLET : CYAN}
                  strokeWidth={1.5}
                  opacity={0.42}
                />
              ))}

              {/* shadow pockets — void stains */}
              {board.shadowPockets.map((key) => {
                const [l, r] = key.split(':').map(Number) as [number, number];
                return (
                  <G key={`pocket-${key}`}>
                    <Circle cx={laneX(l)} cy={rowY(r)} r={scaleSize(9)} fill={SHADOW_FILL} opacity={0.92} />
                    <Circle cx={laneX(l)} cy={rowY(r)} r={scaleSize(9)} fill="none" stroke={SHADOW_STROKE} strokeWidth={1} strokeDasharray="2 3" />
                  </G>
                );
              })}

              {/* node dots */}
              {Array.from({ length: LANES }, (_, l) =>
                Array.from({ length: STEPS }, (_, r) => (
                  <Circle key={`node-${l}-${r}`} cx={laneX(l)} cy={rowY(r)} r={nodeR} fill="rgba(148,163,184,0.28)" />
                )),
              )}

              {/* --- NEXT danger preview (faint) --- */}
              {preview.crossRow != null ? (
                <Line
                  x1={laneSpanX0 - scaleSize(12)}
                  y1={rowY(preview.crossRow)}
                  x2={laneSpanX1 + scaleSize(12)}
                  y2={rowY(preview.crossRow)}
                  stroke={ORANGE}
                  strokeWidth={2}
                  strokeDasharray="4 5"
                  opacity={0.28}
                />
              ) : null}
              {preview.watchLane != null ? (
                <Rect
                  x={laneX(preview.watchLane) - scaleSize(10)}
                  y={rowY(EXIT_ROW)}
                  width={scaleSize(20)}
                  height={rowY(0) - rowY(EXIT_ROW)}
                  fill={RED}
                  opacity={0.08}
                />
              ) : null}
              {preview.sigilCells.map((c) => (
                <Circle
                  key={`pv-sig-${c.lane}-${c.row}`}
                  cx={laneX(c.lane)}
                  cy={rowY(c.row)}
                  r={scaleSize(6)}
                  fill="none"
                  stroke={RED}
                  strokeWidth={1.5}
                  strokeDasharray="2 3"
                  opacity={0.4}
                />
              ))}

              {/* --- CURRENT danger (bright, blinking) --- */}
              {bright.watchLane != null ? (
                <Rect
                  x={laneX(bright.watchLane) - scaleSize(11)}
                  y={rowY(EXIT_ROW)}
                  width={scaleSize(22)}
                  height={rowY(0) - rowY(EXIT_ROW)}
                  fill={RED}
                  opacity={blinkOn ? 0.24 : 0.12}
                />
              ) : null}
              {bright.crossRow != null ? (
                <G>
                  <Line
                    x1={laneSpanX0 - scaleSize(14)}
                    y1={rowY(bright.crossRow)}
                    x2={laneSpanX1 + scaleSize(14)}
                    y2={rowY(bright.crossRow)}
                    stroke={ORANGE}
                    strokeWidth={blinkOn ? 3.4 : 2.4}
                    opacity={blinkOn ? 1 : 0.7}
                  />
                  <Line
                    x1={laneSpanX0 - scaleSize(14)}
                    y1={rowY(bright.crossRow)}
                    x2={laneSpanX1 + scaleSize(14)}
                    y2={rowY(bright.crossRow)}
                    stroke={RED}
                    strokeWidth={1.2}
                  />
                </G>
              ) : null}
              {bright.sigilCells.map((c) => (
                <G key={`br-sig-${c.lane}-${c.row}`} opacity={blinkOn ? 1 : 0.55}>
                  <Circle cx={laneX(c.lane)} cy={rowY(c.row)} r={scaleSize(6.5)} fill={RED} opacity={0.35} />
                  <Path
                    d={`M ${laneX(c.lane) - scaleSize(4)} ${rowY(c.row) - scaleSize(4)} L ${laneX(c.lane) + scaleSize(4)} ${rowY(c.row) + scaleSize(4)} M ${laneX(c.lane) + scaleSize(4)} ${rowY(c.row) - scaleSize(4)} L ${laneX(c.lane) - scaleSize(4)} ${rowY(c.row) + scaleSize(4)}`}
                    stroke={RED}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </G>
              ))}

              {/* exit glyph */}
              <G opacity={state.status === 'SUCCESS' ? 1 : 0.95}>
                <Circle cx={laneX(board.exitLane)} cy={rowY(EXIT_ROW)} r={scaleSize(10)} fill="none" stroke={CYAN} strokeWidth={2} />
                <Circle cx={laneX(board.exitLane)} cy={rowY(EXIT_ROW)} r={scaleSize(5)} fill="none" stroke={VIOLET} strokeWidth={1.5} />
                <Circle cx={laneX(board.exitLane)} cy={rowY(EXIT_ROW)} r={scaleSize(1.6)} fill={WHITE_HOT} />
              </G>

              {/* runner afterimage trail */}
              {trail.map((c, i) => (
                <Circle
                  key={`trail-${i}`}
                  cx={laneX(c.lane)}
                  cy={rowY(c.row)}
                  r={runnerR * (0.72 - i * 0.16)}
                  fill={RUNNER_GLOW}
                  opacity={(0.26 - i * 0.07) * (state.status === 'SUCCESS' ? 0 : 1)}
                />
              ))}

              {/* runner trace */}
              <G>
                <Circle cx={laneX(state.lane)} cy={rowY(state.row)} r={runnerR + scaleSize(3)} fill={RUNNER_GLOW} opacity={0.22} />
                <Circle cx={laneX(state.lane)} cy={rowY(state.row)} r={runnerR} fill={RUNNER} />
                <Circle cx={laneX(state.lane)} cy={rowY(state.row)} r={runnerR * 0.45} fill={WHITE_HOT} />
              </G>
            </Svg>

            {/* exposure flash */}
            <Animated.View
              pointerEvents="none"
              style={[styles.flash, { opacity: exposureFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }]}
            />
            {/* failure lock */}
            <Animated.View pointerEvents="none" style={[styles.failLock, { opacity: failLock }]} />
          </View>

          {/* action controls */}
          <View style={[styles.controls, { marginTop: scaleSpacing(10), gap: scaleSpacing(6) }]}>
            <View style={[styles.controlRow, { gap: scaleSpacing(6) }]}>
              <ActionButton label="◀ SHIFT" onPress={() => doAction('SHIFT_LEFT')} disabled={!isActionLegal(state, 'SHIFT_LEFT')} color={CYAN} scaleFont={scaleFont} flex={1} />
              <ActionButton label="▲ ASCEND" onPress={() => doAction('ASCEND')} disabled={!isActionLegal(state, 'ASCEND')} color={CYAN} scaleFont={scaleFont} flex={1.3} primary />
              <ActionButton label="SHIFT ▶" onPress={() => doAction('SHIFT_RIGHT')} disabled={!isActionLegal(state, 'SHIFT_RIGHT')} color={CYAN} scaleFont={scaleFont} flex={1} />
            </View>
            <View style={[styles.controlRow, { gap: scaleSpacing(6) }]}>
              <ActionButton label="■ WAIT" onPress={() => doAction('WAIT')} disabled={!isActionLegal(state, 'WAIT')} color={BODY_MUTED} scaleFont={scaleFont} flex={1} />
              <ActionButton
                label={dampArmed ? '✦ DAMPENER ARMED' : `✦ DAMPEN (${state.dampCharges})`}
                onPress={toggleDamp}
                disabled={!playing || state.dampCharges <= 0}
                color={VIOLET}
                scaleFont={scaleFont}
                flex={1.3}
                active={dampArmed}
              />
            </View>
          </View>

          <Text style={[styles.instruction, { fontSize: scaleFont(8), marginTop: scaleSpacing(8) }]}>
            Each action advances detection one beat. Bright red = firing now; faint red = next beat. Stand in a Shadow Pocket to be ignored, or arm the one-use Dampener before an action to shroud it.
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
                  color: state.status === 'SUCCESS' ? CYAN : RED,
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

function ActionButton({
  label,
  onPress,
  disabled,
  color,
  scaleFont,
  flex,
  primary,
  active,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  color: string;
  scaleFont: (n: number) => number;
  flex: number;
  primary?: boolean;
  active?: boolean;
}): React.JSX.Element {
  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionBtn,
        {
          flex,
          borderColor: disabled ? '#243040' : active ? WHITE_HOT : color,
          borderWidth: active || primary ? 2 : 1,
          backgroundColor: active
            ? 'rgba(168,85,247,0.18)'
            : primary
              ? 'rgba(34,211,238,0.12)'
              : 'rgba(0,0,0,0.4)',
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text style={[styles.actionText, { fontSize: scaleFont(9.5), color: disabled ? '#475569' : active ? WHITE_HOT : color }]}>
        {label}
      </Text>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  panel: { flex: 1, minHeight: 0, borderWidth: 1 },
  scrollBody: { flex: 1, minHeight: 0 },
  title: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1.5, color: CYAN },
  subtitle: { fontFamily: 'monospace', color: BODY_MUTED, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  meta: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.6 },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pip: { width: 9, height: 9, borderWidth: 1, borderRadius: 2 },
  statusLine: { minHeight: 26, justifyContent: 'center' },
  statusText: { fontFamily: 'monospace', letterSpacing: 0.4, fontWeight: '700' },
  shaftWrap: { alignSelf: 'center', position: 'relative' },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: RED },
  failLock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: RED_BLACK, borderWidth: 2, borderColor: RED },
  controls: { alignSelf: 'stretch' },
  controlRow: { flexDirection: 'row' },
  actionBtn: { borderRadius: 4, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.6 },
  instruction: { fontFamily: 'monospace', color: '#6b7280', letterSpacing: 0.3, textAlign: 'center' },
  penalty: { fontFamily: 'monospace', color: '#7f1d1d', letterSpacing: 0.4 },
  banner: { fontFamily: 'monospace', letterSpacing: 0.3, textAlign: 'center' },
});
