import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { CATACLYSM_SIGIL_DURATION_MS } from '../../data/combatMasteryEngine';
import { COMBAT_MINIGAME_GREEN as GREEN } from '../../constants/combatMinigameTheme';

type SigilPattern = 'triangle' | 'line' | 'zigzag';

const CANVAS_W = 300;
const CANVAS_H = 240;
const HIT_RADIUS = 28;
const FINAL_NODE_HIT_RADIUS = 36;
const NODE_EXIT_PADDING = 10;
const FINAL_NODE_GRACE_MS = 1400;

const PATTERNS: Record<SigilPattern, { id: SigilPattern; points: { x: number; y: number }[]; order: number[] }> = {
  triangle: {
    id: 'triangle',
    points: [{ x: 150, y: 40 }, { x: 60, y: 200 }, { x: 240, y: 200 }],
    order: [0, 1, 2],
  },
  line: {
    id: 'line',
    points: [{ x: 50, y: 120 }, { x: 150, y: 120 }, { x: 250, y: 120 }],
    order: [0, 1, 2],
  },
  zigzag: {
    id: 'zigzag',
    points: [{ x: 50, y: 60 }, { x: 150, y: 180 }, { x: 250, y: 60 }],
    order: [0, 1, 2],
  },
};

interface CataclysmSigilOverlayProps {
  visible: boolean;
  onResolve: (nodesCompleted: number) => void;
}

type PointerNativeEvent = {
  locationX?: number;
  locationY?: number;
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
  pointerId?: number;
};

function resolveCanvasPoint(
  evt: GestureResponderEvent,
  canvasEl: HTMLElement | null,
): { x: number; y: number } {
  const native = evt.nativeEvent as PointerNativeEvent;
  if (canvasEl?.getBoundingClientRect) {
    const rect = canvasEl.getBoundingClientRect();
    const clientX = native.clientX ?? native.pageX ?? 0;
    const clientY = native.clientY ?? native.pageY ?? 0;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }
  return {
    x: native.locationX ?? 0,
    y: native.locationY ?? 0,
  };
}

