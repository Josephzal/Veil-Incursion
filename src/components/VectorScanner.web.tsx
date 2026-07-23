import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../utils/platformMotion';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  FeGaussianBlur,
  Filter,
  G,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import DiscoveryRipple from './scanner/DiscoveryRipple';
import ScannerCornerBrackets from './scanner/ScannerCornerBrackets';
import { arcSpanPath } from './scanner/scannerScopeGeometry';
import { publishSelectedContact } from './scanner/scannerSweepBridge';
import { useVectorScannerEngine } from './scanner/useVectorScannerEngine';
import { primaryScannerSignalAccent } from '../data/scannerSignalEngine';
import {
  CONTACT_CORE_RADIUS,
  CONTACT_CORE_RADIUS_SELECTED,
  CONTACT_GLOW_RADIUS,
  CONTACT_GLOW_RADIUS_SELECTED,
  DOT_HIT_SIZE,
  HOSTILE_PATROL_COLOR,
  SCANNER_CEASE_SLOT_HEIGHT,
  SCANNER_PHOSPHOR,
  SIPHON_EXTRACT_MS,
  SIPHON_RING_PEAK_SCALE,
  STROKE_THIN,
  SWEEP_TRAIL_ACTIVE_DEG,
  accentWithAlpha,
  getScannerShellHeight,
  resolveBlipAccent,
  type VectorScannerProps,
} from './scanner/vectorScannerShared';

export * from './scanner/vectorScannerShared';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RadarTargetProps {
  visualSize: number;
  left: number;
  top: number;
  disabled: boolean;
  pulseKey: number;
  onPress: () => void;
  ringColor: string;
  onHighlightChange?: (active: boolean) => void;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  return reduced;
}

/**
 * Selected contact — soft bright glow breath (intensity only; core size stays fixed).
 * Animated driver only — no React per-frame state. Static under reduced motion.
 */
function SelectedPipGlow({
  x,
  y,
  bloomR,
  coreR,
  color,
  coreOpacity,
}: {
  x: number;
  y: number;
  bloomR: number;
  coreR: number;
  color: string;
  coreOpacity: number;
}): React.JSX.Element {
  const pulse = useRef(new Animated.Value(0)).current;
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reduceMotion) return undefined;
    pulse.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, reduceMotion]);

  if (reduceMotion) {
    return (
      <G pointerEvents="none">
        <Circle
          cx={x}
          cy={y}
          r={bloomR}
          fill={color}
          opacity={0.48}
          filter="url(#signal-pip-glow)"
        />
        <Circle cx={x} cy={y} r={coreR} fill={color} opacity={coreOpacity} />
      </G>
    );
  }

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.36, 0.62],
  });

  return (
    <G pointerEvents="none">
      <AnimatedCircle
        cx={x}
        cy={y}
        r={bloomR}
        fill={color}
        opacity={glowOpacity}
        filter="url(#signal-pip-glow)"
      />
      <Circle cx={x} cy={y} r={coreR} fill={color} opacity={coreOpacity} />
    </G>
  );
}

