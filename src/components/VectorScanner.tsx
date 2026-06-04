import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import {
  Blur,
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  Rect,
  Skia,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import {
  Easing as ReanimatedEasing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { getCabalScannerTheme } from './scanner/cabalScannerThemes';
import type { ScannerCabal } from '../types/scanner';
import type { RadarDot } from '../types/run';

export const SCAN_SWEEP_MS = 2200;
export const SCAN_ROTATIONS = 3;
export const SCAN_DURATION_MS = SCAN_SWEEP_MS * SCAN_ROTATIONS;
/** Fixed footer reservation — cease control never unmounts, only fades. */
export const SCANNER_CEASE_SLOT_HEIGHT = 40;

export function getScannerShellHeight(scannerSize: number): number {
  return scannerSize + SCANNER_CEASE_SLOT_HEIGHT;
}

const SWEEP_HIT_THRESHOLD_DEG = 3;
const SWEEP_ARM_HYSTERESIS_DEG = 8;
const PHOSPHOR_DECAY_MS = 1500;
const PHOSPHOR_IDLE_OPACITY = 0.05;
const BLOOM_SCALE = 1.3;
const BLOOM_SETTLE_MS = 140;
const DOT_HIT_SIZE = 44;
const DOT_VISUAL_SIZE = 12;
const BOSS_DOT_SIZE = 16;
const SWEEP_TRAIL_ACTIVE_DEG = 120;
const STROKE_THIN = 1;
const STRUCTURAL_LINE_ALPHA = 0.38;
const RADAR_CANVAS_BACKDROP = '#000000';
const CEASE_DECEL_MS = 400;
const CEASE_FOG_MS = 900;
const SIPHON_EXTRACT_MS = 280;
const SIPHON_RING_PEAK_SCALE = 2.5;
const SIPHON_ILLUMINATE_MIN_OPACITY = 0.35;
const MIN_SIPHONS_TO_CEASE = 1;
const SELECTION_GLOW_FADE_MS = 800;
const SELECTION_GLOW_INNER_SCALE = 1.9;
const SELECTION_GLOW_OUTER_SCALE = 2.75;
const SIPHON_HAPTIC_MS = 12;

interface VectorScannerProps {
  cabal: ScannerCabal;
  scannerSize: number;
  active: boolean;
  activeNodes: RadarDot[];
  coreScale?: number;
  contactsLocked?: boolean;
  onSweepComplete?: () => void;
  onSelectNode?: (nodeId: string) => void;
  onSiphonedNodesChange?: (nodeIds: string[]) => void;
  children?: React.ReactNode;
}

interface BlipRenderState {
  opacity: number;
  scale: number;
  bloomUntil: number;
  decayStart: number | null;
  siphoned: boolean;
}

interface RadarTargetProps {
  visualSize: number;
  left: number;
  top: number;
  disabled: boolean;
  pulseKey: number;
  onPress: () => void;
  ringColor: string;
}

function RadarTarget({
  visualSize,
  left,
  top,
  disabled,
  pulseKey,
  onPress,
  ringColor,
}: RadarTargetProps): React.JSX.Element {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pulseKey === 0) return;
    scaleAnim.setValue(1);
    opacityAnim.setValue(0.85);
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: SIPHON_RING_PEAK_SCALE,
        duration: SIPHON_EXTRACT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: SIPHON_EXTRACT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulseKey, scaleAnim, opacityAnim]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={[styles.nodeHitbox, { left, top, width: DOT_HIT_SIZE, height: DOT_HIT_SIZE }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.siphonPulseRing,
          {
            width: visualSize,
            height: visualSize,
            borderRadius: visualSize / 2,
            borderColor: ringColor,
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      />
    </TouchableOpacity>
  );
}

function polarAngleDeg(x: number, y: number, cx: number, cy: number): number {
  const rad = Math.atan2(y - cy, x - cx);
  return ((rad * 180) / Math.PI + 360) % 360;
}

function angularDifference(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function accentWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba')) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Static sweep shader window — never animated (rotation handled by parent Group). */
const SWEEP_GRADIENT_LEAD_DEG = 360;
const SWEEP_GRADIENT_TRAIL_START_DEG = 360 - SWEEP_TRAIL_ACTIVE_DEG;

function VectorScannerComponent({
  cabal,
  scannerSize,
  active,
  activeNodes,
  coreScale = 0.48,
  contactsLocked = false,
  onSweepComplete,
  onSelectNode,
  onSiphonedNodesChange,
  children,
}: VectorScannerProps): React.JSX.Element {
  const theme = getCabalScannerTheme(cabal);
  const coreDiameter = scannerSize * coreScale;
  const radarCenter = scannerSize / 2;
  const sweepRadius = scannerSize / 2;
  const midRingRadius = (scannerSize * 0.72) / 2;
  const coreRadius = coreDiameter / 2;

  const structuralStroke = useMemo(
    () => accentWithAlpha(theme.primary, STRUCTURAL_LINE_ALPHA),
    [theme.primary],
  );

  const [sweepDeg, setSweepDeg] = useState(0);
  const [sweepFinished, setSweepFinished] = useState(false);
  const [isCeased, setIsCeased] = useState(false);
  const [siphonedNodeIds, setSiphonedNodeIds] = useState<string[]>([]);
  const [siphonPulseKeys, setSiphonPulseKeys] = useState<Record<string, number>>({});
  const [renderTick, setRenderTick] = useState(0);
  const [fogOpacity, setFogOpacity] = useState(1);
  const [phosphorDischargeDisc, setPhosphorDischargeDisc] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());

  const blipStatesRef = useRef<Record<string, BlipRenderState>>({});
  const armedMapRef = useRef<Record<string, boolean>>({});
  const sweepCompleteFiredRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const sweepAngleRef = useRef(0);
  const lastFrameTsRef = useRef<number | null>(null);
  const ceaseStartRef = useRef<number | null>(null);
  const isCeasedRef = useRef(false);
  const dischargePhaseRef = useRef<'none' | 'decel' | 'fog' | 'done'>('none');
  const sweepSessionActiveRef = useRef(false);
  const uniformSelectAppliedRef = useRef(false);
  const onSiphonedNodesChangeRef = useRef(onSiphonedNodesChange);
  const onSelectNodeRef = useRef(onSelectNode);
  const onSweepCompleteRef = useRef(onSweepComplete);
  const lastReportedSiphonsRef = useRef('');
  onSiphonedNodesChangeRef.current = onSiphonedNodesChange;
  onSelectNodeRef.current = onSelectNode;
  onSweepCompleteRef.current = onSweepComplete;

  const uniformSelectable = contactsLocked || sweepFinished;
  const selectionAccent = theme.blipAccent;
  const selectionGlowSV = useSharedValue(0);
  const selectionGlowInnerOpacity = useDerivedValue(() => selectionGlowSV.value * 0.45);
  const selectionGlowOuterOpacity = useDerivedValue(() => selectionGlowSV.value * 0.24);
  const selectionGlowRingOpacity = useDerivedValue(() => selectionGlowSV.value * 0.85);
  const scanInteractive =
    active && !contactsLocked && !uniformSelectable && !isCeased;

  const nodeBearings = useMemo(
    () =>
      activeNodes.map((node) => ({
        node,
        id: node.id,
        canvasX: node.x,
        canvasY: node.y,
        bearingDeg: polarAngleDeg(node.x, node.y, radarCenter, radarCenter),
        visualRadius: (node.isPreDiscovered ? BOSS_DOT_SIZE : DOT_VISUAL_SIZE) / 2,
        visualSize: node.isPreDiscovered ? BOSS_DOT_SIZE : DOT_VISUAL_SIZE,
      })),
    [activeNodes, radarCenter],
  );

  const radarClipPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(radarCenter, radarCenter, sweepRadius);
    return path;
  }, [radarCenter, sweepRadius]);

  const sweepLeadColor = theme.primary;
  const sweepPivot = useMemo(() => vec(radarCenter, radarCenter), [radarCenter]);

  /** Leading edge @ 360°: ~45% accent; 120° trail mid @ ~10%; void elsewhere. */
  const activeSweepGradientColors = useMemo(
    () => [
      'transparent',
      accentWithAlpha(sweepLeadColor, 0),
      accentWithAlpha(sweepLeadColor, 0.1),
      accentWithAlpha(sweepLeadColor, 0.45),
    ],
    [sweepLeadColor],
  );

  const activeSweepGradientPositions = useMemo(() => [0, 0.38, 0.68, 1], []);

  /** Cease fog: full-disc static spread, fades via Group opacity (Option B). */
  const dischargeSweepGradientColors = useMemo(
    () => [
      'transparent',
      accentWithAlpha(sweepLeadColor, 0.04),
      accentWithAlpha(sweepLeadColor, 0.1),
      accentWithAlpha(sweepLeadColor, 0.08),
      'transparent',
    ],
    [sweepLeadColor],
  );

  const dischargeSweepGradientPositions = useMemo(
    () => [0, 0.2, 0.45, 0.7, 1],
    [],
  );

  const sweepRotationRad = (sweepDeg * Math.PI) / 180;
  const baseSweepSpeedDegPerMs = 360 / SCAN_SWEEP_MS;

  const ensureBlipState = useCallback((id: string): BlipRenderState => {
    if (!blipStatesRef.current[id]) {
      blipStatesRef.current[id] = {
        opacity: 0,
        scale: 1,
        bloomUntil: 0,
        decayStart: null,
        siphoned: false,
      };
    }
    return blipStatesRef.current[id];
  }, []);

  const bumpRender = useCallback(() => {
    setRenderTick((tick) => tick + 1);
  }, []);

  const applyUniformSelectableState = useCallback(() => {
    const now = performance.now();
    activeNodes.forEach((node) => {
      const wasSiphoned = blipStatesRef.current[node.id]?.siphoned ?? false;
      blipStatesRef.current[node.id] = {
        opacity: 1,
        scale: 1,
        bloomUntil: now,
        decayStart: null,
        siphoned: wasSiphoned,
      };
    });
    setRevealedIds(new Set(activeNodes.map((n) => n.id)));
    bumpRender();
  }, [activeNodes, bumpRender]);

  const finalizeCeaseScan = useCallback(() => {
    if (sweepCompleteFiredRef.current) return;
    sweepCompleteFiredRef.current = true;
    setSweepFinished(true);
    applyUniformSelectableState();
    queueMicrotask(() => onSweepCompleteRef.current?.());
  }, [applyUniformSelectableState]);

  const triggerPhosphorStrike = useCallback(
    (nodeId: string) => {
      if (uniformSelectable || dischargePhaseRef.current === 'fog') return;
      const state = ensureBlipState(nodeId);
      if (state.siphoned) return;

      const now = performance.now();
      state.opacity = 1;
      state.scale = BLOOM_SCALE;
      state.bloomUntil = now + BLOOM_SETTLE_MS;
      state.decayStart = null;
      bumpRender();

      setRevealedIds((prev) => {
        if (prev.has(nodeId)) return prev;
        const next = new Set(prev);
        next.add(nodeId);
        return next;
      });
    },
    [ensureBlipState, bumpRender, uniformSelectable],
  );

  const isNodeIlluminated = useCallback(
    (nodeId: string): boolean => {
      if (revealedIds.has(nodeId)) return true;
      const state = blipStatesRef.current[nodeId];
      if (!state || state.siphoned) return false;
      return state.opacity >= SIPHON_ILLUMINATE_MIN_OPACITY || state.bloomUntil > performance.now();
    },
    [revealedIds],
  );

  const triggerSiphonExtract = useCallback(
    (nodeId: string) => {
      if (!scanInteractive || siphonedNodeIds.includes(nodeId)) return;
      if (!isNodeIlluminated(nodeId)) return;

      const state = ensureBlipState(nodeId);
      state.siphoned = true;
      state.opacity = 1;
      state.scale = 1;
      state.decayStart = null;
      state.bloomUntil = 0;
      bumpRender();
      Vibration.vibrate(SIPHON_HAPTIC_MS);

      setSiphonedNodeIds((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
      setSiphonPulseKeys((prev) => ({ ...prev, [nodeId]: (prev[nodeId] ?? 0) + 1 }));
    },
    [
      scanInteractive,
      siphonedNodeIds,
      isNodeIlluminated,
      ensureBlipState,
      bumpRender,
    ],
  );

  const handleCeaseScan = useCallback(() => {
    if (!active || contactsLocked || isCeasedRef.current) return;
    if (siphonedNodeIds.length < MIN_SIPHONS_TO_CEASE) return;
    isCeasedRef.current = true;
    setIsCeased(true);
    ceaseStartRef.current = performance.now();
    dischargePhaseRef.current = 'decel';
  }, [active, contactsLocked, siphonedNodeIds.length]);

  const evaluateSweepCollision = useCallback(
    (beamDeg: number) => {
      if (uniformSelectable || dischargePhaseRef.current === 'fog') return;

      nodeBearings.forEach(({ id, bearingDeg }) => {
        if (blipStatesRef.current[id]?.siphoned) return;

        const delta = angularDifference(beamDeg, bearingDeg);
        if (delta <= SWEEP_HIT_THRESHOLD_DEG) {
          if (!armedMapRef.current[id]) {
            armedMapRef.current[id] = true;
            triggerPhosphorStrike(id);
          }
        } else if (delta >= SWEEP_ARM_HYSTERESIS_DEG) {
          armedMapRef.current[id] = false;
        }
      });
    },
    [nodeBearings, triggerPhosphorStrike, uniformSelectable],
  );

  const updateBlipDecays = useCallback(
    (now: number) => {
      if (uniformSelectable) return;

      let changed = false;
      Object.values(blipStatesRef.current).forEach((state) => {
        if (state.siphoned) return;

        if (state.bloomUntil > now) {
          const bloomT = 1 - (state.bloomUntil - now) / BLOOM_SETTLE_MS;
          const nextScale = BLOOM_SCALE - (BLOOM_SCALE - 1) * bloomT;
          if (Math.abs(state.scale - nextScale) > 0.01) {
            state.scale = nextScale;
            changed = true;
          }
          return;
        }

        if (state.opacity >= 0.99 && state.decayStart == null) {
          state.decayStart = now;
          state.scale = 1;
          changed = true;
        }

        if (state.decayStart != null) {
          const elapsed = now - state.decayStart;
          const t = Math.min(1, elapsed / PHOSPHOR_DECAY_MS);
          const eased = 1 - (1 - t) * (1 - t);
          const nextOpacity = 1 - eased * (1 - PHOSPHOR_IDLE_OPACITY);
          if (Math.abs(state.opacity - nextOpacity) > 0.01) {
            state.opacity = nextOpacity;
            changed = true;
          }
        }
      });

      if (changed) bumpRender();
    },
    [bumpRender, uniformSelectable],
  );

  useEffect(() => {
    activeNodes.forEach((node) => ensureBlipState(node.id));
  }, [activeNodes, ensureBlipState]);

  useEffect(() => {
    const key = siphonedNodeIds.join(',');
    if (lastReportedSiphonsRef.current === key) return;
    lastReportedSiphonsRef.current = key;
    onSiphonedNodesChangeRef.current?.(siphonedNodeIds);
  }, [siphonedNodeIds]);

  useEffect(() => {
    if (!uniformSelectable) {
      uniformSelectAppliedRef.current = false;
      selectionGlowSV.value = 0;
      return;
    }
    if (uniformSelectAppliedRef.current) return;
    uniformSelectAppliedRef.current = true;
    applyUniformSelectableState();
  }, [uniformSelectable, applyUniformSelectableState, selectionGlowSV]);

  useEffect(() => {
    if (!uniformSelectable) {
      selectionGlowSV.value = 0;
      return;
    }
    selectionGlowSV.value = 0;
    selectionGlowSV.value = withTiming(1, {
      duration: SELECTION_GLOW_FADE_MS,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }, [uniformSelectable, selectionGlowSV]);

  useEffect(() => {
    if (!active) {
      sweepSessionActiveRef.current = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastFrameTsRef.current = null;
      ceaseStartRef.current = null;
      dischargePhaseRef.current = 'none';
      if (!sweepFinished) {
        setSweepDeg(0);
        sweepAngleRef.current = 0;
      }
      armedMapRef.current = {};
      return;
    }

    const isNewSweepSession = !sweepSessionActiveRef.current;
    sweepSessionActiveRef.current = true;

    if (isNewSweepSession) {
      setSweepFinished(false);
      setIsCeased(false);
      isCeasedRef.current = false;
      setSiphonedNodeIds([]);
      setSiphonPulseKeys({});
      sweepCompleteFiredRef.current = false;
      ceaseStartRef.current = null;
      dischargePhaseRef.current = 'none';
      sweepAngleRef.current = 0;
      lastFrameTsRef.current = null;
      armedMapRef.current = {};
      setRevealedIds(new Set());
      setFogOpacity(1);
      setPhosphorDischargeDisc(false);

      activeNodes.forEach((node) => {
        blipStatesRef.current[node.id] = {
          opacity: 0,
          scale: 1,
          bloomUntil: 0,
          decayStart: null,
          siphoned: false,
        };
      });
      bumpRender();
    }

    const frame = (timestamp: number) => {
      const lastTs = lastFrameTsRef.current ?? timestamp;
      const deltaMs = Math.min(32, timestamp - lastTs);
      lastFrameTsRef.current = timestamp;

      if (isCeasedRef.current && ceaseStartRef.current != null) {
        const ceaseElapsed = timestamp - ceaseStartRef.current;

        if (dischargePhaseRef.current === 'decel') {
          const decelT = Math.min(1, ceaseElapsed / CEASE_DECEL_MS);
          const speedScale = 1 - easeOutCubic(decelT);
          sweepAngleRef.current += baseSweepSpeedDegPerMs * deltaMs * speedScale;
          const beamDeg = sweepAngleRef.current % 360;
          setSweepDeg(beamDeg);
          evaluateSweepCollision(beamDeg);
          updateBlipDecays(timestamp);

          if (decelT >= 1) {
            dischargePhaseRef.current = 'fog';
            setPhosphorDischargeDisc(true);
          }
        } else if (dischargePhaseRef.current === 'fog') {
          const fogElapsed = ceaseElapsed - CEASE_DECEL_MS;
          const fogT = Math.min(1, fogElapsed / CEASE_FOG_MS);
          const fogEased = easeOutCubic(fogT);

          setFogOpacity(1 - fogEased);
          setSweepDeg(sweepAngleRef.current % 360);

          if (fogT >= 1) {
            dischargePhaseRef.current = 'done';
            finalizeCeaseScan();
            return;
          }
        } else {
          return;
        }

        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      sweepAngleRef.current += baseSweepSpeedDegPerMs * deltaMs;
      const beamDeg = sweepAngleRef.current % 360;
      setSweepDeg(beamDeg);
      evaluateSweepCollision(beamDeg);
      updateBlipDecays(timestamp);

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    active,
    activeNodes,
    evaluateSweepCollision,
    updateBlipDecays,
    finalizeCeaseScan,
    bumpRender,
    sweepFinished,
  ]);


  const handleTargetPress = (nodeId: string) => {
    if (uniformSelectable) {
      queueMicrotask(() => onSelectNodeRef.current?.(nodeId));
      return;
    }
    if (scanInteractive) {
      triggerSiphonExtract(nodeId);
    }
  };

  const getBlipOpacity = (nodeId: string): number => {
    if (uniformSelectable) return 1;
    const state = blipStatesRef.current[nodeId];
    if (!state) return 0;
    if (state.siphoned) return 1;
    return state.opacity;
  };

  const getBlipScale = (nodeId: string): number => {
    if (uniformSelectable) return 1;
    const state = blipStatesRef.current[nodeId];
    if (!state) return 1;
    if (state.siphoned) return 1;
    return state.scale;
  };

  void renderTick;

  const useDashedOuter = theme.borderStyle === 'dashed';
  const showSweep = active && !uniformSelectable;
  const shellHeight = getScannerShellHeight(scannerSize);
  const showCeaseControl = active && !contactsLocked && !uniformSelectable;
  const canCeaseScan = siphonedNodeIds.length >= MIN_SIPHONS_TO_CEASE;

  return (
    <View style={[styles.layoutShell, { width: scannerSize, height: shellHeight }]}>
      <View style={[styles.scannerFrame, { width: scannerSize, height: scannerSize }]}>
        <Canvas style={{ width: scannerSize, height: scannerSize }}>
          <Rect x={0} y={0} width={scannerSize} height={scannerSize} color={RADAR_CANVAS_BACKDROP} />

          <Circle
            cx={radarCenter}
            cy={radarCenter}
            r={sweepRadius}
            color={structuralStroke}
            style="stroke"
            strokeWidth={STROKE_THIN}
          >
            {useDashedOuter ? <DashPathEffect intervals={[6, 5]} /> : null}
          </Circle>

          <Circle
            cx={radarCenter}
            cy={radarCenter}
            r={midRingRadius}
            color={structuralStroke}
            style="stroke"
            strokeWidth={STROKE_THIN}
          />

          <Circle
            cx={radarCenter}
            cy={radarCenter}
            r={coreRadius}
            color={structuralStroke}
            style="stroke"
            strokeWidth={STROKE_THIN}
          />

          <Line
            p1={vec(radarCenter, 0)}
            p2={vec(radarCenter, scannerSize)}
            color={structuralStroke}
            strokeWidth={STROKE_THIN}
          />
          <Line
            p1={vec(0, radarCenter)}
            p2={vec(scannerSize, radarCenter)}
            color={structuralStroke}
            strokeWidth={STROKE_THIN}
          />
          <Line
            p1={vec(radarCenter - sweepRadius * 0.7, radarCenter - sweepRadius * 0.7)}
            p2={vec(radarCenter + sweepRadius * 0.7, radarCenter + sweepRadius * 0.7)}
            color={structuralStroke}
            strokeWidth={STROKE_THIN}
          />
          <Line
            p1={vec(radarCenter - sweepRadius * 0.7, radarCenter + sweepRadius * 0.7)}
            p2={vec(radarCenter + sweepRadius * 0.7, radarCenter - sweepRadius * 0.7)}
            color={structuralStroke}
            strokeWidth={STROKE_THIN}
          />

          {showSweep && (
            <Group clip={radarClipPath} opacity={fogOpacity}>
              <Group origin={sweepPivot} transform={[{ rotate: sweepRotationRad }]}>
                <Circle cx={radarCenter} cy={radarCenter} r={sweepRadius} style="fill">
                  <SweepGradient
                    c={sweepPivot}
                    start={phosphorDischargeDisc ? 0 : SWEEP_GRADIENT_TRAIL_START_DEG}
                    end={SWEEP_GRADIENT_LEAD_DEG}
                    colors={
                      phosphorDischargeDisc
                        ? dischargeSweepGradientColors
                        : activeSweepGradientColors
                    }
                    positions={
                      phosphorDischargeDisc
                        ? dischargeSweepGradientPositions
                        : activeSweepGradientPositions
                    }
                    mode="clamp"
                  />
                </Circle>
                <Line
                  p1={sweepPivot}
                  p2={vec(radarCenter + sweepRadius, radarCenter)}
                  color={sweepLeadColor}
                  strokeWidth={2}
                  opacity={1}
                />
              </Group>
            </Group>
          )}

          {uniformSelectable
            ? nodeBearings.map((node) => (
                <Group key={`${node.id}-glow`}>
                  <Circle
                    cx={node.canvasX}
                    cy={node.canvasY}
                    r={node.visualRadius * SELECTION_GLOW_OUTER_SCALE}
                    color={accentWithAlpha(selectionAccent, 0.7)}
                    opacity={selectionGlowOuterOpacity}
                    style="fill"
                  >
                    <Blur blur={18} />
                  </Circle>
                  <Circle
                    cx={node.canvasX}
                    cy={node.canvasY}
                    r={node.visualRadius * SELECTION_GLOW_INNER_SCALE}
                    color={accentWithAlpha(selectionAccent, 0.9)}
                    opacity={selectionGlowInnerOpacity}
                    style="fill"
                  >
                    <Blur blur={11} />
                  </Circle>
                </Group>
              ))
            : null}

          {nodeBearings.map((node) => {
            const opacity = getBlipOpacity(node.id);
            const scale = getBlipScale(node.id);
            if (opacity <= 0.01 && !uniformSelectable) return null;

            return (
              <Circle
                key={node.id}
                cx={node.canvasX}
                cy={node.canvasY}
                r={node.visualRadius * scale}
                color={uniformSelectable ? selectionAccent : theme.blipAccent}
                opacity={opacity}
                style="fill"
              />
            );
          })}

          {nodeBearings.map((node) => {
            const opacity = getBlipOpacity(node.id);
            if (opacity <= 0.01 && !uniformSelectable) return null;
            const scale = getBlipScale(node.id);
            return (
              <Circle
                key={`${node.id}-ring`}
                cx={node.canvasX}
                cy={node.canvasY}
                r={node.visualRadius * scale + (uniformSelectable ? 2.5 : 1.5)}
                color={uniformSelectable ? selectionAccent : theme.text}
                style="stroke"
                strokeWidth={uniformSelectable ? 2 : 1}
                opacity={uniformSelectable ? selectionGlowRingOpacity : opacity * 0.9}
              />
            );
          })}
        </Canvas>

        {nodeBearings.map((bearing) => (
          <RadarTarget
            key={`target-${bearing.id}`}
            visualSize={bearing.visualSize}
            left={bearing.canvasX - DOT_HIT_SIZE / 2}
            top={bearing.canvasY - DOT_HIT_SIZE / 2}
            disabled={!scanInteractive && !uniformSelectable}
            pulseKey={uniformSelectable ? 0 : (siphonPulseKeys[bearing.id] ?? 0)}
            onPress={() => handleTargetPress(bearing.id)}
            ringColor={selectionAccent}
          />
        ))}

        {children ? <View style={styles.childOverlay}>{children}</View> : null}

        <Text style={[styles.telemetryOverlay, { color: theme.text }]}></Text>
      </View>

      <View style={[styles.footerSlot, { width: scannerSize, height: SCANNER_CEASE_SLOT_HEIGHT }]}>
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={!showCeaseControl || !scanInteractive || !canCeaseScan}
          onPress={handleCeaseScan}
          style={[
            styles.ceaseButton,
            {
              borderColor: theme.line,
              opacity: showCeaseControl && scanInteractive ? (canCeaseScan ? 1 : 0.38) : 0,
            },
          ]}
          pointerEvents={showCeaseControl && scanInteractive ? 'auto' : 'none'}
        >
          <Text style={[styles.ceaseLabel, { color: theme.text }]}>
            {canCeaseScan
              ? '[ CEASE SCAN ]'
              : '[ SELECT NODE TO CEASE ]'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default memo(VectorScannerComponent);

const styles = StyleSheet.create({
  layoutShell: {
    alignSelf: 'center',
    flexShrink: 0,
  },
  scannerFrame: {
    position: 'relative',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  footerSlot: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 0,
  },
  nodeHitbox: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siphonPulseRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  childOverlay: { ...StyleSheet.absoluteFillObject },
  telemetryOverlay: {
    position: 'absolute',
    top: 6,
    right: 8,
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.6,
    opacity: 0.88,
  },
  ceaseButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  ceaseLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 0.8,
  },
});
