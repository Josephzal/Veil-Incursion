import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  Line,
  Path,
  Rect,
  Skia,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import { getCabalScannerTheme } from './scanner/cabalScannerThemes';
import type { ScannerCabal } from '../types/scanner';
import type { RadarDot } from '../types/run';

export const SCAN_SWEEP_MS = 2200;
export const SCAN_ROTATIONS = 3;
export const SCAN_DURATION_MS = SCAN_SWEEP_MS * SCAN_ROTATIONS;

const SWEEP_HIT_THRESHOLD_DEG = 3;
const SWEEP_ARM_HYSTERESIS_DEG = 8;
const PHOSPHOR_DECAY_MS = 1500;
const PHOSPHOR_IDLE_OPACITY = 0.05;
const BLOOM_SCALE = 1.3;
const BLOOM_SETTLE_MS = 140;
const DOT_HIT_SIZE = 44;
const DOT_VISUAL_SIZE = 12;
const BOSS_DOT_SIZE = 16;
/** Visual phosphor tail span behind the leading beam (degrees). */
const SWEEP_TRAIL_DEG = 180;
const STROKE_THIN = 1;
const STROKE_CORE = 2;

interface VectorScannerProps {
  cabal: ScannerCabal;
  scannerSize: number;
  active: boolean;
  activeNodes: RadarDot[];
  coreScale?: number;
  contactsLocked?: boolean;
  onSweepComplete?: () => void;
  onSelectNode?: (nodeId: string) => void;
  children?: React.ReactNode;
}

interface BlipRenderState {
  opacity: number;
  scale: number;
  bloomUntil: number;
  decayStart: number | null;
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

function VectorScannerComponent({
  cabal,
  scannerSize,
  active,
  activeNodes,
  coreScale = 0.48,
  contactsLocked = false,
  onSweepComplete,
  onSelectNode,
  children,
}: VectorScannerProps): React.JSX.Element {
  const theme = getCabalScannerTheme(cabal);
  const coreDiameter = scannerSize * coreScale;
  const coreOffset = (scannerSize - coreDiameter) / 2;
  const radarCenter = scannerSize / 2;
  const sweepRadius = scannerSize / 2;
  const midRingRadius = (scannerSize * 0.72) / 2;
  const coreRadius = coreDiameter / 2;

  const [sweepDeg, setSweepDeg] = useState(0);
  const [sweepFinished, setSweepFinished] = useState(false);
  const [renderTick, setRenderTick] = useState(0);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());

  const blipStatesRef = useRef<Record<string, BlipRenderState>>({});
  const armedMapRef = useRef<Record<string, boolean>>({});
  const sweepCompleteFiredRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const sweepStartRef = useRef<number | null>(null);

  const uniformSelectable = contactsLocked || sweepFinished;
  const selectionAccent = theme.blipAccent;

  const nodeBearings = useMemo(
    () =>
      activeNodes.map((node) => ({
        id: node.id,
        canvasX: node.x,
        canvasY: node.y,
        bearingDeg: polarAngleDeg(node.x, node.y, radarCenter, radarCenter),
        visualRadius: (node.isPreDiscovered ? BOSS_DOT_SIZE : DOT_VISUAL_SIZE) / 2,
      })),
    [activeNodes, radarCenter],
  );

  const radarClipPath = useMemo(() => {
    const path = Skia.Path.Make();
    path.addCircle(radarCenter, radarCenter, sweepRadius);
    return path;
  }, [radarCenter, sweepRadius]);

  const sweepLeadColor = theme.primary;
  const transparentAccent = accentWithAlpha(sweepLeadColor, 0);

  /** Fixed arc from 180° → 360° (3 o'clock); avoids 0/360 shader seam when group rotates. */
  const SWEEP_GRADIENT_START_DEG = 360 - SWEEP_TRAIL_DEG;
  const SWEEP_GRADIENT_END_DEG = 360;

  const sweepGradientColors = useMemo(
    () => [
      'transparent',
      transparentAccent,
      accentWithAlpha(sweepLeadColor, 0.28),
      sweepLeadColor,
    ],
    [sweepLeadColor, transparentAccent],
  );

  /** Tail hits 0 opacity by ~55% of arc; leading edge locked at 1.0 — no wrap at 0/360. */
  const sweepGradientPositions = useMemo(() => [0, 0.28, 0.58, 1], []);