function RadarTarget({
  visualSize,
  left,
  top,
  disabled,
  pulseKey,
  onPress,
  ringColor,
  onHighlightChange,
  accessibilityLabel,
}: RadarTargetProps & { accessibilityLabel?: string }): React.JSX.Element {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const reduceMotion = usePrefersReducedMotion();
  const highlightRef = useRef(false);

  const setHighlight = (active: boolean) => {
    if (highlightRef.current === active) return;
    highlightRef.current = active;
    onHighlightChange?.(active);
  };

  useEffect(() => {
    if (pulseKey === 0) return;
    if (reduceMotion) {
      scaleAnim.setValue(1);
      opacityAnim.setValue(0);
      return;
    }
    scaleAnim.setValue(1);
    opacityAnim.setValue(0.85);
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: SIPHON_RING_PEAK_SCALE,
        duration: SIPHON_EXTRACT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: SIPHON_EXTRACT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [pulseKey, scaleAnim, opacityAnim, reduceMotion]);

  useEffect(() => () => setHighlight(false), []);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Scan contact'}
      accessibilityState={{ disabled }}
      onFocus={() => setHighlight(true)}
      onBlur={() => setHighlight(false)}
      {...({
        onMouseEnter: () => setHighlight(true),
        onMouseLeave: () => setHighlight(false),
      } as object)}
      style={[
        styles.nodeHitbox,
        { left, top, width: DOT_HIT_SIZE, height: DOT_HIT_SIZE },
        // Suppress browser-default outline; acquisition brackets carry focus/hover.
        { outlineStyle: 'none', outlineWidth: 0 } as object,
      ]}
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

function lerpGradientStops(
  positions: readonly number[],
  alphas: readonly number[],
  t: number,
): number {
  if (t <= positions[0]) return alphas[0];
  if (t >= positions[positions.length - 1]) return alphas[alphas.length - 1];
  for (let i = 0; i < positions.length - 1; i += 1) {
    if (t >= positions[i] && t <= positions[i + 1]) {
      const span = positions[i + 1] - positions[i];
      if (span <= 0) return alphas[i];
      const u = (t - positions[i]) / span;
      return alphas[i] + u * (alphas[i + 1] - alphas[i]);
    }
  }
  return 0;
}

/** Pie-wedge path from scanner center to outer arc — apex must reach the hub. */
function sweepWedgePath(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
): string {
  const rad0 = (startDeg * Math.PI) / 180;
  const rad1 = (endDeg * Math.PI) / 180;
  const x0 = cx + radius * Math.cos(rad0);
  const y0 = cy + radius * Math.sin(rad0);
  const x1 = cx + radius * Math.cos(rad1);
  const y1 = cy + radius * Math.sin(rad1);
  let span = endDeg - startDeg;
  while (span < 0) span += 360;
  while (span >= 360) span -= 360;
  const largeArc = span > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

/**
 * Classic radar phosphor decay: t=0 at trail end (invisible) → t=1 at lead (peak).
 * Power ease keeps a long soft tail without banded steps.
 */
function radarWakeAlpha(t: number, peak: number, power: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return peak;
  return peak * t ** power;
}

/** Angular wake segments — soft fill only; leading edge drawn separately. */
function buildSweepGradientSegments(
  cx: number,
  cy: number,
  radius: number,
  trailDeg: number,
  color: string,
  fade: { peak: number; power: number } | { positions: readonly number[]; alphas: readonly number[] },
  segments = 96,
): Array<{ d: string; fill: string }> {
  const result: Array<{ d: string; fill: string }> = [];
  // Match lead stroke radius so the wake meets the scan line tip and hub.
  const fillR = radius;
  for (let i = 0; i < segments; i += 1) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const mid = (t0 + t1) / 2;
    const alpha = 'peak' in fade
      ? radarWakeAlpha(mid, fade.peak, fade.power)
      : lerpGradientStops(fade.positions, fade.alphas, mid);
    if (alpha < 0.002) continue;

    const deg0 = 360 - trailDeg + t0 * trailDeg;
    const deg1 = 360 - trailDeg + t1 * trailDeg;
    result.push({
      d: sweepWedgePath(cx, cy, fillR, deg0, deg1),
      fill: accentWithAlpha(color, alpha),
    });
  }
  return result;
}

/**
 * Soft feathered wake (~58°) — lead edge is a separate crisp stroke.
 * Wedge paths always apex at the scanner center (no inner cutout).
 */
/** Soft radar wake — lead stroke remains the crisp beam. */
const ACTIVE_SWEEP_FADE = { peak: 0.14, power: 2.25 } as const;
const DISCHARGE_SWEEP_FADE = {
  positions: [0, 0.25, 0.5, 0.75, 1] as const,
  alphas: [0, 0.015, 0.04, 0.03, 0] as const,
};
const CALIBRATION_STROKE = '#5A6E68';

function VectorScannerWebComponent({
  scannerSize,
  continuousScan = false,
  selectedNodeId = null,
  typeColoredNodeIds,
  proximityGhost = null,
  children,
  ...engineProps
}: VectorScannerProps): React.JSX.Element {
  const engine = useVectorScannerEngine({
    scannerSize,
    continuousScan,
    selectedNodeId,
    typeColoredNodeIds,
    proximityGhost,
    ...engineProps,
  });

  const {
    theme,
    radarCenter,
    sweepRadius,
    scopeGeometry,
    sweepRotationRad,
    fogOpacity,
    phosphorDischargeDisc,
    siphonedNodeIds,
    siphonPulseKeys,
    discoveryPulseKeys,
    uniformSelectable,
    selectionAccent,
    scanInteractive,
    nodeBearings,
    sweepLeadColor,
    showSweep,
    showCeaseControl,
    canCeaseScan,
    blipStatesRef,
    handleTargetPress,
    isTargetEnabled,
    getBlipOpacity,
    handleCeaseScan,
  } = engine;

  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!continuousScan || !selectedNodeId) {
      publishSelectedContact({ canvasX: 0, canvasY: 0, has: false });
      return;
    }
    const selected = nodeBearings.find((n) => n.id === selectedNodeId);
    if (!selected || getBlipOpacity(selected.id) <= 0.01) {
      publishSelectedContact({ canvasX: 0, canvasY: 0, has: false });
      return;
    }
    publishSelectedContact({
      canvasX: selected.canvasX,
      canvasY: selected.canvasY,
      has: true,
      strength: 1,
    });
  }, [continuousScan, selectedNodeId, nodeBearings, getBlipOpacity, scannerSize]);

  const shellHeight = getScannerShellHeight(scannerSize, !continuousScan);
  const clipId = `radar-clip-${scannerSize}`;
  const sweepTrailDeg = phosphorDischargeDisc ? 360 : SWEEP_TRAIL_ACTIVE_DEG;
  // Visual phosphor only — discovery timing still uses engine sweep angle.
  const phosphorSweepColor = continuousScan ? SCANNER_PHOSPHOR : sweepLeadColor;
  const sweepSegments = useMemo(
    () => buildSweepGradientSegments(
      radarCenter,
      radarCenter,
      sweepRadius,
      sweepTrailDeg,
      phosphorSweepColor,
      phosphorDischargeDisc ? DISCHARGE_SWEEP_FADE : ACTIVE_SWEEP_FADE,
    ),
    [phosphorDischargeDisc, phosphorSweepColor, radarCenter, sweepRadius, sweepTrailDeg],
  );
  const sweepRotationDeg = (sweepRotationRad * 180) / Math.PI;

  return (
    <View style={[styles.layoutShell, { width: scannerSize, height: shellHeight }]}>
      <View style={[styles.scannerFrame, { width: scannerSize, height: scannerSize }]}>
        <Svg width={scannerSize} height={scannerSize}>
          <Defs>
            <ClipPath id={clipId}>
              <Circle cx={radarCenter} cy={radarCenter} r={sweepRadius} />
            </ClipPath>
            <RadialGradient
              id={`aperture-well-${scannerSize}`}
              cx={String(radarCenter)}
              cy={String(radarCenter)}
              rx={String(sweepRadius)}
              ry={String(sweepRadius)}
              fx={String(radarCenter)}
              fy={String(radarCenter)}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0%" stopColor="#040A0C" stopOpacity={0.36} />
              <Stop offset="55%" stopColor="#03080A" stopOpacity={0.42} />
              <Stop offset="100%" stopColor="#020608" stopOpacity={0.5} />
            </RadialGradient>
            <Filter id="signal-pip-glow" x="-80%" y="-80%" width="260%" height="260%">
              <FeGaussianBlur stdDeviation="3.6" />
            </Filter>
          </Defs>

          <Rect x={0} y={0} width={scannerSize} height={scannerSize} fill="transparent" />

          {/* Deep instrument well — Veil remains faintly visible underneath. */}
          <G clipPath={`url(#${clipId})`} pointerEvents="none" {...({ 'aria-hidden': true } as object)}>
            <Circle
              cx={radarCenter}
              cy={radarCenter}
              r={sweepRadius}
              fill={`url(#aperture-well-${scannerSize})`}
            />
          </G>

          {/* Outer radar rim — quiet so glowing returns stay primary */}
          <Circle
            cx={radarCenter}
            cy={radarCenter}
            r={sweepRadius * 0.995}
            stroke={accentWithAlpha(SCANNER_PHOSPHOR, 0.26)}
            strokeWidth={1.15}
            fill="none"
            pointerEvents="none"
          />

          <G
            clipPath={`url(#${clipId})`}
            pointerEvents="none"
            {...({ 'aria-hidden': true } as object)}
          >
            {scopeGeometry.arcs.map((arc, index) => {
              const r = (arc.rx + arc.ry) * 0.5;
              if (arc.spanDeg != null) {
                return (
                  <Path
                    key={`scope-arc-${index}`}
                    d={arcSpanPath(arc.cx, arc.cy, r, arc.rotationDeg ?? 0, arc.spanDeg)}
                    stroke={accentWithAlpha(CALIBRATION_STROKE, 0.72)}
                    strokeWidth={arc.strokeWidth ?? STROKE_THIN}
                    opacity={arc.opacity * 0.78}
                    fill="none"
                  />
                );
              }
              if (arc.openGapDeg != null && Math.abs(arc.rx - arc.ry) < 0.5) {
                const span = 360 - arc.openGapDeg;
                const start = (arc.rotationDeg ?? 0) + arc.openGapDeg / 2;
                return (
                  <Path
                    key={`scope-arc-${index}`}
                    d={arcSpanPath(arc.cx, arc.cy, r, start, span)}
                    stroke={accentWithAlpha(CALIBRATION_STROKE, 0.72)}
                    strokeWidth={arc.strokeWidth ?? STROKE_THIN}
                    opacity={arc.opacity * 0.78}
                    fill="none"
                  />
                );
              }
              return (
                <G
                  key={`scope-arc-${index}`}
                  transform={`rotate(${arc.rotationDeg ?? 0}, ${radarCenter}, ${radarCenter})`}
                >
                  <Ellipse
                    cx={arc.cx}
                    cy={arc.cy}
                    rx={arc.rx}
                    ry={arc.ry}
                    stroke={accentWithAlpha(CALIBRATION_STROKE, 0.68)}
                    strokeWidth={arc.strokeWidth ?? STROKE_THIN}
                    opacity={arc.opacity * 0.78}
                    fill="none"
                  />
                </G>
              );
            })}

            {scopeGeometry.lines.map((line, index) => (
              <Line
                key={`scope-line-${index}`}
                x1={line.p1.x}
                y1={line.p1.y}
                x2={line.p2.x}
                y2={line.p2.y}
                stroke={accentWithAlpha(CALIBRATION_STROKE, 0.75)}
                strokeWidth={line.strokeWidth ?? STROKE_THIN}
                opacity={line.opacity * 0.72}
              />
            ))}

            {scopeGeometry.ticks.map((tick, index) => (
              <Line
                key={`scope-tick-${index}`}
                x1={tick.p1.x}
                y1={tick.p1.y}
                x2={tick.p2.x}
                y2={tick.p2.y}
                stroke={accentWithAlpha(SCANNER_PHOSPHOR, 0.26)}
                strokeWidth={tick.strokeWidth ?? STROKE_THIN}
                opacity={tick.opacity * 0.75}
              />
            ))}
          </G>

          {/* Small center emitter */}
          <G opacity={0.7} pointerEvents="none" {...({ 'aria-hidden': true } as object)}>
            <Line
              x1={radarCenter - 4}
              y1={radarCenter}
              x2={radarCenter - 1.5}
              y2={radarCenter}
              stroke={SCANNER_PHOSPHOR}
              strokeWidth={1}
            />
            <Line
              x1={radarCenter + 1.5}
              y1={radarCenter}
              x2={radarCenter + 4}
              y2={radarCenter}
              stroke={SCANNER_PHOSPHOR}
              strokeWidth={1}
            />
            <Line
              x1={radarCenter}
              y1={radarCenter - 4}
              x2={radarCenter}
              y2={radarCenter - 1.5}
              stroke={SCANNER_PHOSPHOR}
              strokeWidth={1}
            />
            <Line
              x1={radarCenter}
              y1={radarCenter + 1.5}
              x2={radarCenter}
              y2={radarCenter + 4}
              stroke={SCANNER_PHOSPHOR}
              strokeWidth={1}
            />
            <Circle cx={radarCenter} cy={radarCenter} r={1.2} fill={accentWithAlpha(SCANNER_PHOSPHOR, 0.8)} />
          </G>

          {showSweep ? (
            <G clipPath={`url(#${clipId})`} opacity={fogOpacity} pointerEvents="none">
              <G transform={`rotate(${sweepRotationDeg}, ${radarCenter}, ${radarCenter})`}>
                {sweepSegments.map((segment, index) => (
                  <Path key={`sweep-seg-${index}`} d={segment.d} fill={segment.fill} />
                ))}
                <Line
                  x1={radarCenter}
                  y1={radarCenter}
                  x2={radarCenter + sweepRadius}
                  y2={radarCenter}
                  stroke={accentWithAlpha(SCANNER_PHOSPHOR, 0.95)}
                  strokeWidth={1.5}
                />
              </G>
            </G>
          ) : null}

          {proximityGhost ? (
            <G key="proximity-ghost">
              <Circle
                cx={proximityGhost.x}
                cy={proximityGhost.y}
                r={12 * 1.65}
                fill={accentWithAlpha(theme.blipAccent, 0.16)}
              />
              <Circle
                cx={proximityGhost.x}
                cy={proximityGhost.y}
                r={12 * 0.85}
                fill={accentWithAlpha(theme.blipAccent, 0.1)}
              />
            </G>
          ) : null}

          {nodeBearings.map((node) => {
            const opacity = getBlipOpacity(node.id);
            if (opacity <= 0.01 && !uniformSelectable) return null;

            const isSelected = continuousScan && selectedNodeId === node.id;
            const isHighlighted = !isSelected && highlightedNodeId === node.id;
            const isSiphoned = siphonedNodeIds.includes(node.id)
              || blipStatesRef.current[node.id]?.siphoned === true;
            const typeColored = typeColoredNodeIds?.has(node.id) ?? false;
            const fillColor = resolveBlipAccent(node.node, {
              selected: isSelected,
              siphoned: isSiphoned,
              typeColored,
              isHostilePatrol: node.isHostilePatrol,
              uniformSelectable,
              selectionAccent,
              defaultAccent: theme.blipAccent,
            });
            const signalAccent = isSiphoned
              ? primaryScannerSignalAccent(node.node.veilSignals)
              : null;
            const showCombat = node.isHostilePatrol
              || (typeColored && Boolean(node.node.nodeType?.includes('COMBAT')));
            const typed = typeColored || (isSelected && isSiphoned && Boolean(signalAccent));
            // One unified hue for core + glow (no tiered colors).
            const pipColor = showCombat
              ? HOSTILE_PATROL_COLOR
              : typed
                ? (signalAccent ?? fillColor)
                : (fillColor === theme.blipAccent ? SCANNER_PHOSPHOR : fillColor);
            const x = node.canvasX;
            const y = node.canvasY;
            const coreR = isSelected ? CONTACT_CORE_RADIUS_SELECTED : CONTACT_CORE_RADIUS;
            const glowR = isSelected ? CONTACT_GLOW_RADIUS_SELECTED : CONTACT_GLOW_RADIUS;
            const discoveryKey = discoveryPulseKeys[node.id] ?? 0;
            const lum = isSelected ? 1 : isHighlighted ? 0.82 : 0.58;
            const coreOpacity = isSelected ? 1 : isHighlighted ? 0.96 : 0.9;
            const bloomR = isSelected ? glowR * 0.72 : glowR * 0.62;

            return (
              <G key={node.id} opacity={opacity} pointerEvents="none">
                {discoveryKey > 0 ? (
                  <DiscoveryRipple x={x} y={y} pulseKey={discoveryKey} color={pipColor} />
                ) : null}
                {isSelected ? (
                  <SelectedPipGlow
                    x={x}
                    y={y}
                    bloomR={bloomR}
                    coreR={coreR}
                    color={pipColor}
                    coreOpacity={coreOpacity}
                  />
                ) : (
                  <>
                    <Circle
                      cx={x}
                      cy={y}
                      r={bloomR}
                      fill={pipColor}
                      opacity={0.38 * lum}
                      filter="url(#signal-pip-glow)"
                    />
                    <Circle
                      cx={x}
                      cy={y}
                      r={coreR}
                      fill={pipColor}
                      opacity={coreOpacity}
                    />
                  </>
                )}
              </G>
            );
          })}
        </Svg>

        {nodeBearings
          .filter((bearing) => !bearing.isHostilePatrol)
          .map((bearing) => {
            const isSelected = continuousScan && selectedNodeId === bearing.id;
            const isSiphoned = siphonedNodeIds.includes(bearing.id)
              || blipStatesRef.current[bearing.id]?.siphoned === true;
            const targetRingColor = resolveBlipAccent(bearing.node, {
              selected: isSelected,
              siphoned: isSiphoned,
              typeColored: typeColoredNodeIds?.has(bearing.id) ?? false,
              isHostilePatrol: false,
              uniformSelectable,
              selectionAccent,
              defaultAccent: selectionAccent,
            });
            return (
              <RadarTarget
                key={`target-${bearing.id}`}
                visualSize={bearing.visualSize}
                left={bearing.canvasX - DOT_HIT_SIZE / 2}
                top={bearing.canvasY - DOT_HIT_SIZE / 2}
                disabled={!isTargetEnabled(bearing.id)}
                pulseKey={uniformSelectable ? 0 : (siphonPulseKeys[bearing.id] ?? 0)}
                onPress={() => handleTargetPress(bearing.id)}
                ringColor={targetRingColor}
                onHighlightChange={(active) => {
                  setHighlightedNodeId((prev) => {
                    if (active) return bearing.id;
                    return prev === bearing.id ? null : prev;
                  });
                }}
                accessibilityLabel={
                  isSelected
                    ? `Selected scan contact ${bearing.id}`
                    : isSiphoned
                      ? `Discovered scan contact ${bearing.id}`
                      : `Scan contact ${bearing.id}`
                }
              />
            );
          })}

        {children ? <View style={styles.childOverlay}>{children}</View> : null}

        {/* Corner brackets reserved for legacy finite-scan modes — not the instrument shell. */}
        {!continuousScan ? (
          <ScannerCornerBrackets color={accentWithAlpha(SCANNER_PHOSPHOR, 0.45)} />
        ) : null}
      </View>

      <View
        style={[styles.footerSlot, { width: scannerSize, height: SCANNER_CEASE_SLOT_HEIGHT }]}
        pointerEvents={showCeaseControl && scanInteractive ? 'auto' : 'none'}
      >
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
        >
          <Text style={[styles.ceaseLabel, { color: theme.text }]}>
            {canCeaseScan ? '[ CEASE SCAN ]' : '[ SELECT NODE TO CEASE ]'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default memo(VectorScannerWebComponent);

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
  childOverlay: { ...StyleSheet.absoluteFill },
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