function CataclysmSigilOverlay({
  visible,
  onResolve,
}: CataclysmSigilOverlayProps): React.JSX.Element | null {
  const pattern = useMemo(
    () => PATTERNS[(['triangle', 'line', 'zigzag'] as SigilPattern[])[Math.floor(Math.random() * 3)]],
    [visible],
  );

  const [nodesLocked, setNodesLocked] = useState(0);
  const [awaitingTap, setAwaitingTap] = useState(true);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(CATACLYSM_SIGIL_DURATION_MS);

  const canvasRef = useRef<View>(null);
  const nodesLockedRef = useRef(0);
  const awaitingTapRef = useRef(true);
  const resolvedRef = useRef(false);
  const dragRafRef = useRef<number | null>(null);
  const pendingDragRef = useRef<{ x: number; y: number } | null>(null);
  const onResolveRef = useRef(onResolve);
  const graceDeadlineRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const exitedPreviousNodeRef = useRef(true);
  const lastLockedPointRef = useRef<{ x: number; y: number } | null>(null);
  onResolveRef.current = onResolve;

  const finish = (completed: number) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    onResolveRef.current(completed);
  };

  const resetSession = () => {
    resolvedRef.current = false;
    nodesLockedRef.current = 0;
    awaitingTapRef.current = true;
    draggingRef.current = false;
    graceDeadlineRef.current = null;
    exitedPreviousNodeRef.current = true;
    lastLockedPointRef.current = null;
    setNodesLocked(0);
    setAwaitingTap(true);
    setDragPoint(null);
    setTimeLeftMs(CATACLYSM_SIGIL_DURATION_MS);
    pendingDragRef.current = null;
    if (dragRafRef.current != null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  };

  useEffect(() => {
    if (!visible) {
      resetSession();
      return;
    }
    resetSession();
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (resolvedRef.current) {
        clearInterval(timer);
        return;
      }
      const now = Date.now();
      const baseRemaining = Math.max(0, CATACLYSM_SIGIL_DURATION_MS - (now - startedAt));
      const graceRemaining = graceDeadlineRef.current != null
        ? Math.max(0, graceDeadlineRef.current - now)
        : 0;
      const remaining = Math.max(baseRemaining, graceRemaining);
      setTimeLeftMs(remaining);

      const onFinalSegment = nodesLockedRef.current === pattern.order.length - 1;
      const canExtendGrace = onFinalSegment
        && (draggingRef.current || pendingDragRef.current != null);

      if (baseRemaining <= 0 && canExtendGrace && graceDeadlineRef.current == null) {
        graceDeadlineRef.current = now + FINAL_NODE_GRACE_MS;
        return;
      }

      if (remaining <= 0 && !canExtendGrace) {
        clearInterval(timer);
        finish(nodesLockedRef.current);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [visible, pattern.order.length]);

  const advanceToNode = (nextLocked: number, lockedPoint: { x: number; y: number }) => {
    nodesLockedRef.current = nextLocked;
    lastLockedPointRef.current = lockedPoint;
    exitedPreviousNodeRef.current = false;
    setNodesLocked(nextLocked);
    if (nextLocked >= pattern.order.length) {
      finish(nextLocked);
    }
  };

  const canAcceptNextNodeHit = (x: number, y: number): boolean => {
    if (nodesLockedRef.current === 0) return true;
    if (exitedPreviousNodeRef.current) return true;
    const lastPoint = lastLockedPointRef.current;
    if (!lastPoint) return true;
    const isFinalNode = nodesLockedRef.current === pattern.order.length - 1;
    const exitRadius = (isFinalNode ? FINAL_NODE_HIT_RADIUS : HIT_RADIUS) + NODE_EXIT_PADDING;
    const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
    if (dist > exitRadius) {
      exitedPreviousNodeRef.current = true;
      return true;
    }
    return false;
  };

  const tryHitNode = (x: number, y: number): boolean => {
    if (resolvedRef.current) return false;
    if (!canAcceptNextNodeHit(x, y)) return false;

    const targetIdx = pattern.order[nodesLockedRef.current];
    if (targetIdx == null) return false;
    const pt = pattern.points[targetIdx];
    const isFinalNode = nodesLockedRef.current === pattern.order.length - 1;
    const radius = isFinalNode ? FINAL_NODE_HIT_RADIUS : HIT_RADIUS;
    const dist = Math.hypot(x - pt.x, y - pt.y);
    if (dist > radius) return false;

    if (awaitingTapRef.current) {
      awaitingTapRef.current = false;
      setAwaitingTap(false);
    }
    advanceToNode(nodesLockedRef.current + 1, pt);
    return true;
  };

  const scheduleDragPoint = (x: number, y: number) => {
    pendingDragRef.current = { x, y };
    if (dragRafRef.current != null) return;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      setDragPoint(pendingDragRef.current);
    });
  };

  const handleCanvasPoint = (
    evt: GestureResponderEvent,
    phase: 'down' | 'move' | 'up',
  ) => {
    if (resolvedRef.current && phase !== 'up') return;

    const canvasEl = canvasRef.current as unknown as HTMLElement | null;
    const { x, y } = resolveCanvasPoint(evt, canvasEl);

    if (phase === 'down') {
      if (awaitingTapRef.current) {
        const hit = tryHitNode(x, y);
        if (hit) draggingRef.current = true;
        return;
      }
      draggingRef.current = true;
      scheduleDragPoint(x, y);
      tryHitNode(x, y);
      return;
    }

    if (phase === 'move') {
      if (!draggingRef.current || awaitingTapRef.current || resolvedRef.current) return;
      scheduleDragPoint(x, y);
      canAcceptNextNodeHit(x, y);
      tryHitNode(x, y);
      return;
    }

    draggingRef.current = false;
    setDragPoint(null);
    pendingDragRef.current = null;
  };

  const onCanvasPointerDown = (evt: GestureResponderEvent) => {
    const target = evt.currentTarget as unknown as HTMLElement | null;
    target?.setPointerCapture?.(evt.nativeEvent.pointerId ?? 1);
    handleCanvasPoint(evt, 'down');
  };

  const onCanvasPointerMove = (evt: GestureResponderEvent) => {
    if (!draggingRef.current) return;
    handleCanvasPoint(evt, 'move');
  };

  const onCanvasPointerEnd = (evt?: GestureResponderEvent) => {
    if (evt) {
      const target = evt.currentTarget as unknown as HTMLElement | null;
      target?.releasePointerCapture?.(evt.nativeEvent.pointerId ?? 1);
    }
    if (evt) {
      handleCanvasPoint(evt, 'up');
    } else {
      draggingRef.current = false;
      setDragPoint(null);
      pendingDragRef.current = null;
    }
  };

  if (!visible) return null;

  const targetPointIdx = nodesLocked < pattern.order.length ? pattern.order[nodesLocked] : null;
  const lastLockedIdx = nodesLocked > 0 ? pattern.order[nodesLocked - 1] : null;
  const lastLockedPt = lastLockedIdx != null ? pattern.points[lastLockedIdx] : null;
  const timerPct = timeLeftMs / (CATACLYSM_SIGIL_DURATION_MS + FINAL_NODE_GRACE_MS);

  const committedSegments = pattern.order.slice(1, nodesLocked).map((idx, i) => {
    const from = pattern.points[pattern.order[i]];
    const to = pattern.points[idx];
    return { key: `seg-${i}`, from, to };
  });

  const damageLabel = nodesLocked >= 3 ? '100%' : nodesLocked === 2 ? '60%' : nodesLocked === 1 ? '30%' : '0%';

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <Text style={styles.title}>[ CATACLYSM SIGIL // TRACE PATTERN ]</Text>
        <Text style={styles.sub}>
          {awaitingTap
            ? 'Click the highlighted node to begin.'
            : 'Click and drag through each node in order — keep mouse held.'}
        </Text>
        <View style={styles.timerTrack}>
          <View style={[styles.timerFill, { width: `${Math.min(1, timerPct) * 100}%` }]} />
        </View>
        <Text style={styles.timerLabel}>
          {`${(timeLeftMs / 1000).toFixed(1)}s — PAYLOAD ${damageLabel}`}
        </Text>
        <View
          ref={canvasRef}
          style={styles.canvasWrap}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerEnd}
          onPointerCancel={onCanvasPointerEnd}
          onPointerLeave={(evt) => {
            if (draggingRef.current) return;
            onCanvasPointerEnd(evt);
          }}
        >
          <Svg width={CANVAS_W} height={CANVAS_H} pointerEvents="none">
            {committedSegments.map(({ key, from, to }) => (
              <Line
                key={key}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={GREEN.active}
                strokeWidth={3.5}
              />
            ))}
            {dragPoint && lastLockedPt && nodesLocked > 0 && nodesLocked < pattern.order.length ? (
              <Line
                x1={lastLockedPt.x}
                y1={lastLockedPt.y}
                x2={dragPoint.x}
                y2={dragPoint.y}
                stroke={GREEN.ringSoft}
                strokeWidth={2.5}
                opacity={0.9}
              />
            ) : null}
            {pattern.points.map((pt, i) => {
              const orderPos = pattern.order.indexOf(i);
              const isCompleted = orderPos >= 0 && orderPos < nodesLocked;
              const isTarget = i === targetPointIdx;
              const isFinalTarget = isTarget && nodesLocked === pattern.order.length - 1;
              return (
                <Circle
                  key={`fill-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={isFinalTarget ? 13 : isTarget ? 11 : isCompleted ? 10 : 8}
                  fill={isCompleted ? GREEN.completed : isTarget ? GREEN.fillStrong : GREEN.idle}
                />
              );
            })}
            {pattern.points.map((pt, i) => {
              const orderPos = pattern.order.indexOf(i);
              const isCompleted = orderPos >= 0 && orderPos < nodesLocked;
              const isTarget = i === targetPointIdx;
              const isFinalTarget = isTarget && nodesLocked === pattern.order.length - 1;
              return (
                <Circle
                  key={`ring-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={isFinalTarget ? 18 : isTarget ? 15 : isCompleted ? 12 : 10}
                  fill="none"
                  stroke={isTarget ? GREEN.ring : isCompleted ? GREEN.completed : GREEN.ringSoft}
                  strokeWidth={isFinalTarget ? 3 : isTarget ? 2.5 : 1.5}
                  opacity={isTarget ? 1 : 0.55}
                />
              );
            })}
          </Svg>
        </View>
      </View>
    </View>
  );
}

export default memo(CataclysmSigilOverlay);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GREEN.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: GREEN.textBright,
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: '#94a3b8',
    marginBottom: 10,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  timerTrack: {
    width: CANVAS_W,
    height: 4,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  timerFill: {
    height: '100%',
    backgroundColor: GREEN.ring,
  },
  timerLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    color: GREEN.text,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  canvasWrap: {
    width: CANVAS_W,
    height: CANVAS_H,
    borderWidth: 1,
    borderColor: GREEN.panelBorder,
    backgroundColor: GREEN.panel,
    cursor: 'crosshair',
    touchAction: 'none',
  } as View['props']['style'],
});
