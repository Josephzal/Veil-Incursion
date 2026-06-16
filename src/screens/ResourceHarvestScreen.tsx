import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import ResourceHarvestBg from '../../assets/images/location images/resource_harvest.png';
import CargoPackingPanel from '../components/CargoPackingPanel';
import VeilVacuumCanisterStack, {
  type VeilVacuumCanisterStackHandle,
} from '../components/harvest/VeilVacuumCanisterStack';
import { CARGO_GRID_FRAME_HEIGHT } from '../components/CargoGridBoard';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import { MAX_RUN_CANISTER_RESIDUE } from '../constants/veilResidue';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { countVeilResidueInCargo, isVeilResidueCargoItem } from '../data/cargoGridEngine';
import { useNodeProgression } from '../hooks/useNodeProgression';
import {
  pulseResidueAbsorbed,
  startVacuumHoldHaptics,
  stopVacuumHoldHaptics,
  tickVacuumHoldHaptics,
} from '../utils/harvestHaptics';
import { resolveCargoItemIcon } from '../utils/cargoItemIcon';

const RESIDUE_PARTICLE_SIZE = 52;
const VACUUM_FLIGHT_MS = 480;
const VACUUM_SCAN_MS = 180;
const VACUUM_HAPTIC_MS = 150;

interface VacuumFlight {
  id: string;
  instanceId: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
}

function VacuumFlightParticle({
  flight,
  onComplete,
}: {
  flight: VacuumFlight;
  onComplete: (flight: VacuumFlight) => void;
}): React.JSX.Element {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: VACUUM_FLIGHT_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(onComplete)(flight);
        }
      },
    );
  }, [flight, onComplete, progress]);

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const x = flight.startX + (flight.targetX - flight.startX) * t;
    const y = flight.startY + (flight.targetY - flight.startY) * t;
    const scale = 1 - t * 0.8;
    return {
      position: 'absolute',
      left: x - (RESIDUE_PARTICLE_SIZE * scale) / 2,
      top: y - (RESIDUE_PARTICLE_SIZE * scale) / 2,
      width: RESIDUE_PARTICLE_SIZE,
      height: RESIDUE_PARTICLE_SIZE,
      opacity: 1 - t,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.Image
      source={resolveCargoItemIcon('veil-residue-bulk')}
      resizeMode="contain"
      style={style}
    />
  );
}

