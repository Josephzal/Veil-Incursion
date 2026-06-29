import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { USE_NATIVE_DRIVER } from '../utils/platformMotion';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import ScannerCornerBrackets from './scanner/ScannerCornerBrackets';
import { useVectorScannerEngine } from './scanner/useVectorScannerEngine';
import {
  DOT_HIT_SIZE,
  HOSTILE_PATROL_COLOR,
  RADAR_CANVAS_BACKDROP,
  SCANNER_CEASE_SLOT_HEIGHT,
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
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: SIPHON_EXTRACT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
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

/** Angular wedge segments approximating native SweepGradient (transparent trail → bright leading edge). */
function buildSweepGradientSegments(
  cx: number,
  cy: number,
  radius: number,
  trailDeg: number,
  color: string,
  positions: readonly number[],
  alphas: readonly number[],
  segments = 48,
): Array<{ d: string; fill: string }> {
  const result: Array<{ d: string; fill: string }> = [];
  for (let i = 0; i < segments; i += 1) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const alpha = lerpGradientStops(positions, alphas, (t0 + t1) / 2);
    if (alpha < 0.004) continue;

    const deg0 = 360 - trailDeg + t0 * trailDeg;
    const deg1 = 360 - trailDeg + t1 * trailDeg;
    const rad0 = (deg0 * Math.PI) / 180;
    const rad1 = (deg1 * Math.PI) / 180;
    const x0 = cx + radius * Math.cos(rad0);
    const y0 = cy + radius * Math.sin(rad0);
    const x1 = cx + radius * Math.cos(rad1);
    const y1 = cy + radius * Math.sin(rad1);
    const span = deg1 - deg0;
    const largeArc = span > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
    result.push({ d, fill: accentWithAlpha(color, alpha) });
  }
  return result;
}

