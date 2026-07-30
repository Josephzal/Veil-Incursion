import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import {
  Easing as ReanimatedEasing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { playScannerLipKey, playUiClick } from '../../utils/uiFeedbackAudio';
import {
  buildDegreeTicks,
  buildNonEuclideanGrid,
} from './scannerScopeGeometry';
import {
  BLOOM_SCALE,
  BLOOM_SETTLE_MS,
  BOSS_DOT_SIZE,
  CEASE_DECEL_MS,
  CEASE_FOG_MS,
  DOT_VISUAL_SIZE,
  MIN_SIPHONS_TO_CEASE,
  PHOSPHOR_DECAY_MS,
  PHOSPHOR_IDLE_OPACITY,
  SCAN_SWEEP_MS,
  SELECTION_GLOW_FADE_MS,
  SIPHON_HAPTIC_MS,
  SIPHON_ILLUMINATE_MIN_OPACITY,
  STRUCTURAL_LINE_ALPHA,
  SWEEP_ARM_HYSTERESIS_DEG,
  SWEEP_HIT_THRESHOLD_DEG,
  accentWithAlpha,
  angularDifference,
  easeOutCubic,
  polarAngleDeg,
  resolveScannerTheme,
  type BlipRenderState,
  type NodeBearing,
  type VectorScannerProps,
} from './vectorScannerShared';
import { publishScannerSweepAngle } from './scannerSweepBridge';

export function useVectorScannerEngine({
  cabal,
  zoneTint,
  scannerSize,
  active,
  activeNodes,
  contactsLocked = false,
  continuousScan = false,
  selectedNodeId = null,
  onSweepComplete,
  onSelectNode,
  onSiphonedNodesChange,
}: VectorScannerProps) {
  const theme = resolveScannerTheme(cabal, zoneTint);
  const radarCenter = scannerSize / 2;
  const sweepRadius = scannerSize / 2;

  const structuralStroke = useMemo(
    () => accentWithAlpha(theme.primary, STRUCTURAL_LINE_ALPHA),
    [theme.primary],
  );

  const scopeGeometry = useMemo(
    () => ({
      ...buildNonEuclideanGrid(radarCenter, sweepRadius, STRUCTURAL_LINE_ALPHA),
      ticks: buildDegreeTicks(radarCenter, sweepRadius, STRUCTURAL_LINE_ALPHA),
    }),
    [radarCenter, sweepRadius],
  );

  const [sweepDeg, setSweepDeg] = useState(0);
  const [sweepFinished, setSweepFinished] = useState(false);
  const [isCeased, setIsCeased] = useState(false);
  const [siphonedNodeIds, setSiphonedNodeIds] = useState<string[]>([]);
  const [siphonPulseKeys, setSiphonPulseKeys] = useState<Record<string, number>>({});
  /** Presentation-only — fires when a contact is first illuminated by the sweep. */
  const [discoveryPulseKeys, setDiscoveryPulseKeys] = useState<Record<string, number>>({});
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

  const uniformSelectable = !continuousScan && (contactsLocked || sweepFinished);
  const selectionAccent = theme.blipAccent;
  const selectionGlowSV = useSharedValue(0);
  const selectionGlowInnerOpacity = useDerivedValue(() => selectionGlowSV.value * 0.45);
  const selectionGlowOuterOpacity = useDerivedValue(() => selectionGlowSV.value * 0.24);
  const selectionGlowRingOpacity = useDerivedValue(() => selectionGlowSV.value * 0.85);
  const scanInteractive =
    active && !contactsLocked && !uniformSelectable && !isCeased;

  const hostilePatrolIds = useMemo(
    () => new Set(activeNodes.filter((node) => node.isHostilePatrol).map((node) => node.id)),
    [activeNodes],
  );

  const nodeBearings = useMemo(
    (): NodeBearing[] =>
      activeNodes.map((node) => ({
        node,
        id: node.id,
        canvasX: node.x,
        canvasY: node.y,
        bearingDeg: polarAngleDeg(node.x, node.y, radarCenter, radarCenter),
        visualRadius: (node.isPreDiscovered ? BOSS_DOT_SIZE : DOT_VISUAL_SIZE) / 2,
        visualSize: node.isPreDiscovered ? BOSS_DOT_SIZE : DOT_VISUAL_SIZE,
        isHostilePatrol: node.isHostilePatrol === true,
      })),
    [activeNodes, radarCenter],
  );

  const activeNodesKey = useMemo(
    () => activeNodes.map((node) => node.id).join('\0'),
    [activeNodes],
  );
  const lastActiveNodesKeyRef = useRef('');

  const sweepLeadColor = theme.primary;
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
        queueMicrotask(() => {
          setDiscoveryPulseKeys((keys) => ({
            ...keys,
            [nodeId]: (keys[nodeId] ?? 0) + 1,
          }));
        });
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

  const notifyNodeSelected = useCallback((nodeId: string) => {
    Vibration.vibrate(SIPHON_HAPTIC_MS);
    playScannerLipKey();
    queueMicrotask(() => onSelectNodeRef.current?.(nodeId));
  }, []);

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

      setSiphonedNodeIds((prev) => (prev.includes(nodeId) ? prev : [...prev, nodeId]));
      setSiphonPulseKeys((prev) => ({ ...prev, [nodeId]: (prev[nodeId] ?? 0) + 1 }));
      Vibration.vibrate(SIPHON_HAPTIC_MS);
      playScannerLipKey();
    },
    [scanInteractive, siphonedNodeIds, isNodeIlluminated, ensureBlipState, bumpRender],
  );

  const handleCeaseScan = useCallback(() => {
    if (!active || contactsLocked || isCeasedRef.current) return;
    if (siphonedNodeIds.length < MIN_SIPHONS_TO_CEASE) return;
    playUiClick();
    isCeasedRef.current = true;
    setIsCeased(true);
    ceaseStartRef.current = performance.now();
    dischargePhaseRef.current = 'decel';
  }, [active, contactsLocked, siphonedNodeIds.length]);

  const evaluateSweepCollision = useCallback(
    (beamDeg: number) => {
      if (uniformSelectable || dischargePhaseRef.current === 'fog') return;

      nodeBearings.forEach(({ id, bearingDeg, isHostilePatrol }) => {
        if (isHostilePatrol) return;
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
    if (lastActiveNodesKeyRef.current === activeNodesKey) {
      activeNodes.forEach((node) => ensureBlipState(node.id));
      return;
    }
    lastActiveNodesKeyRef.current = activeNodesKey;

    armedMapRef.current = {};
    setRevealedIds(new Set());

    const validIds = new Set<string>();
    activeNodes.forEach((node) => {
      validIds.add(node.id);
      blipStatesRef.current[node.id] = {
        opacity: node.isHostilePatrol ? 1 : 0,
        scale: 1,
        bloomUntil: 0,
        decayStart: null,
        siphoned: false,
      };
    });

    for (const id of Object.keys(blipStatesRef.current)) {
      if (!validIds.has(id)) delete blipStatesRef.current[id];
    }

    bumpRender();
  }, [activeNodes, activeNodesKey, bumpRender, ensureBlipState]);

  useEffect(() => {
    const key = siphonedNodeIds.join(',');
    if (lastReportedSiphonsRef.current === key) return;
    lastReportedSiphonsRef.current = key;
    onSiphonedNodesChangeRef.current?.(siphonedNodeIds);
  }, [siphonedNodeIds]);

  useEffect(() => {
    if (!uniformSelectable) {
      uniformSelectAppliedRef.current = false;
      return;
    }
    if (uniformSelectAppliedRef.current) return;
    uniformSelectAppliedRef.current = true;
    applyUniformSelectableState();
  }, [uniformSelectable, applyUniformSelectableState]);

  useEffect(() => {
    const shouldGlow = uniformSelectable || (continuousScan && selectedNodeId != null);
    if (!shouldGlow) {
      selectionGlowSV.value = withTiming(0, { duration: SELECTION_GLOW_FADE_MS / 2 });
      return;
    }
    selectionGlowSV.value = 0;
    selectionGlowSV.value = withTiming(1, {
      duration: SELECTION_GLOW_FADE_MS,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }, [uniformSelectable, continuousScan, selectedNodeId, selectionGlowSV]);

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
      publishScannerSweepAngle(sweepAngleRef.current, false);
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
      setDiscoveryPulseKeys({});
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
          opacity: node.isHostilePatrol ? 1 : 0,
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
          publishScannerSweepAngle(beamDeg, true);
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
          const beamDeg = sweepAngleRef.current % 360;
          setSweepDeg(beamDeg);
          publishScannerSweepAngle(beamDeg, false);

          if (fogT >= 1) {
            dischargePhaseRef.current = 'done';
            publishScannerSweepAngle(beamDeg, false);
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
      // Presentation bridge only — does not alter timing or collision.
      publishScannerSweepAngle(beamDeg, true);
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
    baseSweepSpeedDegPerMs,
  ]);

  const handleTargetPress = useCallback(
    (nodeId: string) => {
      if (continuousScan && siphonedNodeIds.includes(nodeId)) {
        notifyNodeSelected(nodeId);
        return;
      }
      if (uniformSelectable) {
        notifyNodeSelected(nodeId);
        return;
      }
      if (scanInteractive) {
        triggerSiphonExtract(nodeId);
      }
    },
    [
      continuousScan,
      siphonedNodeIds,
      uniformSelectable,
      scanInteractive,
      notifyNodeSelected,
      triggerSiphonExtract,
    ],
  );

  const isTargetEnabled = useCallback(
    (nodeId: string): boolean => {
      if (uniformSelectable) return true;
      if (continuousScan && siphonedNodeIds.includes(nodeId)) return true;
      return scanInteractive;
    },
    [continuousScan, siphonedNodeIds, scanInteractive, uniformSelectable],
  );

  const getBlipOpacity = useCallback(
    (nodeId: string): number => {
      if (hostilePatrolIds.has(nodeId)) return 1;
      if (uniformSelectable) return 1;
      const state = blipStatesRef.current[nodeId];
      if (!state) return 0;
      if (state.siphoned) return 1;
      return state.opacity;
    },
    [hostilePatrolIds, uniformSelectable],
  );

  const getBlipScale = useCallback(
    (nodeId: string): number => {
      if (uniformSelectable) return 1;
      const state = blipStatesRef.current[nodeId];
      if (!state) return 1;
      if (state.siphoned) return 1;
      return state.scale;
    },
    [uniformSelectable],
  );

  void renderTick;

  const useDashedOuter = theme.borderStyle === 'dashed';
  const showSweep = active && (!uniformSelectable || continuousScan);
  const showCeaseControl = !continuousScan && active && !contactsLocked && !uniformSelectable;
  const selectedNodeBearing = continuousScan && selectedNodeId
    ? nodeBearings.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const canCeaseScan = siphonedNodeIds.length >= MIN_SIPHONS_TO_CEASE;

  return {
    theme,
    radarCenter,
    sweepRadius,
    structuralStroke,
    scopeGeometry,
    sweepDeg,
    sweepRotationRad,
    fogOpacity,
    phosphorDischargeDisc,
    siphonedNodeIds,
    siphonPulseKeys,
    discoveryPulseKeys,
    uniformSelectable,
    selectionAccent,
    selectionGlowInnerOpacity,
    selectionGlowOuterOpacity,
    selectionGlowRingOpacity,
    scanInteractive,
    nodeBearings,
    sweepLeadColor,
    useDashedOuter,
    showSweep,
    showCeaseControl,
    selectedNodeBearing,
    canCeaseScan,
    blipStatesRef,
    handleTargetPress,
    isTargetEnabled,
    getBlipOpacity,
    getBlipScale,
    handleCeaseScan,
  };
}
