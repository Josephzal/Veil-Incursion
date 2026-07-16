import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedG = Animated.createAnimatedComponent(G);
import {
  NARRATIVE_UNIFIED_PANEL_BG,
  NARRATIVE_UNIFIED_PANEL_BORDER,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import HapticPressable from '../../HapticPressable';
import type { TensionMechanicProps } from './tensionMechanicTypes';
import {
  computeLeyFlow,
  connectedSides,
  generateLeyCircuitBoard,
  LEY_CIRCUIT_CONFIG,
  polarityLabel,
  type LeyBoard,
  type LeyTile,
  type Polarity,
} from './leyCircuitBreachEngine';
import { logNarrativeMinigameCompleted } from '../../../data/narrative/narrativeMinigameTelemetry';

const GRID_COLOR = '#22d3ee';
const GRID_GLOW = 'rgba(34, 211, 238, 0.35)';
const VEIL_COLOR = '#b26bff';
const VEIL_GLOW = 'rgba(178, 107, 255, 0.4)';
const VEIL_EDGE = '#ef4444';
const DIM_CONDUIT = '#22402f';
const BLOCK_FILL = '#0a0f14';
const BLOCK_EDGE = '#5b1a1a';
const TERMINAL_GREEN = '#00ff33';
const BODY_MUTED = '#94A3B8';
const MUTED_WHITE = '#F8FAFC';
const WARN_AMBER = '#FBBF24';
const COLLAPSE_RED = '#EF4444';
const BOARD_BG = '#03060c';

const TICK_MS = 50;

const SUCCESS_LINES = [
  'The corrupted signal floods the seal. The circuit accepts your polarity.',
  'The ley-conduit ignites end to end. The seal breaks open.',
] as const;

const FAILURE_LINES = [
  'The trace burns through. The circuit collapses into dead static.',
  'The signal short-circuits one time too many. The seal reseals.',
] as const;

const GRID_BRIGHT = '#d6feff';
const VEIL_BRIGHT = '#f0d0ff';

function polarityColor(p: Polarity | null): string {
  return p === 'VEIL' ? VEIL_COLOR : GRID_COLOR;
}
function polarityGlow(p: Polarity | null): string {
  return p === 'VEIL' ? VEIL_GLOW : GRID_GLOW;
}
function polarityBright(p: Polarity | null): string {
  return p === 'VEIL' ? VEIL_BRIGHT : GRID_BRIGHT;
}

/**
 * Ley Circuit Breach — 6×6 polarity routing puzzle for Mechanic_LeyCircuitBreach.
 * Rotate conduit tiles to force the signal from the Source Sigil to the Exit
 * Seal in the required Grid/Veil polarity before the Trace meter fills.
 * Does not mutate run state; callers own success/failure resolution.
 */
export default function LeyCircuitBreach({
  onSuccess,
  onFailure,
  defaultPenalty,
  difficulty = 'MEDIUM',
  narrativeEventId,
}: TensionMechanicProps): React.JSX.Element {
  const { scaleSize, scaleSpacing, scaleFont } = useResponsiveLayout();
  const startedAtRef = useRef(Date.now());
  const seed = `ley-circuit:${narrativeEventId ?? 'live'}`;

  const [board, setBoard] = useState<LeyBoard>(() => generateLeyCircuitBoard(seed));
  const [trace, setTrace] = useState(0);
  const [signalStep, setSignalStep] = useState(0);
  const [shortCircuits, setShortCircuits] = useState(0);
  const [graceLeft, setGraceLeft] = useState<number>(LEY_CIRCUIT_CONFIG.gracePeriodSec);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [resolveState, setResolveState] = useState<'playing' | 'success' | 'failure'>('playing');

  const boardRef = useRef(board);
  const traceRef = useRef(0);
  const stepRef = useRef(0);
  const shortRef = useRef(0);
  const elapsedRef = useRef(0);
  const signalAccumRef = useRef(0);
  const resolvedRef = useRef(false);
  boardRef.current = board;

  // Continuously travelling energy dashes + per-layer surge + short-circuit pulse.
  const flowAnim = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;
  const shortFlash = useRef(new Animated.Value(0)).current;

  const size = board.size;
  const cs = scaleSize(42);
  const gutter = scaleSize(20);
  const boardPx = size * cs;
  const svgW = boardPx + gutter * 2;
  const svgH = boardPx;

  const dashLen = cs * 0.34;

  // Endless current running through the lit conduits.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(flowAnim, {
        toValue: 1,
        duration: 620,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [flowAnim]);

  // Each time the signal front advances, surge the newly-lit layer in smoothly.
  useEffect(() => {
    stepFade.setValue(0.15);
    Animated.timing(stepFade, {
      toValue: 1,
      duration: LEY_CIRCUIT_CONFIG.signalStepSec * 1000 * 0.9,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [signalStep, stepFade]);

  const flow = useMemo(() => computeLeyFlow(board), [board]);

  const finish = useCallback(
    (win: boolean) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      setResolveState(win ? 'success' : 'failure');
      setFeedback(null);
      logNarrativeMinigameCompleted({
        mechanicId: 'Mechanic_LeyCircuitBreach',
        difficulty,
        success: win,
        attemptsUsed: shortRef.current,
        timeElapsedMs: Date.now() - startedAtRef.current,
        narrativeEventId,
      });
      if (win) onSuccess();
      else onFailure();
    },
    [difficulty, narrativeEventId, onFailure, onSuccess],
  );

  const triggerShortCircuit = useCallback((reason: string) => {
    traceRef.current = Math.min(1, traceRef.current + LEY_CIRCUIT_CONFIG.shortCircuitTrace);
    shortRef.current += 1;
    stepRef.current = 0;
    signalAccumRef.current = 0;
    setTrace(traceRef.current);
    setSignalStep(0);
    setShortCircuits(shortRef.current);
    setFeedback(`SHORT CIRCUIT — ${reason}`);
    shortFlash.stopAnimation();
    shortFlash.setValue(0);
    Animated.sequence([
      Animated.timing(shortFlash, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.timing(shortFlash, { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: false }),
    ]).start();
    if (shortRef.current >= LEY_CIRCUIT_CONFIG.maxShortCircuits || traceRef.current >= 1) {
      finish(false);
    }
  }, [finish, shortFlash]);

  useEffect(() => {
    if (resolveState !== 'playing') return undefined;
    const id = setInterval(() => {
      if (resolvedRef.current) return;
      const dt = TICK_MS / 1000;
      elapsedRef.current += dt;

      const grace = LEY_CIRCUIT_CONFIG.gracePeriodSec;
      if (elapsedRef.current < grace) {
        setGraceLeft(Math.max(0, grace - elapsedRef.current));
        return;
      }
      setGraceLeft(0);

      traceRef.current = Math.min(1, traceRef.current + dt / LEY_CIRCUIT_CONFIG.traceTimerSec);
      setTrace(traceRef.current);
      if (traceRef.current >= 1) {
        finish(false);
        return;
      }

      signalAccumRef.current += dt;
      if (signalAccumRef.current < LEY_CIRCUIT_CONFIG.signalStepSec) return;
      signalAccumRef.current -= LEY_CIRCUIT_CONFIG.signalStepSec;

      const f = computeLeyFlow(boardRef.current);
      const step = stepRef.current;

      if (f.exitConnected && f.exitDepth != null) {
        if (step >= f.exitDepth) {
          if (f.success) {
            finish(true);
          } else {
            triggerShortCircuit('POLARITY MISMATCH');
          }
          return;
        }
        stepRef.current = step + 1;
        setSignalStep(stepRef.current);
        return;
      }

      if (f.maxDepth >= 1 && step >= f.maxDepth) {
        triggerShortCircuit('DEAD END');
        return;
      }
      if (f.maxDepth >= 1) {
        stepRef.current = step + 1;
        setSignalStep(stepRef.current);
      }
      // maxDepth 0 → source stalled; no penalty, trace pressure applies.
    }, TICK_MS);
    return () => clearInterval(id);
  }, [finish, resolveState, triggerShortCircuit]);

  const rotateTile = useCallback((index: number) => {
    if (resolvedRef.current || resolveState !== 'playing') return;
    setBoard((prev) => {
      const tile = prev.tiles[index]!;
      if (tile.kind === 'BLOCKER') return prev;
      const tiles = prev.tiles.map((t, i) =>
        i === index ? { ...t, rotation: (t.rotation + 1) % 4 } : t,
      );
      return { ...prev, tiles };
    });
    setFeedback(null);
  }, [resolveState]);

  const penaltyLine = useMemo(() => {
    if (!defaultPenalty) return null;
    return defaultPenalty.type === 'HP'
      ? `TRACE BACKLASH RISK — ${defaultPenalty.amount} HP (applied on fail by narrative)`
      : `TRACE BACKLASH RISK — +${defaultPenalty.amount} RESONANCE (applied on fail by narrative)`;
  }, [defaultPenalty]);

  const banner =
    resolveState === 'success'
      ? SUCCESS_LINES[board.pathCells.length % SUCCESS_LINES.length]!
      : resolveState === 'failure'
        ? FAILURE_LINES[board.pathCells.length % FAILURE_LINES.length]!
        : null;

  const tracePct = Math.round(trace * 100);
  const isLive = (cell: number): boolean =>
    flow.polarityOut[cell] !== undefined && (flow.depth[cell] ?? 0) <= signalStep;

  // Source / exit seal geometry.
  const srcCx = gutter * 0.5;
  const srcCy = board.sourceRow * cs + cs / 2;
  const exitCx = gutter + boardPx + gutter * 0.5;
  const exitCy = board.exitRow * cs + cs / 2;

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
          <Text style={[styles.title, { fontSize: scaleFont(11) }]}>LEY CIRCUIT BREACH</Text>
          <Text style={[styles.subtitle, { fontSize: scaleFont(9), lineHeight: scaleFont(13) }]}>
            Force the signal from the Source Sigil to the Exit Seal — in the required polarity.
          </Text>

          <View style={[styles.legendRow, { marginTop: scaleSpacing(6), gap: scaleSpacing(8) }]}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: polarityColor(board.sourcePolarity) }]} />
              <Text style={[styles.legendText, { fontSize: scaleFont(8), color: polarityColor(board.sourcePolarity) }]}>
                {`SOURCE: ${polarityLabel(board.sourcePolarity)}`}
              </Text>
            </View>
            <Text style={[styles.legendArrow, { fontSize: scaleFont(9) }]}>{'»»'}</Text>
            <View style={styles.legendItem}>
              <View style={[styles.diamond, { backgroundColor: polarityColor(board.requiredPolarity) }]} />
              <Text style={[styles.legendText, { fontSize: scaleFont(8), color: polarityColor(board.requiredPolarity) }]}>
                {`SEAL NEEDS: ${polarityLabel(board.requiredPolarity)}`}
              </Text>
            </View>
          </View>

          <View style={[styles.metaRow, { marginTop: scaleSpacing(6), gap: scaleSpacing(10) }]}>
            <View style={styles.traceBlock}>
              <View style={styles.traceHeader}>
                <Text style={[styles.meta, { fontSize: scaleFont(8), color: tracePct >= 70 ? COLLAPSE_RED : WARN_AMBER }]}>
                  TRACE
                </Text>
                <Text style={[styles.meta, { fontSize: scaleFont(8), color: MUTED_WHITE }]}>{tracePct}%</Text>
              </View>
              <View style={styles.traceTrack}>
                <View
                  style={[
                    styles.traceFill,
                    { width: `${tracePct}%`, backgroundColor: tracePct >= 70 ? COLLAPSE_RED : WARN_AMBER },
                  ]}
                />
              </View>
            </View>
            <View style={styles.pips}>
              <Text style={[styles.meta, { fontSize: scaleFont(8), color: BODY_MUTED }]}>SHORTS </Text>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.pip,
                    { backgroundColor: i < shortCircuits ? COLLAPSE_RED : 'transparent', borderColor: COLLAPSE_RED },
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={[styles.statusLine, { marginTop: scaleSpacing(4) }]}>
            <Text
              style={[
                styles.statusText,
                {
                  fontSize: scaleFont(9),
                  color: feedback ? COLLAPSE_RED : graceLeft > 0 ? WARN_AMBER : TERMINAL_GREEN,
                },
              ]}
            >
              {feedback
                ?? (graceLeft > 0
                  ? `SIGNAL SPOOLING — ${graceLeft.toFixed(1)}s`
                  : flow.exitConnected && !flow.success
                    ? 'PATH REACHES SEAL — WRONG POLARITY'
                    : 'SIGNAL LIVE — route the conduit')}
            </Text>
          </View>

          <View style={[styles.diagramWrap, { width: svgW, height: svgH, marginTop: scaleSpacing(8) }]}>
            <Svg width={svgW} height={svgH} style={styles.svgAbs}>
              {/* faint grid backdrop */}
              {Array.from({ length: size + 1 }, (_, i) => (
                <Line
                  key={`gv-${i}`}
                  x1={gutter + i * cs}
                  y1={0}
                  x2={gutter + i * cs}
                  y2={boardPx}
                  stroke="rgba(56, 89, 74, 0.25)"
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: size + 1 }, (_, i) => (
                <Line
                  key={`gh-${i}`}
                  x1={gutter}
                  y1={i * cs}
                  x2={gutter + boardPx}
                  y2={i * cs}
                  stroke="rgba(56, 89, 74, 0.25)"
                  strokeWidth={1}
                />
              ))}

              {board.tiles.map((tile, index) => (
                <TileGlyph
                  key={`tile-${index}`}
                  tile={tile}
                  row={Math.floor(index / size)}
                  col={index % size}
                  cs={cs}
                  gutter={gutter}
                  live={isLive(index)}
                  polarity={flow.polarityOut[index] ?? null}
                  front={isLive(index) && (flow.depth[index] ?? -1) === signalStep}
                  depth={flow.depth[index] ?? 0}
                  enterSide={flow.enterSide[index] ?? 3}
                  flowAnim={flowAnim}
                  dashLen={dashLen}
                  stepFade={stepFade}
                />
              ))}

              {/* Source feed line + sigil */}
              <Line
                x1={srcCx}
                y1={srcCy}
                x2={gutter}
                y2={srcCy}
                stroke={polarityColor(board.sourcePolarity)}
                strokeWidth={cs * 0.14}
                strokeLinecap="round"
              />
              <Circle cx={srcCx} cy={srcCy} r={cs * 0.3} fill="none" stroke={polarityColor(board.sourcePolarity)} strokeWidth={2} />
              <Circle cx={srcCx} cy={srcCy} r={cs * 0.14} fill={polarityColor(board.sourcePolarity)} />

              {/* Exit seal */}
              <Line
                x1={gutter + boardPx}
                y1={exitCy}
                x2={exitCx}
                y2={exitCy}
                stroke={flow.success ? polarityColor(board.requiredPolarity) : 'rgba(148,163,184,0.5)'}
                strokeWidth={cs * 0.14}
                strokeLinecap="round"
              />
              <SealGlyph
                cx={exitCx}
                cy={exitCy}
                r={cs * 0.32}
                color={polarityColor(board.requiredPolarity)}
                lit={flow.success}
              />
            </Svg>

            {/* Tap overlay */}
            <View style={[styles.tapLayer, { left: gutter, width: boardPx, height: boardPx }]}>
              {Array.from({ length: size }, (_, r) => (
                <View key={`row-${r}`} style={styles.tapRow}>
                  {Array.from({ length: size }, (_, c) => {
                    const index = r * size + c;
                    const isBlocker = board.tiles[index]!.kind === 'BLOCKER';
                    return (
                      <HapticPressable
                        key={`cell-${index}`}
                        disabled={isBlocker || resolveState !== 'playing'}
                        onPress={() => rotateTile(index)}
                        style={{ width: cs, height: cs }}
                      />
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Short-circuit red pulse */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shortPulse,
                {
                  opacity: shortFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
                },
              ]}
            />
          </View>

          <Text style={[styles.instruction, { fontSize: scaleFont(8), marginTop: scaleSpacing(8) }]}>
            Tap tiles to rotate. Inverter glyphs flip Grid⇄Veil in transit. 3 short circuits or full trace = failure.
          </Text>

          {penaltyLine ? (
            <Text style={[styles.penalty, { fontSize: scaleFont(8), marginTop: scaleSpacing(4) }]}>
              {penaltyLine}
            </Text>
          ) : null}

          {banner ? (
            <Text
              style={[
                styles.banner,
                {
                  fontSize: scaleFont(10),
                  lineHeight: scaleFont(14),
                  color: resolveState === 'success' ? TERMINAL_GREEN : COLLAPSE_RED,
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

function TileGlyph({
  tile,
  row,
  col,
  cs,
  gutter,
  live,
  polarity,
  front,
  depth,
  enterSide,
  flowAnim,
  dashLen,
  stepFade,
}: {
  tile: LeyTile;
  row: number;
  col: number;
  cs: number;
  gutter: number;
  live: boolean;
  polarity: Polarity | null;
  front: boolean;
  depth: number;
  enterSide: number;
  flowAnim: Animated.Value;
  dashLen: number;
  stepFade: Animated.Value;
}): React.JSX.Element {
  const x0 = gutter + col * cs;
  const y0 = row * cs;
  const cx = x0 + cs / 2;
  const cy = y0 + cs / 2;

  if (tile.kind === 'BLOCKER') {
    const pad = cs * 0.16;
    return (
      <G>
        <Rect x={x0 + pad} y={y0 + pad} width={cs - pad * 2} height={cs - pad * 2} rx={3} fill={BLOCK_FILL} stroke={BLOCK_EDGE} strokeWidth={1.5} />
        <Line x1={x0 + pad * 2} y1={y0 + pad * 2} x2={x0 + cs - pad * 2} y2={y0 + cs - pad * 2} stroke={BLOCK_EDGE} strokeWidth={1.5} />
        <Line x1={x0 + cs - pad * 2} y1={y0 + pad * 2} x2={x0 + pad * 2} y2={y0 + cs - pad * 2} stroke={BLOCK_EDGE} strokeWidth={1.5} />
      </G>
    );
  }

  const sides = connectedSides(tile);
  const mids: Record<number, [number, number]> = {
    0: [cx, y0],
    1: [x0 + cs, cy],
    2: [cx, y0 + cs],
    3: [x0, cy],
  };
  const baseColor = live ? polarityColor(polarity) : DIM_CONDUIT;
  const glow = live ? polarityGlow(polarity) : 'transparent';
  const bright = polarityBright(polarity);
  const w = cs * 0.15;
  const period = dashLen * 2;
  const half = cs / 2;
  // Arc length (from the source, in pixels) at this cell's centre. Each BFS
  // hop is exactly one tile → depth * cs. Phasing each segment's dash offset by
  // its upstream arc length makes the current read as ONE continuous flow
  // across every connected tile instead of restarting per segment.
  const centreArc = depth * cs;

  const statics: React.JSX.Element[] = [];
  const currents: React.JSX.Element[] = [];
  for (let d = 0; d < 4; d += 1) {
    if (!sides[d]) continue;
    const [mx, my] = mids[d]!;
    if (live) {
      statics.push(
        <Line key={`glow-${row}-${col}-${d}`} x1={cx} y1={cy} x2={mx} y2={my} stroke={glow} strokeWidth={w * 2.6} strokeLinecap="round" />,
      );
    }
    statics.push(
      <Line key={`c-${row}-${col}-${d}`} x1={cx} y1={cy} x2={mx} y2={my} stroke={baseColor} strokeWidth={w} strokeLinecap="round" />,
    );
    if (live) {
      // Draw every half-segment upstream → downstream so the dash pattern is
      // parameterised by global arc length. Entry side flows edge → centre;
      // all other (exit) sides flow centre → edge.
      const isEntry = d === enterSide;
      const upstreamArc = isEntry ? centreArc - half : centreArc;
      const [ax, ay] = isEntry ? [mx, my] : [cx, cy];
      const [bx, by] = isEntry ? [cx, cy] : [mx, my];
      const offset = flowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [upstreamArc, upstreamArc - period],
      });
      // Travelling bright dash = a smooth current of energy coursing through.
      currents.push(
        <AnimatedLine
          key={`flow-${row}-${col}-${d}`}
          x1={ax}
          y1={ay}
          x2={bx}
          y2={by}
          stroke={bright}
          strokeWidth={w * 0.7}
          strokeLinecap="round"
          strokeDasharray={`${dashLen} ${dashLen}`}
          strokeDashoffset={offset}
          opacity={0.95}
        />,
      );
    }
  }

  return (
    <AnimatedG opacity={front ? stepFade : 1}>
      {statics}
      {currents}
      {tile.kind === 'INVERTER' ? (
        <InverterNode cx={cx} cy={cy} r={cs * 0.2} lit={live} />
      ) : (
        <Circle cx={cx} cy={cy} r={front ? cs * 0.14 : cs * 0.08} fill={live ? bright : '#2c4a3a'} />
      )}
    </AnimatedG>
  );
}

function InverterNode({ cx, cy, r, lit }: { cx: number; cy: number; r: number; lit: boolean }): React.JSX.Element {
  const top = `${cx},${cy - r}`;
  const right = `${cx + r},${cy}`;
  const bottom = `${cx},${cy + r}`;
  const left = `${cx - r},${cy}`;
  return (
    <G opacity={lit ? 1 : 0.85}>
      <Path d={`M ${top} L ${left} L ${bottom} Z`} fill={GRID_COLOR} />
      <Path d={`M ${top} L ${right} L ${bottom} Z`} fill={VEIL_COLOR} />
      <Path
        d={`M ${top} L ${right} L ${bottom} L ${left} Z`}
        fill="none"
        stroke={lit ? '#ffffff' : VEIL_EDGE}
        strokeWidth={1.4}
      />
    </G>
  );
}

function SealGlyph({ cx, cy, r, color, lit }: { cx: number; cy: number; r: number; color: string; lit: boolean }): React.JSX.Element {
  const pts: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return (
    <G>
      <Path d={`M ${pts.join(' L ')} Z`} fill={lit ? color : 'rgba(148,163,184,0.12)'} stroke={color} strokeWidth={2} opacity={lit ? 1 : 0.8} />
      <Circle cx={cx} cy={cy} r={r * 0.4} fill={lit ? '#ffffff' : color} opacity={lit ? 1 : 0.6} />
    </G>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  panel: { flex: 1, minHeight: 0, borderWidth: 1 },
  scrollBody: { flex: 1, minHeight: 0 },
  title: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.5,
    color: GRID_COLOR,
  },
  subtitle: { fontFamily: 'monospace', color: BODY_MUTED, marginTop: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.6 },
  legendArrow: { fontFamily: 'monospace', color: '#475569', fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  diamond: { width: 8, height: 8, transform: [{ rotate: '45deg' }] },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  traceBlock: { flex: 1, gap: 3 },
  traceHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.6 },
  traceTrack: {
    height: 8,
    borderWidth: 1,
    borderColor: '#3a2a10',
    backgroundColor: '#0B0F14',
    overflow: 'hidden',
  },
  traceFill: { height: '100%' },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pip: { width: 9, height: 9, borderWidth: 1, borderRadius: 2 },
  statusLine: { minHeight: 16 },
  statusText: { fontFamily: 'monospace', letterSpacing: 0.4, fontWeight: '700' },
  diagramWrap: {
    alignSelf: 'center',
    position: 'relative',
    backgroundColor: BOARD_BG,
    borderWidth: 1,
    borderColor: '#123',
  },
  svgAbs: { position: 'absolute', top: 0, left: 0 },
  shortPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLLAPSE_RED,
    borderWidth: 2,
    borderColor: COLLAPSE_RED,
  },
  tapLayer: { position: 'absolute', top: 0 },
  tapRow: { flexDirection: 'row' },
  instruction: {
    fontFamily: 'monospace',
    color: '#6b7280',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  penalty: { fontFamily: 'monospace', color: '#7f1d1d', letterSpacing: 0.4 },
  banner: { fontFamily: 'monospace', letterSpacing: 0.3, textAlign: 'center' },
});