const ACTIVE_SWEEP_POSITIONS = [0, 0.38, 0.68, 1] as const;
const ACTIVE_SWEEP_ALPHAS = [0, 0, 0.1, 0.45] as const;
const DISCHARGE_SWEEP_POSITIONS = [0, 0.2, 0.45, 0.7, 1] as const;
const DISCHARGE_SWEEP_ALPHAS = [0, 0.04, 0.1, 0.08, 0] as const;

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
    structuralStroke,
    scopeGeometry,
    sweepRotationRad,
    fogOpacity,
    phosphorDischargeDisc,
    siphonedNodeIds,
    siphonPulseKeys,
    uniformSelectable,
    selectionAccent,
    scanInteractive,
    nodeBearings,
    sweepLeadColor,
    useDashedOuter,
    showSweep,
    showCeaseControl,
    canCeaseScan,
    blipStatesRef,
    handleTargetPress,
    isTargetEnabled,
    getBlipOpacity,
    getBlipScale,
    handleCeaseScan,
  } = engine;

  const shellHeight = getScannerShellHeight(scannerSize, !continuousScan);
  const clipId = `radar-clip-${scannerSize}`;
  const sweepTrailDeg = phosphorDischargeDisc ? 360 : SWEEP_TRAIL_ACTIVE_DEG;
  const sweepSegments = useMemo(
    () => buildSweepGradientSegments(
      radarCenter,
      radarCenter,
      sweepRadius,
      sweepTrailDeg,
      sweepLeadColor,
      phosphorDischargeDisc ? DISCHARGE_SWEEP_POSITIONS : ACTIVE_SWEEP_POSITIONS,
      phosphorDischargeDisc ? DISCHARGE_SWEEP_ALPHAS : ACTIVE_SWEEP_ALPHAS,
    ),
    [phosphorDischargeDisc, radarCenter, sweepLeadColor, sweepRadius, sweepTrailDeg],
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
          </Defs>

          <Rect
            x={0}
            y={0}
            width={scannerSize}
            height={scannerSize}
            fill={RADAR_CANVAS_BACKDROP}
          />

          <G clipPath={`url(#${clipId})`}>
            {scopeGeometry.arcs.map((arc, index) => (
              <G
                key={`scope-arc-${index}`}
                transform={`rotate(${arc.rotationDeg ?? 0}, ${radarCenter}, ${radarCenter})`}
              >
                <Ellipse
                  cx={arc.cx}
                  cy={arc.cy}
                  rx={arc.rx}
                  ry={arc.ry}
                  stroke={structuralStroke}
                  strokeWidth={STROKE_THIN}
                  opacity={arc.opacity}
                  fill="none"
                />
              </G>
            ))}

            {scopeGeometry.lines.map((line, index) => (
              <Line
                key={`scope-line-${index}`}
                x1={line.p1.x}
                y1={line.p1.y}
                x2={line.p2.x}
                y2={line.p2.y}
                stroke={structuralStroke}
                strokeWidth={line.strokeWidth ?? STROKE_THIN}
                opacity={line.opacity}
              />
            ))}

            {scopeGeometry.ticks.map((tick, index) => (
              <Line
                key={`scope-tick-${index}`}
                x1={tick.p1.x}
                y1={tick.p1.y}
                x2={tick.p2.x}
                y2={tick.p2.y}
                stroke={accentWithAlpha(theme.primary, 0.55)}
                strokeWidth={tick.strokeWidth ?? STROKE_THIN}
                opacity={tick.opacity}
              />
            ))}
          </G>

          <Circle
            cx={radarCenter}
            cy={radarCenter}
            r={sweepRadius}
            stroke={structuralStroke}
            strokeWidth={STROKE_THIN}
            fill="none"
            strokeDasharray={useDashedOuter ? '6 5' : undefined}
          />

          {showSweep ? (
            <G clipPath={`url(#${clipId})`} opacity={fogOpacity}>
              <G
                transform={`rotate(${sweepRotationDeg}, ${radarCenter}, ${radarCenter})`}
              >
                {sweepSegments.map((segment, index) => (
                  <Path key={`sweep-seg-${index}`} d={segment.d} fill={segment.fill} />
                ))}
                <Line
                  x1={radarCenter}
                  y1={radarCenter}
                  x2={radarCenter + sweepRadius}
                  y2={radarCenter}
                  stroke={sweepLeadColor}
                  strokeWidth={2}
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
            const scale = getBlipScale(node.id);
            if (opacity <= 0.01 && !uniformSelectable) return null;

            const isSelected = continuousScan && selectedNodeId === node.id;
            const isSiphoned = siphonedNodeIds.includes(node.id)
              || blipStatesRef.current[node.id]?.siphoned === true;
            const fillColor = resolveBlipAccent(node.node, {
              selected: isSelected,
              siphoned: isSiphoned,
              typeColored: typeColoredNodeIds?.has(node.id) ?? false,
              isHostilePatrol: node.isHostilePatrol,
              uniformSelectable,
              selectionAccent,
              defaultAccent: theme.blipAccent,
            });

            return (
              <G key={node.id}>
                {node.isHostilePatrol ? (
                  <Circle
                    cx={node.canvasX}
                    cy={node.canvasY}
                    r={node.visualRadius * scale * 2.1}
                    fill={accentWithAlpha(HOSTILE_PATROL_COLOR, 0.22)}
                  />
                ) : null}
                <Circle
                  cx={node.canvasX}
                  cy={node.canvasY}
                  r={node.visualRadius * scale}
                  fill={fillColor}
                  opacity={opacity}
                />
              </G>
            );
          })}

          {nodeBearings.map((node) => {
            const opacity = getBlipOpacity(node.id);
            if (opacity <= 0.01 && !uniformSelectable) return null;
            const scale = getBlipScale(node.id);
            const isSelected = continuousScan && selectedNodeId === node.id;
            const isSiphoned = siphonedNodeIds.includes(node.id)
              || blipStatesRef.current[node.id]?.siphoned === true;
            const ringColor = resolveBlipAccent(node.node, {
              selected: isSelected,
              siphoned: isSiphoned,
              typeColored: typeColoredNodeIds?.has(node.id) ?? false,
              isHostilePatrol: node.isHostilePatrol,
              uniformSelectable,
              selectionAccent,
              defaultAccent: uniformSelectable || isSelected ? selectionAccent : theme.text,
            });
            const ringOpacity = node.isHostilePatrol
              ? 0.95
              : uniformSelectable || isSelected
                ? 0.85
                : opacity * 0.9;

            return (
              <Circle
                key={`${node.id}-ring`}
                cx={node.canvasX}
                cy={node.canvasY}
                r={node.visualRadius * scale + (uniformSelectable || isSelected ? 2.5 : 1.5)}
                stroke={ringColor}
                strokeWidth={node.isHostilePatrol ? 2 : isSelected ? 3 : uniformSelectable ? 2 : 1}
                fill="none"
                opacity={ringOpacity}
              />
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
              />
            );
          })}

        {children ? <View style={styles.childOverlay}>{children}</View> : null}

        <ScannerCornerBrackets color={accentWithAlpha(theme.primary, 0.75)} />
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
  childOverlay: { ...StyleSheet.absoluteFillObject },
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
