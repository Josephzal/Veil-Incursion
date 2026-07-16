import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import {
  NARRATIVE_UNIFIED_PANEL_BG,
  NARRATIVE_UNIFIED_PANEL_BORDER,
  NARRATIVE_UNIFIED_PANEL_PADDING,
} from '../../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../../hooks/useResponsiveLayout';
import HapticPressable from '../../HapticPressable';
import type { TensionMechanicProps } from './tensionMechanicTypes';
import {
  buildScannerSweepConfig,
  clamp,
  createInitialPulse,
  createInitialZone,
  stepScannerSweep,
  type ScannerSweepConfig,
  type ScannerZoneState,
  type SweepPulseState,
} from './scannerSweepEngine';
import { logNarrativeMinigameCompleted } from '../../../data/narrative/narrativeMinigameTelemetry';

const TERMINAL_GREEN = '#00ff33';
const BODY_MUTED = '#94A3B8';
const MUTED_WHITE = '#F8FAFC';
const WARN_AMBER = '#FBBF24';
const COLLAPSE_RED = '#EF4444';
const BLIND_FILL = 'rgba(0, 255, 51, 0.16)';
const BLIND_STROKE = 'rgba(0, 255, 51, 0.75)';
const LANE_BG = '#0B0F14';
const LANE_BORDER = '#1f2937';
const TICK_MS = 50;

const SUCCESS_LINES = [
  'Your signal ghosts beneath the hostile sweep.',
  'The scanner passes over empty air.',
  'The concealment pattern holds. You remain unseen.',
] as const;

const FAILURE_LINES = [
  'The sweep catches your signal.',
  'Your trace blooms across the hostile scanner.',
  'The concealment pattern breaks.',
] as const;

const PULSE_WARN_LINES = [
  'HOSTILE SWEEP INBOUND',
  'MASK WINDOW COMPRESSING',
  'TRACE DRIFT DETECTED',
] as const;

/**
 * Scanner Sweep — keep the signal cursor inside a moving blind zone on a 1D
 * lane while hostile sweep pulses disrupt the window. Mechanic_ConcealSlider.
 * Does not mutate run state.
 */