  const staticSweepSectorPath = useMemo(() => {
    const path = Skia.Path.Make();
    const oval = Skia.XYWHRect(
      radarCenter - sweepRadius,
      radarCenter - sweepRadius,
      sweepRadius * 2,
      sweepRadius * 2,
    );
    const startRad = (SWEEP_GRADIENT_START_DEG * Math.PI) / 180;
    path.moveTo(radarCenter, radarCenter);
    path.lineTo(
      radarCenter + sweepRadius * Math.cos(startRad),
      radarCenter + sweepRadius * Math.sin(startRad),
    );
    path.addArc(oval, SWEEP_GRADIENT_START_DEG, SWEEP_TRAIL_DEG);
    path.close();
    return path;
  }, [radarCenter, sweepRadius]);

  const sweepRotationRad = (sweepDeg * Math.PI) / 180;

  const ensureBlipState = useCallback((id: string): BlipRenderState => {
    if (!blipStatesRef.current[id]) {
      blipStatesRef.current[id] = {
        opacity: 0,
        scale: 1,
        bloomUntil: 0,
        decayStart: null,
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
      blipStatesRef.current[node.id] = {
        opacity: 1,
        scale: 1,
        bloomUntil: now,
        decayStart: null,
      };
    });
    setRevealedIds(new Set(activeNodes.map((n) => n.id)));
    bumpRender();
  }, [activeNodes, bumpRender]);

