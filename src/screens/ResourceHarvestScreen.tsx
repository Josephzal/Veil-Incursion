import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveImmersiveFooterInset } from '../constants/immersiveLayout';
import ResourceHarvestBg from '../../assets/images/location images/resource_harvest.png';
import CargoPackingPanel from '../components/CargoPackingPanel';
import CargoLootPickupOverlay from '../components/CargoLootPickupOverlay';
import ResidueParticle from '../components/harvest/ResidueParticle';
import HarvestScreenHeader from '../components/harvest/HarvestScreenHeader';
import HapticPressable from '../components/HapticPressable';
import TerminalText from '../components/TerminalText';
import { hasFieldRunItem } from '../data/runItemFieldEngine';
import VeilVacuumCanisterStack, {
  type VeilVacuumCanisterStackHandle,
} from '../components/harvest/VeilVacuumCanisterStack';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventImmersiveBackdrop from '../components/layout/RunEventImmersiveBackdrop';
import { MAX_RUN_CANISTER_RESIDUE } from '../constants/veilResidue';
import { getFactionAccent } from '../data/factions';
import { resolveVeilResidueCanisterFillPercent } from '../data/veilResidueRunEngine';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { isVeilResidueCargoItem } from '../data/cargoGridEngine';
import {
  cargoItemQuantity,
  isProgressionProtectedCargo,
  isRareOrApexCargo,
} from '../data/cargoStackEngine';
import { CARGO_ITEM_CATALOG } from '../types/cargoGrid';
import { useNodeProgression } from '../hooks/useNodeProgression';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
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
  const { fontScale } = useResponsiveLayout();
  const {
    runState,
    activeIncursion,
    applyHarvestChoice,
    relocateCargoItem,
    replaceCargoItem,
    discardCargoInstance,
    returnCargoToContainment,
    recordEconomyLeaveBehind,
    appendRunLog,
    prepareHarvestAmbushEncounter,
    absorbVeilResidueParticle,
    finalizeHarvestScreen,
    useLeySlagSplitter,
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
  const activeCabal = getFactionAccent(activeIncursion.alignedFaction ?? null);
  const canisterFull = activeIncursion.sessionVeilResidueCollected >= MAX_RUN_CANISTER_RESIDUE;
  const canVacuum = lootPool.length > 0 && !canisterFull;

  const showSplitterPrompt = hasFieldRunItem(activeIncursion.runItems, 'ley-slag-splitter')
    && !activeIncursion.itemRuntime.leySlagSplitterArmed
    && activeIncursion.pendingHarvestReturn !== 'RESOURCE_CACHE';

  const continueLabel = useMemo(
    () => (activeIncursion.pendingHarvestReturn === 'RESOURCE_CACHE'
      ? '[ SEAL RIFT ]'
      : '[ CONTINUE DESCENT ]'),
    [activeIncursion.pendingHarvestReturn],
  );

  const sectorLabel = (
    activeIncursion.runGenerationContext?.sectorState.displayName
    ?? 'UNKNOWN SECTOR'
  ).toUpperCase();
  const depthLabel = `DEPTH ${String(activeIncursion.currentDepth ?? 1).padStart(2, '0')}`;
  const insets = useSafeAreaInsets();
  const masterPadding = Math.max(16 * fontScale, 18);
  const layoutGap = 10 * fontScale;
  const verticalPadding = Math.max(masterPadding, resolveImmersiveFooterInset(insets.bottom));

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
    const pendingTwist = activeIncursion.depthIdentity?.pendingTwistedChoice?.templateId;
    if (
      pendingTwist === 'RESOURCE_BLOOM'
      || pendingTwist === 'ANCHOR_VEIN'
      || pendingTwist === 'VEIL_PROPER_CACHE'
      || pendingTwist === 'ANCHOR_CORE_BREACH'
    ) {
      return;
    }
    if (
      hasFieldRunItem(activeIncursion.runItems, 'ley-slag-splitter')
      && !activeIncursion.itemRuntime.leySlagSplitterArmed
    ) {
      return;
    }
    harvestAppliedRef.current = true;
    const result = applyHarvestChoice('FULL');
    result.logLines.forEach((line) => appendRunLog(line));
    setResidueSpawnGeneration((gen) => gen + 1);
  }, [
    activeIncursion.depthIdentity?.pendingTwistedChoice?.templateId,
    activeIncursion.itemRuntime.leySlagSplitterArmed,
    activeIncursion.pendingHarvestReturn,
    activeIncursion.runItems,
    appendRunLog,
    applyHarvestChoice,
  ]);

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
        existingCenters: [
          ...lootPoolRef.current.map((particle) => ({
            x: particle.startX,
            y: particle.startY,
          })),
          ...newParticles.map((particle) => ({
            x: particle.startX,
            y: particle.startY,
          })),
        ],
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

  const [pendingLeaveBehind, setPendingLeaveBehind] = useState(false);

  const unpackedNonResidue = useMemo(
    () => activeIncursion.cargo.containment.filter((item) => !isVeilResidueCargoItem(item.itemId)),
    [activeIncursion.cargo.containment],
  );

  const leaveBehindSummary = useMemo(() => {
    if (unpackedNonResidue.length === 0) return { name: '', qty: '', progression: false, rare: false };
    const first = unpackedNonResidue[0]!;
    const totalUnits = unpackedNonResidue.reduce((sum, item) => sum + cargoItemQuantity(item), 0);
    const progression = unpackedNonResidue.some((item) => isProgressionProtectedCargo(item.itemId));
    const rare = unpackedNonResidue.some((item) => isRareOrApexCargo(item.itemId));
    const name = unpackedNonResidue.length === 1
      ? CARGO_ITEM_CATALOG[first.itemId].name
      : `${unpackedNonResidue.length} stacks`;
    return {
      name,
      qty: `${totalUnits} units`,
      progression,
      rare,
    };
  }, [unpackedNonResidue]);

  const commitPackingContinue = useCallback(() => {
    handleVacuumStop();
    if (!harvestAppliedRef.current) {
      harvestAppliedRef.current = true;
      const result = applyHarvestChoice('FULL');
      result.logLines.forEach((line) => appendRunLog(line));
    }
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
  }, [
    activeIncursion.pendingHarvestReturn,
    appendRunLog,
    applyHarvestChoice,
    completeCurrentNode,
    finalizeHarvestScreen,
    handleVacuumStop,
    prepareHarvestAmbushEncounter,
    runState.pendingAmbush,
    startCombat,
  ]);

  const handlePackingContinue = () => {
    if (unpackedNonResidue.length > 0) {
      setPendingLeaveBehind(true);
      return;
    }
    commitPackingContinue();
  };

  return (
    <IncursionShell>
      <IncursionRunLayout hideRunChrome style={{ backgroundColor: 'transparent' }}>
        <RunEventImmersiveBackdrop
          backgroundImage={ResourceHarvestBg}
          scrimOpacity={0.09}
          contentPadding={masterPadding}
          contentStyle={[styles.harvestBody, { paddingTop: verticalPadding, paddingBottom: verticalPadding }]}
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
          <View style={[styles.masterContainment, { gap: layoutGap }]}>
            <HarvestScreenHeader
              statusLine={`CONTAINMENT STABLE // ${sectorLabel}`}
              depthLabel={depthLabel}
              fontScale={fontScale}
            />
            {showSplitterPrompt ? (
              <HapticPressable
                onPress={() => {
                  if (!useLeySlagSplitter()) return;
                  if (harvestAppliedRef.current) return;
                  harvestAppliedRef.current = true;
                  const result = applyHarvestChoice('FULL');
                  result.logLines.forEach((line) => appendRunLog(line));
                  setResidueSpawnGeneration((gen) => gen + 1);
                }}
                style={({ pressed }) => [
                  styles.splitterBtn,
                  { borderColor: activeCabal, opacity: pressed ? 0.82 : 1 },
                ]}
              >
                <TerminalText size={9} letterSpacing={0.8} style={{ color: activeCabal, fontWeight: '700' }}>
                  [ LEY-SLAG SPLITTER ] — ARM +2 RESOURCE VEINS
                </TerminalText>
              </HapticPressable>
            ) : null}
            <View style={styles.harvestStage}>
              <CargoPackingPanel
                cargo={displayCargo}
                theme={theme}
                accentColor={activeCabal}
                onRelocateItem={relocateCargoItem}
                onReplaceItem={replaceCargoItem}
                onDiscardItem={discardCargoInstance}
                onReturnToContainment={returnCargoToContainment}
                showCreditsHud={false}
                onContinue={handlePackingContinue}
                continueLabel={continueLabel}
                onHarvestFloorMeasured={handleHarvestFloorMeasured}
                fixedExternalSlotCount={fixedExternalSlotCount}
                resolveContainmentSlotIndex={resolveContainmentSlotIndex}
                harvestTriPane
                harvestPercentage={harvestPercentage}
                residueCollected={activeIncursion.sessionVeilResidueCollected}
                residueCapacity={MAX_RUN_CANISTER_RESIDUE}
                residueLooseCount={lootPool.length}
                isVacuuming={isVacuuming}
                packHeaderLabel="CARGO MANIFEST"
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
              />
            </View>
          </View>
        </RunEventImmersiveBackdrop>
      </IncursionRunLayout>

      <CargoLootPickupOverlay
        visible={pendingLeaveBehind}
        mode="LEAVE_BEHIND"
        itemName={leaveBehindSummary.name}
        quantityLabel={leaveBehindSummary.qty}
        theme={theme}
        accentColor={activeCabal}
        progressionWarning={leaveBehindSummary.progression}
        rareWarning={leaveBehindSummary.rare}
        onLeaveBehind={() => {
          const left = unpackedNonResidue.reduce((sum, item) => sum + cargoItemQuantity(item), 0);
          recordEconomyLeaveBehind(left > 0 ? left : 1);
          setPendingLeaveBehind(false);
          commitPackingContinue();
        }}
        onCancel={() => setPendingLeaveBehind(false)}
      />
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  harvestBody: {
    flex: 1,
    minHeight: 0,
    pointerEvents: 'box-none',
  },
  masterContainment: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 0,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  splitterBtn: {
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
  },
  harvestStage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
  particleOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
  },
});