export default function ResourceHarvestScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    applyHarvestChoice,
    relocateCargoItem,
    discardCargoInstance,
    appendRunLog,
    prepareHarvestAmbushEncounter,
    absorbVeilResidueInstance,
  } = useRun();
  const { startCombat } = useGameFlow();
  const { completeCurrentNode } = useNodeProgression();

  const harvestAppliedRef = useRef(false);
  const canisterRef = useRef<VeilVacuumCanisterStackHandle>(null);
  const overlayRef = useRef<View>(null);
  const vacuumActiveRef = useRef(false);
  const vacuumBusyRef = useRef(false);
  const itemCentersRef = useRef<Record<string, { x: number; y: number }>>({});
  const hiddenInstanceIdsRef = useRef<Set<string>>(new Set());
  const sessionCollectedRef = useRef(activeIncursion.sessionVeilResidueCollected);

  const [isVacuuming, setIsVacuuming] = useState(false);
  const [flights, setFlights] = useState<VacuumFlight[]>([]);
  const [hiddenInstanceIds, setHiddenInstanceIds] = useState<Set<string>>(() => new Set());

  sessionCollectedRef.current = activeIncursion.sessionVeilResidueCollected;

  const pendingResidue = useMemo(
    () => countVeilResidueInCargo(activeIncursion.cargo),
    [activeIncursion.cargo],
  );
  const harvestPercentage = Math.round(
    (activeIncursion.sessionVeilResidueCollected / MAX_RUN_CANISTER_RESIDUE) * 100,
  );
  const canisterFull = activeIncursion.sessionVeilResidueCollected >= MAX_RUN_CANISTER_RESIDUE;
  const canVacuum = pendingResidue > 0 && !canisterFull;

  useEffect(() => {
    if (harvestAppliedRef.current) return;
    if (activeIncursion.pendingHarvestReturn === 'RESOURCE_CACHE') return;
    harvestAppliedRef.current = true;
    const result = applyHarvestChoice('FULL');
    result.logLines.forEach((line) => appendRunLog(line));
  }, [activeIncursion.pendingHarvestReturn, appendRunLog, applyHarvestChoice]);

  const handleResidueAbsorption = useCallback((instanceId: string, startCenter: { x: number; y: number }) => {
    vacuumBusyRef.current = true;

    const centerPromise = canisterRef.current?.measureCanisterCenter() ?? Promise.resolve(null);
    centerPromise.then((targetCenter) => {
      if (!targetCenter) {
        vacuumBusyRef.current = false;
        return;
      }

      overlayRef.current?.measureInWindow((overlayX, overlayY) => {
        hiddenInstanceIdsRef.current.add(instanceId);
        setHiddenInstanceIds(new Set(hiddenInstanceIdsRef.current));
        setFlights((prev) => [
          ...prev,
          {
            id: instanceId,
            instanceId,
            startX: startCenter.x - overlayX,
            startY: startCenter.y - overlayY,
            targetX: targetCenter.x - overlayX,
            targetY: targetCenter.y - overlayY,
          },
        ]);
      });
    });
  }, []);

  const launchNextVacuum = useCallback(() => {
    if (!vacuumActiveRef.current || vacuumBusyRef.current) return;
    if (sessionCollectedRef.current >= MAX_RUN_CANISTER_RESIDUE) return;

    const nextResidue = activeIncursion.cargo.containment.find(
      (item) => isVeilResidueCargoItem(item.itemId) && !hiddenInstanceIdsRef.current.has(item.instanceId),
    );
    if (!nextResidue) return;

    const startCenter = itemCentersRef.current[nextResidue.instanceId];
    if (!startCenter) return;

    handleResidueAbsorption(nextResidue.instanceId, startCenter);
  }, [activeIncursion.cargo.containment, handleResidueAbsorption]);

  useEffect(() => {
    if (!isVacuuming || !canVacuum) return undefined;

    const scanTimer = setInterval(() => {
      if (!vacuumBusyRef.current) {
        launchNextVacuum();
      }
    }, VACUUM_SCAN_MS);

    return () => clearInterval(scanTimer);
  }, [canVacuum, isVacuuming, launchNextVacuum, pendingResidue]);

  useEffect(() => {
    if (!isVacuuming) return undefined;

    startVacuumHoldHaptics();
    const hapticTimer = setInterval(() => {
      tickVacuumHoldHaptics();
    }, VACUUM_HAPTIC_MS);

    return () => {
      clearInterval(hapticTimer);
      stopVacuumHoldHaptics();
    };
  }, [isVacuuming]);

  const handleVacuumStart = useCallback(() => {
    if (!canVacuum) return;
    vacuumActiveRef.current = true;
    setIsVacuuming(true);
    launchNextVacuum();
  }, [canVacuum, launchNextVacuum]);

  const handleVacuumStop = useCallback(() => {
    vacuumActiveRef.current = false;
    setIsVacuuming(false);
  }, []);

  const handleFlightComplete = useCallback((flight: VacuumFlight) => {
    setFlights((prev) => prev.filter((entry) => entry.id !== flight.id));

    const priorCollected = sessionCollectedRef.current;
    const absorbed = absorbVeilResidueInstance(flight.instanceId);
    if (absorbed > 0) {
      pulseResidueAbsorbed();
      const nextPercent = Math.round(
        ((priorCollected + absorbed) / MAX_RUN_CANISTER_RESIDUE) * 100,
      );
      canisterRef.current?.animateFillToPercent(nextPercent);
    }

    hiddenInstanceIdsRef.current.delete(flight.instanceId);
    setHiddenInstanceIds(new Set(hiddenInstanceIdsRef.current));
    vacuumBusyRef.current = false;

    if (vacuumActiveRef.current) {
      requestAnimationFrame(() => launchNextVacuum());
    }
  }, [absorbVeilResidueInstance, launchNextVacuum]);

  const handleContainmentItemCenterMeasured = useCallback((
    instanceId: string,
    center: { x: number; y: number },
  ) => {
    if (hiddenInstanceIdsRef.current.has(instanceId)) return;
    itemCentersRef.current[instanceId] = center;
  }, []);

  const displayCargo = useMemo(() => ({
    ...activeIncursion.cargo,
    containment: activeIncursion.cargo.containment.filter(
      (item) => !hiddenInstanceIds.has(item.instanceId),
    ),
  }), [activeIncursion.cargo, hiddenInstanceIds]);

  const handlePackingContinue = () => {
    handleVacuumStop();

    if (runState.pendingAmbush) {
      prepareHarvestAmbushEncounter();
      startCombat();
      return;
    }

    const route = activeIncursion.pendingHarvestReturn;
    if (route === 'RESOURCE_CACHE') {
      completeCurrentNode('Resource cache secured — cargo packed.');
      return;
    }
    if (route === 'POST_COMBAT') {
      completeCurrentNode('Harvest secured — returning to Ley-line grid.');
      return;
    }
    completeCurrentNode('Resource harvest complete.');
  };

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.screenBody} pointerEvents="box-none">
          <Image source={ResourceHarvestBg} style={styles.backgroundImage} resizeMode="cover" />
          <View style={styles.backgroundScrim} pointerEvents="none" />

          <View style={styles.contentForegroundPack} pointerEvents="box-none">
            <CargoPackingPanel
              cargo={displayCargo}
              theme={theme}
              onRelocateItem={relocateCargoItem}
              onDiscardItem={discardCargoInstance}
              showCreditsHud={false}
              onContinue={handlePackingContinue}
              continueLabel={
                activeIncursion.pendingHarvestReturn === 'RESOURCE_CACHE'
                  ? '[ CONTINUE TO GRID ]'
                  : '[ CONTINUE RUN ]'
              }
              onContainmentItemCenterMeasured={handleContainmentItemCenterMeasured}
              harvestLayout
              gridSidecar={(
                <VeilVacuumCanisterStack
                  ref={canisterRef}
                  harvestPercentage={harvestPercentage}
                  active={isVacuuming}
                  disabled={!canVacuum}
                  onPressIn={handleVacuumStart}
                  onPressOut={handleVacuumStop}
                  gridFrameHeight={CARGO_GRID_FRAME_HEIGHT}
                />
              )}
            />
          </View>

          <View ref={overlayRef} style={styles.flightOverlay} pointerEvents="none">
            {flights.map((flight) => (
              <VacuumFlightParticle
                key={flight.id}
                flight={flight}
                onComplete={handleFlightComplete}
              />
            ))}
          </View>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  backgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  backgroundScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 6, 8, 0.72)' },
  contentForegroundPack: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    position: 'relative',
    zIndex: 1,
  },
  flightOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
  },
});