export default function ScannerSweep({
  onSuccess,
  onFailure,
  defaultPenalty,
  difficulty = 'MEDIUM',
  narrativeEventId,
}: TensionMechanicProps): React.JSX.Element {
  const { scaleSize, scaleSpacing, scaleFont } = useResponsiveLayout();
  const [reduceMotion, setReduceMotion] = useState(false);
  const startedAtRef = useRef(Date.now());
  const seed = `scanner-sweep:${difficulty}:${narrativeEventId ?? 'live'}`;
  const [config] = useState<ScannerSweepConfig>(() => buildScannerSweepConfig(difficulty, seed));

  const [laneWidth, setLaneWidth] = useState(0);
  const [cursor, setCursor] = useState(0.5);
  const [mask, setMask] = useState(0);
  const [detection, setDetection] = useState(0);
  const [dampened, setDampened] = useState(false);
  const [inside, setInside] = useState(true);
  const [zone, setZone] = useState<ScannerZoneState>(() => createInitialZone(config, seed));
  const [pulse, setPulse] = useState<SweepPulseState>(() => createInitialPulse(config));
  const [beamPos, setBeamPos] = useState<number | null>(null);
  const [caught, setCaught] = useState(false);
  const [resolveState, setResolveState] = useState<'playing' | 'success' | 'failure'>('playing');

  const resolvedRef = useRef(false);
  const cursorRef = useRef(0.5);
  const dragTargetRef = useRef<number | null>(null);
  const dampRef = useRef(false);
  const maskRef = useRef(0);
  const detectionRef = useRef(0);
  const elapsedRef = useRef(0);
  const zoneRef = useRef<ScannerZoneState>(zone);
  const pulseRef = useRef<SweepPulseState>(pulse);

  cursorRef.current = cursor;
  dampRef.current = dampened;
  zoneRef.current = zone;
  pulseRef.current = pulse;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const finishSuccess = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolveState('success');
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_ConcealSlider',
      difficulty,
      success: true,
      timeElapsedMs: Date.now() - startedAtRef.current,
      narrativeEventId,
    });
    onSuccess();
  }, [difficulty, narrativeEventId, onSuccess]);

  const finishFailure = useCallback(() => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setResolveState('failure');
    logNarrativeMinigameCompleted({
      mechanicId: 'Mechanic_ConcealSlider',
      difficulty,
      success: false,
      timeElapsedMs: Date.now() - startedAtRef.current,
      narrativeEventId,
    });
    onFailure();
  }, [difficulty, narrativeEventId, onFailure]);

  useEffect(() => {
    if (resolveState !== 'playing') return undefined;

    const id = setInterval(() => {
      if (resolvedRef.current) return;
      const dt = TICK_MS / 1000;
      const motionScale = reduceMotion ? 0.6 : 1;
      elapsedRef.current += dt * motionScale;

      // Cursor soft-follow toward drag target; damp steadies (slower) movement.
      const target = dragTargetRef.current;
      if (target != null) {
        const moveMult = dampRef.current ? config.dampMoveMultiplier : 1;
        const maxStep = 0.9 * moveMult;
        const gap = target - cursorRef.current;
        const step = clamp(gap, -maxStep * dt * 10, maxStep * dt * 10);
        cursorRef.current = clamp(cursorRef.current + step, 0, 1);
        setCursor(cursorRef.current);
      }

      const next = stepScannerSweep({
        mask: maskRef.current,
        detection: detectionRef.current,
        cursor: cursorRef.current,
        zone: zoneRef.current,
        pulse: pulseRef.current,
        elapsedSec: elapsedRef.current,
        dtSec: dt,
        dampened: dampRef.current,
        config,
        seed,
      });

      maskRef.current = next.mask;
      detectionRef.current = next.detection;
      zoneRef.current = next.zone;
      pulseRef.current = next.pulse;

      setMask(next.mask);
      setDetection(next.detection);
      setZone(next.zone);
      setPulse(next.pulse);
      setInside(next.inside);
      setBeamPos(next.beamPos);
      setCaught(next.caughtInBeam);

      if (next.failed) {
        finishFailure();
        return;
      }
      if (next.succeeded) {
        finishSuccess();
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [config, finishFailure, finishSuccess, reduceMotion, resolveState, seed]);

  const moveCursorLocal = useCallback(
    (localX: number) => {
      if (resolvedRef.current || resolveState !== 'playing') return;
      if (laneWidth <= 0) return;
      dragTargetRef.current = clamp(localX / laneWidth, 0, 1);
    },
    [laneWidth, resolveState],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => resolveState === 'playing',
        onMoveShouldSetPanResponder: () => resolveState === 'playing',
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          moveCursorLocal(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt: GestureResponderEvent) => {
          moveCursorLocal(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          dragTargetRef.current = null;
        },
        onPanResponderTerminate: () => {
          dragTargetRef.current = null;
        },
      }),
    [moveCursorLocal, resolveState],
  );

  const onLaneLayout = useCallback((event: LayoutChangeEvent) => {
    setLaneWidth(event.nativeEvent.layout.width);
  }, []);

  const penaltyLine = useMemo(() => {
    if (!defaultPenalty) return null;
    return defaultPenalty.type === 'HP'
      ? `EXPOSURE RISK — ${defaultPenalty.amount} HP (applied on fail by narrative)`
      : `EXPOSURE RISK — +${defaultPenalty.amount} RESONANCE (applied on fail by narrative)`;
  }, [defaultPenalty]);

  const banner =
    resolveState === 'success'
      ? SUCCESS_LINES[Math.floor(mask * 10) % SUCCESS_LINES.length]!
      : resolveState === 'failure'
        ? FAILURE_LINES[Math.floor(detection * 10) % FAILURE_LINES.length]!
        : null;

  const pulseWarnLine = useMemo(() => {
    if (caught) return 'CAUGHT IN SWEEP — DETECTION SPIKE';
    if (pulse.phase === 'WARNING') return PULSE_WARN_LINES[pulse.eventIndex % PULSE_WARN_LINES.length]!;
    if (pulse.phase === 'ACTIVE') {
      return pulse.effect === 'NARROW' ? 'MASK WINDOW COMPRESSING' : 'HOSTILE SWEEP CROSSING';
    }
    return null;
  }, [caught, pulse]);

  const detectionPct = Math.round(detection * 100);
  const maskPct = Math.round(mask * 100);

  const laneHeight = scaleSize(96);
  const trackTop = laneHeight / 2 - scaleSize(10);
  const blindLeftPct = clamp((zone.center - zone.halfWidth) * 100, 0, 100);
  const blindWidthPct = clamp(zone.halfWidth * 2 * 100, 0, 100);
  const cursorLeftPct = clamp(cursor * 100, 0, 100);
  const pulseVisible = pulse.phase === 'ACTIVE' || pulse.phase === 'WARNING';

  return (
    <View style={[styles.root, { padding: scaleSpacing(NARRATIVE_UNIFIED_PANEL_PADDING) }]}>
      <View
        style={[
          styles.panel,
          {
            borderColor: NARRATIVE_UNIFIED_PANEL_BORDER,
            backgroundColor: NARRATIVE_UNIFIED_PANEL_BG,
          },
        ]}
      >
        <Text style={[styles.title, { fontSize: scaleFont(11) }]}>SCANNER SWEEP</Text>
        <Text style={[styles.subtitle, { fontSize: scaleFont(10), lineHeight: scaleFont(14) }]}>
          Keep your signal inside the moving blind zone.
        </Text>

        <View style={[styles.meters, { marginTop: scaleSpacing(8), gap: scaleSpacing(6) }]}>
          <Meter
            label="SIGNAL MASK"
            pct={maskPct}
            fillColor={inside ? TERMINAL_GREEN : 'rgba(0, 255, 51, 0.5)'}
            scaleFont={scaleFont}
          />
          <Meter
            label="DETECTION"
            pct={detectionPct}
            fillColor={detectionPct >= 70 ? COLLAPSE_RED : detectionPct >= 40 ? WARN_AMBER : BODY_MUTED}
            scaleFont={scaleFont}
          />
        </View>

        <Text
          style={[
            pulseVisible || !inside ? styles.warn : styles.hint,
            { fontSize: scaleFont(9), marginTop: scaleSpacing(4) },
          ]}
        >
          {pulseWarnLine
            ?? (inside
              ? 'Track the mask window. Hold DAMP SIGNAL to steady your trace.'
              : 'TRACE EXPOSED — slide back into the blind zone.')}
        </Text>

        <View
          onLayout={onLaneLayout}
          style={[
            styles.lane,
            {
              height: laneHeight,
              marginTop: scaleSpacing(10),
              borderColor: !inside ? COLLAPSE_RED : pulseVisible ? WARN_AMBER : LANE_BORDER,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Base track */}
          <View style={[styles.track, { top: trackTop, height: scaleSize(20) }]} />

          {/* Blind zone (mask window) */}
          <View
            style={[
              styles.blindZone,
              {
                top: trackTop - scaleSize(6),
                height: scaleSize(32),
                left: `${blindLeftPct}%`,
                width: `${blindWidthPct}%`,
                borderColor: pulse.phase === 'ACTIVE' && pulse.effect === 'NARROW'
                  ? WARN_AMBER
                  : BLIND_STROKE,
              },
            ]}
          >
            <Text style={[styles.blindLabel, { fontSize: scaleFont(6) }]} numberOfLines={1}>
              MASK
            </Text>
          </View>

          {/* Warning wash before the beam crosses */}
          {pulse.phase === 'WARNING' ? (
            <View
              pointerEvents="none"
              style={[styles.pulseBand, { opacity: 0.18, backgroundColor: 'rgba(251, 191, 36, 0.25)' }]}
            />
          ) : null}

          {/* Traveling hostile detection beam */}
          {beamPos != null ? (
            <View
              pointerEvents="none"
              style={[
                styles.beam,
                {
                  left: `${clamp(beamPos * 100, 0, 100)}%`,
                  width: scaleSize(6),
                  marginLeft: -scaleSize(3),
                  backgroundColor: caught ? COLLAPSE_RED : 'rgba(239, 68, 68, 0.8)',
                  shadowColor: COLLAPSE_RED,
                },
              ]}
            />
          ) : null}

          {/* Player signal cursor */}
          <View
            pointerEvents="none"
            style={[
              styles.cursor,
              {
                left: `${cursorLeftPct}%`,
                width: dampened ? scaleSize(6) : scaleSize(9),
                marginLeft: dampened ? -scaleSize(3) : -scaleSize(4.5),
                backgroundColor: inside ? TERMINAL_GREEN : COLLAPSE_RED,
                borderColor: MUTED_WHITE,
              },
            ]}
          />
        </View>

        <HapticPressable
          disabled={resolveState !== 'playing'}
          onPressIn={() => {
            if (resolveState !== 'playing') return;
            setDampened(true);
            dampRef.current = true;
          }}
          onPressOut={() => {
            setDampened(false);
            dampRef.current = false;
          }}
          style={({ pressed }) => [
            styles.dampBtn,
            {
              marginTop: scaleSpacing(12),
              borderColor: dampened ? TERMINAL_GREEN : '#334155',
              backgroundColor: dampened ? 'rgba(0, 255, 51, 0.12)' : 'rgba(15, 23, 42, 0.8)',
              opacity: resolveState !== 'playing' ? 0.45 : pressed ? 0.85 : 1,
              paddingVertical: scaleSpacing(10),
            },
          ]}
        >
          <Text
            style={[
              styles.dampLabel,
              { fontSize: scaleFont(11), color: dampened ? TERMINAL_GREEN : MUTED_WHITE },
            ]}
          >
            {dampened ? '[ DAMPING — STEADY TRACE ]' : '[ HOLD — DAMP SIGNAL ]'}
          </Text>
        </HapticPressable>

        {penaltyLine ? (
          <Text style={[styles.penalty, { fontSize: scaleFont(8), marginTop: scaleSpacing(6) }]}>
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
                marginTop: scaleSpacing(8),
              },
            ]}
          >
            {banner}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Meter({
  label,
  pct,
  fillColor,
  scaleFont,
}: {
  label: string;
  pct: number;
  fillColor: string;
  scaleFont: (n: number) => number;
}): React.JSX.Element {
  return (
    <View style={styles.meterBlock}>
      <View style={styles.meterHeader}>
        <Text style={[styles.meterLabel, { fontSize: scaleFont(9), color: fillColor }]}>
          {label}
        </Text>
        <Text style={[styles.meterPct, { fontSize: scaleFont(9), color: MUTED_WHITE }]}>
          {clamp(pct, 0, 100)}%
        </Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${clamp(pct, 0, 100)}%`, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  panel: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
    padding: 12,
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.5,
    color: TERMINAL_GREEN,
  },
  subtitle: {
    fontFamily: 'monospace',
    color: BODY_MUTED,
    marginTop: 4,
  },
  meters: {
    width: '100%',
  },
  meterBlock: {
    gap: 3,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meterLabel: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  meterPct: {
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },
  meterTrack: {
    height: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0B0F14',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
  },
  warn: {
    fontFamily: 'monospace',
    color: COLLAPSE_RED,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  hint: {
    fontFamily: 'monospace',
    color: '#6b7280',
    letterSpacing: 0.3,
  },
  lane: {
    width: '100%',
    borderWidth: 1,
    backgroundColor: LANE_BG,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  blindZone: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
    backgroundColor: BLIND_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blindLabel: {
    fontFamily: 'monospace',
    color: 'rgba(0, 255, 51, 0.85)',
    letterSpacing: 1,
    fontWeight: '700',
  },
  pulseBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  beam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  cursor: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    borderWidth: 1,
    borderRadius: 2,
  },
  dampBtn: {
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  dampLabel: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  penalty: {
    fontFamily: 'monospace',
    color: '#7f1d1d',
    letterSpacing: 0.4,
  },
  banner: {
    fontFamily: 'monospace',
    letterSpacing: 0.3,
  },
});