  const triggerPhosphorStrike = useCallback(
    (nodeId: string) => {
      if (uniformSelectable) return;
      const now = performance.now();
      const state = ensureBlipState(nodeId);
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

  const evaluateSweepCollision = useCallback(
    (beamDeg: number) => {
      if (uniformSelectable) return;

      nodeBearings.forEach(({ id, bearingDeg }) => {
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
      let changed = false;

      Object.entries(blipStatesRef.current).forEach(([id, state]) => {
        if (uniformSelectable) return;

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
    if (!uniformSelectable) return;
    applyUniformSelectableState();
  }, [uniformSelectable, applyUniformSelectableState]);

  useEffect(() => {
    if (!active) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      sweepStartRef.current = null;
      if (!sweepFinished) {
        setSweepDeg(0);
      }
      armedMapRef.current = {};
      return;
    }

    setSweepFinished(false);
    sweepCompleteFiredRef.current = false;
    sweepStartRef.current = null;
    armedMapRef.current = {};
    setRevealedIds(new Set());

    activeNodes.forEach((node) => {
      blipStatesRef.current[node.id] = {
        opacity: 0,
        scale: 1,
        bloomUntil: 0,
        decayStart: null,
      };
    });
    bumpRender();

    const frame = (timestamp: number) => {
      if (sweepStartRef.current == null) {
        sweepStartRef.current = timestamp;
      }
      const elapsed = timestamp - sweepStartRef.current;
      const cycleDeg = ((elapsed % SCAN_SWEEP_MS) / SCAN_SWEEP_MS) * 360;
      setSweepDeg(cycleDeg);
      evaluateSweepCollision(cycleDeg);
      updateBlipDecays(timestamp);

      if (!sweepCompleteFiredRef.current && elapsed >= SCAN_DURATION_MS) {
        sweepCompleteFiredRef.current = true;
        setSweepFinished(true);
        applyUniformSelectableState();
        onSweepComplete?.();
        return;
      }

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
    onSweepComplete,
    applyUniformSelectableState,
    bumpRender,
    sweepFinished,
  ]);

  const telemetryLabel = active
    ? 'RESOLVING_SIGNAL_VECTOR...'
    : uniformSelectable
      ? 'VECTOR_LOCK_STABLE'
      : 'STANDBY_LISTEN_MODE';

  const canSelectNode = (nodeId: string): boolean =>
    uniformSelectable || revealedIds.has(nodeId);

  const getBlipOpacity = (nodeId: string): number => {
    if (uniformSelectable) return 1;
    return blipStatesRef.current[nodeId]?.opacity ?? 0;
  };

  const getBlipScale = (nodeId: string): number => {
    if (uniformSelectable) return 1;
    return blipStatesRef.current[nodeId]?.scale ?? 1;
  };

  void renderTick;

  const useDashedOuter = theme.borderStyle === 'dashed';

  return (
    <View style={[styles.root, { width: scannerSize, height: scannerSize }]}>
      <Canvas style={{ width: scannerSize, height: scannerSize }}>
        <Rect x={0} y={0} width={scannerSize} height={scannerSize} color={theme.backdrop} />

        <Group opacity={active ? 0.55 : 0.4}>
          <Circle
            cx={radarCenter}
            cy={radarCenter}
            r={sweepRadius}
            color={theme.primary}
            style="stroke"
            strokeWidth={STROKE_THIN}
          >
            {useDashedOuter ? <DashPathEffect intervals={[6, 5]} /> : null}
          </Circle>
        </Group>

        <Group opacity={active ? 0.45 : 0.35}>
          <Circle
            cx={radarCenter}
            cy={radarCenter}
            r={midRingRadius}
            color={theme.line}
            style="stroke"
            strokeWidth={STROKE_THIN}
          />
        </Group>

        <Circle
          cx={radarCenter}
          cy={radarCenter}
          r={coreRadius}
          color={theme.primary}
          style="stroke"
          strokeWidth={STROKE_CORE}
        />

        <Line
          p1={vec(radarCenter, 0)}
          p2={vec(radarCenter, scannerSize)}
          color={theme.line}
          strokeWidth={STROKE_THIN}
          opacity={0.35}
        />
        <Line
          p1={vec(0, radarCenter)}
          p2={vec(scannerSize, radarCenter)}
          color={theme.line}
          strokeWidth={STROKE_THIN}
          opacity={0.35}
        />
        <Line
          p1={vec(radarCenter - sweepRadius * 0.7, radarCenter - sweepRadius * 0.7)}
          p2={vec(radarCenter + sweepRadius * 0.7, radarCenter + sweepRadius * 0.7)}
          color={theme.line}
          strokeWidth={STROKE_THIN}
          opacity={0.22}
        />
        <Line
          p1={vec(radarCenter - sweepRadius * 0.7, radarCenter + sweepRadius * 0.7)}
          p2={vec(radarCenter + sweepRadius * 0.7, radarCenter - sweepRadius * 0.7)}
          color={theme.line}
          strokeWidth={STROKE_THIN}
          opacity={0.22}
        />

        {active && (
          <Group clip={radarClipPath}>
            <Group
              origin={vec(radarCenter, radarCenter)}
              transform={[{ rotate: sweepRotationRad }]}
            >
              <Path path={staticSweepSectorPath} style="fill">
                <SweepGradient
                  c={vec(radarCenter, radarCenter)}
                  start={SWEEP_GRADIENT_START_DEG}
                  end={SWEEP_GRADIENT_END_DEG}
                  colors={sweepGradientColors}
                  positions={sweepGradientPositions}
                  mode="clamp"
                />
              </Path>
              <Line
                p1={vec(radarCenter, radarCenter)}
                p2={vec(radarCenter + sweepRadius, radarCenter)}
                color={sweepLeadColor}
                strokeWidth={2}
                opacity={1}
              />
            </Group>
          </Group>
        )}

        {nodeBearings.map((node) => {
          const opacity = getBlipOpacity(node.id);
          const scale = getBlipScale(node.id);
          const radius = node.visualRadius * scale;
          if (opacity <= 0.01 && !uniformSelectable) return null;

          return (
            <Circle
              key={node.id}
              cx={node.canvasX}
              cy={node.canvasY}
              r={radius}
              color={uniformSelectable ? selectionAccent : theme.blipAccent}
              opacity={opacity}
              style="fill"
            />
          );
        })}

        {nodeBearings.map((node) => {
          const opacity = getBlipOpacity(node.id);
          if (opacity <= 0.01 && !uniformSelectable) return null;
          return (
            <Circle
              key={`${node.id}-ring`}
              cx={node.canvasX}
              cy={node.canvasY}
              r={node.visualRadius * getBlipScale(node.id) + 1.5}
              color={theme.text}
              style="stroke"
              strokeWidth={uniformSelectable ? 1.5 : 1}
              opacity={uniformSelectable ? 1 : opacity * 0.9}
            />
          );
        })}
      </Canvas>

      {activeNodes.map((node) => {
        const absoluteLeft = node.x - DOT_HIT_SIZE / 2;
        const absoluteTop = node.y - DOT_HIT_SIZE / 2;

        return (
          <TouchableOpacity
            key={`hit-${node.id}`}
            activeOpacity={0.85}
            disabled={!canSelectNode(node.id)}
            onPress={() => onSelectNode?.(node.id)}
            style={[
              styles.nodeHitbox,
              {
                left: absoluteLeft,
                top: absoluteTop,
                width: DOT_HIT_SIZE,
                height: DOT_HIT_SIZE,
              },
            ]}
          />
        );
      })}

      {children ? <View style={styles.childOverlay}>{children}</View> : null}

      <Text style={[styles.telemetryOverlay, { color: theme.text }]}>{telemetryLabel}</Text>
    </View>
  );
}

export default memo(VectorScannerComponent);

const styles = StyleSheet.create({
  root: { position: 'relative' },
  nodeHitbox: { position: 'absolute' },
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
});
