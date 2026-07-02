import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ResourceHarvestBg from '../../assets/images/location images/resource_harvest.png';
import CargoPackingPanel from '../components/CargoPackingPanel';
import ResidueParticle from '../components/harvest/ResidueParticle';
import VeilVacuumCanisterStack, {
  type VeilVacuumCanisterStackHandle,
} from '../components/harvest/VeilVacuumCanisterStack';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame from '../components/layout/RunEventScreenFrame';
import { MAX_RUN_CANISTER_RESIDUE } from '../constants/veilResidue';
import { resolveVeilResidueCanisterFillPercent } from '../data/veilResidueRunEngine';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { isVeilResidueCargoItem } from '../data/cargoGridEngine';
import { useNodeProgression } from '../hooks/useNodeProgression';
import type { HarvestFloorBounds, ResidueParticleData } from '../types/residueParticle';
import {
  startVacuumHoldHaptics,
  stopVacuumHoldHaptics,
  tickResidueParticleAbsorbed,
} from '../utils/harvestHaptics';
import {
  harvestFloorFromWindowRect,
  resolveResidueEnemyTier,
  spawnResidueSwarm,
} from '../utils/spawnResidueSwarm';

const VACUUM_HAPTIC_MS = 150;
const VALUE_EPSILON = 0.001;

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
    absorbVeilResidueParticle,
    finalizeHarvestScreen,
  } = useRun();
  const { startCombat } = useGameFlow();
  const { completeCurrentNode } = useNodeProgression();

  const harvestAppliedRef = useRef(false);
  const harvestFinalizedRef = useRef(false);
  const canisterRef = useRef<VeilVacuumCanisterStackHandle>(null);
  const overlayRef = useRef<View>(null);
  const swarmedInstanceIdsRef = useRef<Set<string>>(new Set());
  const instanceRemainingRef = useRef<Record<string, number>>({});
  const sessionCollectedRef = useRef(activeIncursion.sessionVeilResidueCollected);
  const lootFloorRef = useRef<HarvestFloorBounds | null>(null);

  const [isVacuuming, setIsVacuuming] = useState(false);
  const [lootPool, setLootPool] = useState<ResidueParticleData[]>([]);
  const [swarmedInstanceIds, setSwarmedInstanceIds] = useState<Set<string>>(() => new Set());
  const [canisterCoordinates, setCanisterCoordinates] = useState<{ x: number; y: number } | null>(null);
  const [lootFloor, setLootFloor] = useState<HarvestFloorBounds | null>(null);
  const [residueSpawnGeneration, setResidueSpawnGeneration] = useState(0);
  const lootPoolRef = useRef<ResidueParticleData[]>([]);
  const containmentSlotAssignmentRef = useRef<Map<string, number>>(new Map());
  const nextContainmentSlotRef = useRef(0);
  const [fixedExternalSlotCount, setFixedExternalSlotCount] = useState(0);

  sessionCollectedRef.current = activeIncursion.sessionVeilResidueCollected;
  lootPoolRef.current = lootPool;
  lootFloorRef.current = lootFloor;

  const harvestPercentage = resolveVeilResidueCanisterFillPercent(
    activeIncursion.sessionVeilResidueCollected,
  );
  const canisterFull = activeIncursion.sessionVeilResidueCollected >= MAX_RUN_CANISTER_RESIDUE;
  const canVacuum = lootPool.length > 0 && !canisterFull;

  const continueLabel = useMemo(
    () => (activeIncursion.pendingHarvestReturn === 'RESOURCE_CACHE'
      ? '[ CONTINUE TO GRID ]'
      : '[ CONTINUE RUN ]'),
    [activeIncursion.pendingHarvestReturn],
  );

  const residueInstanceIds = useMemo(
    () => activeIncursion.cargo.containment
      .filter((item) => isVeilResidueCargoItem(item.itemId))
      .map((item) => item.instanceId),
    [activeIncursion.cargo.containment],
  );

  useEffect(() => {
    let assigned = false;
    activeIncursion.cargo.containment.forEach((item) => {
      if (containmentSlotAssignmentRef.current.has(item.instanceId)) return;
      containmentSlotAssignmentRef.current.set(item.instanceId, nextContainmentSlotRef.current);
      nextContainmentSlotRef.current += 1;
      assigned = true;
    });
    if (assigned) {
      setFixedExternalSlotCount(nextContainmentSlotRef.current);
    }
  }, [activeIncursion.cargo.containment]);

  const resolveContainmentSlotIndex = useCallback(
    (instanceId: string) => containmentSlotAssignmentRef.current.get(instanceId),
    [],
  );

  useEffect(() => {
    if (harvestAppliedRef.current) return;
    if (activeIncursion.pendingHarvestReturn === 'RESOURCE_CACHE') return;
    harvestAppliedRef.current = true;
    const result = applyHarvestChoice('FULL');
    result.logLines.forEach((line) => appendRunLog(line));
    setResidueSpawnGeneration((gen) => gen + 1);
  }, [activeIncursion.pendingHarvestReturn, appendRunLog, applyHarvestChoice]);

  useEffect(() => {
    if (activeIncursion.pendingHarvestReturn !== 'RESOURCE_CACHE') return;
    setResidueSpawnGeneration((gen) => gen + 1);
  }, [activeIncursion.pendingHarvestReturn]);

  useEffect(() => () => {
    if (harvestFinalizedRef.current) return;
    harvestFinalizedRef.current = true;
    finalizeHarvestScreen();
  }, [finalizeHarvestScreen]);

  const handleHarvestFloorMeasured = useCallback((rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    overlayRef.current?.measureInWindow((overlayX, overlayY) => {
      const nextFloor = harvestFloorFromWindowRect(rect, { x: overlayX, y: overlayY });
      lootFloorRef.current = nextFloor;
      setLootFloor(nextFloor);
    });
  }, []);

  useEffect(() => {
    const floor = lootFloorRef.current;
    if (!floor) return;

    const tier = resolveResidueEnemyTier(activeIncursion);
    const depth = activeIncursion.currentDepth;
    const newParticles: ResidueParticleData[] = [];
    let spawnedAny = false;

    residueInstanceIds.forEach((instanceId) => {
      if (swarmedInstanceIdsRef.current.has(instanceId)) return;

      newParticles.push(...spawnResidueSwarm(tier, depth, floor, {
        instanceId,
        totalValue: 1,
      }));

      swarmedInstanceIdsRef.current.add(instanceId);
      instanceRemainingRef.current[instanceId] = 1;
      spawnedAny = true;
    });

    if (!spawnedAny) return;

    setSwarmedInstanceIds(new Set(swarmedInstanceIdsRef.current));
    setLootPool((prev) => [...prev, ...newParticles]);
  }, [activeIncursion, lootFloor, residueInstanceIds, residueSpawnGeneration]);

  useEffect(() => {
    const shouldPulseHaptics = isVacuuming && lootPool.length > 0 && !canisterFull;
    if (!shouldPulseHaptics) return undefined;

    startVacuumHoldHaptics();
    const hapticTimer = setInterval(() => {
      startVacuumHoldHaptics();
    }, VACUUM_HAPTIC_MS);

    return () => {
      clearInterval(hapticTimer);
      stopVacuumHoldHaptics();
    };
  }, [canisterFull, isVacuuming, lootPool.length]);

  const handleVacuumStart = useCallback(() => {
    if (!canVacuum) return;

    const centerPromise = canisterRef.current?.measureCanisterCenter() ?? Promise.resolve(null);
    centerPromise.then((targetCenter) => {
      if (!targetCenter) return;

      overlayRef.current?.measureInWindow((overlayX, overlayY) => {
        setCanisterCoordinates({
          x: targetCenter.x - overlayX,
          y: targetCenter.y - overlayY,
        });
        setIsVacuuming(true);
      });
    });
  }, [canVacuum]);

  const handleVacuumStop = useCallback(() => {
    setIsVacuuming(false);
  }, []);

  const handleParticleAbsorbed = useCallback((value: number, particleId: string) => {
    tickResidueParticleAbsorbed();

    const particle = lootPoolRef.current.find((entry) => entry.id === particleId);
    if (!particle) return;

    const { instanceId } = particle;
    const remaining = (instanceRemainingRef.current[instanceId] ?? 1) - value;
    instanceRemainingRef.current[instanceId] = Math.max(0, remaining);
    const finalizeInstance = instanceRemainingRef.current[instanceId] <= VALUE_EPSILON;
    if (finalizeInstance) {
      delete instanceRemainingRef.current[instanceId];
    }

    const nextCollected = Math.min(
      MAX_RUN_CANISTER_RESIDUE,
      sessionCollectedRef.current + value,
    );
    sessionCollectedRef.current = nextCollected;

    absorbVeilResidueParticle(instanceId, value, finalizeInstance);
    canisterRef.current?.animateFillToPercent(
      (nextCollected / MAX_RUN_CANISTER_RESIDUE) * 100,
    );

    setLootPool((prev) => prev.filter((entry) => entry.id !== particleId));
  }, [absorbVeilResidueParticle]);

  const displayCargo = useMemo(() => ({
    ...activeIncursion.cargo,
    containment: activeIncursion.cargo.containment.filter(
      (item) => !isVeilResidueCargoItem(item.itemId) || !swarmedInstanceIds.has(item.instanceId),
    ),
  }), [activeIncursion.cargo, swarmedInstanceIds]);

  const handlePackingContinue = () => {
    handleVacuumStop();
    if (!harvestFinalizedRef.current) {
      harvestFinalizedRef.current = true;
      finalizeHarvestScreen();
    }
    setLootPool([]);
    swarmedInstanceIdsRef.current.clear();
    instanceRemainingRef.current = {};
    setSwarmedInstanceIds(new Set());

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
      <IncursionRunLayout hideRunChrome style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventScreenFrame
          backgroundImage={ResourceHarvestBg}
          backgroundScrimOpacity={0.72}
          bodyStyle={styles.harvestBody}
          overlay={(
            <View ref={overlayRef} style={styles.particleOverlay} pointerEvents="none">
              {lootPool.map((particle) => (
                <ResidueParticle
                  key={particle.id}
                  particle={particle}
                  isVacuuming={isVacuuming}
                  canisterCoordinates={canisterCoordinates}
                  onAbsorbed={handleParticleAbsorbed}
                />
              ))}
            </View>
          )}
        >
          <View style={styles.harvestStage}>
            <CargoPackingPanel
              cargo={displayCargo}
              theme={theme}
              onRelocateItem={relocateCargoItem}
              onDiscardItem={discardCargoInstance}
              showCreditsHud={false}
              onContinue={handlePackingContinue}
              continueLabel={continueLabel}
              onHarvestFloorMeasured={handleHarvestFloorMeasured}
              fixedExternalSlotCount={fixedExternalSlotCount}
              resolveContainmentSlotIndex={resolveContainmentSlotIndex}
              harvestTriPane
              harvestPercentage={harvestPercentage}
              gridSidecar={(
                <VeilVacuumCanisterStack
                  ref={canisterRef}
                  harvestPercentage={harvestPercentage}
                  active={isVacuuming}
                  disabled={!canVacuum}
                  onPressIn={handleVacuumStart}
                  onPressOut={handleVacuumStop}
                  sizeMode="extractor-block"
                />
              )}
              cargoBackdrop
            />
          </View>
        </RunEventScreenFrame>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  harvestBody: {
    flex: 1,
    minHeight: 0,
    paddingTop: 0,
    pointerEvents: 'box-none',
  },
  harvestStage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  particleOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
});
