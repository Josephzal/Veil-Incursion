import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, StatusBar, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import {
  resolveCombatEnemyPortrait,
  resolvePortraitKeySuffix,
  resolveUnitCombatAttackPortrait,
  resolveUnitCombatPortrait,
} from '../utils/combatEnemyPortrait';
import type { ApparitionViewportRef } from '../components/combat/ApparitionViewport';
import CombatLandscapeArena from '../components/combat/CombatLandscapeArena';
import CombatEnemyGrid from '../components/combat/CombatEnemyGrid';
import { resolveArenaLayoutMode } from '../components/combat/combatEnemyBarLayout';
import CombatJuiceHost from '../components/combat/CombatJuiceHost';
import CombatParryScreenOverlay from '../components/combat/CombatParryScreenOverlay';
import CombatResolutionBanner from '../components/combat/CombatResolutionBanner';
import ParticleOverlay from '../components/atmosphere/ParticleOverlay';
import { macroFamilyToBiomeId } from '../constants/biomeConfig';
import {
  resolveCombatArenaBackground,
  resolveCombatArenaBackgroundScrim,
} from '../constants/combatArenaBackground';
import { pulseCombatTargetSelect } from '../utils/hubButtonHaptics';
import { triggerShake } from '../utils/combatJuice';
import type { CombatPlayerViewportRef } from '../components/combat/CombatPlayerViewport';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import TacticalCombatHub from '../components/TacticalCombatHub';
import {
  CombatEnemyChromeProvider,
} from '../context/CombatEnemyChromeContext';
import { CombatArenaOverlayProvider } from '../context/CombatArenaOverlayContext';
import { CombatTurnProvider } from '../context/CombatTurnContext';
import { useTerminal } from '../context/TerminalContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useTerminalNav } from '../context/TerminalNavContext';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import {
  districtBossKillCredits,
  eliteKillCredits,
  primeBossKillCredits,
  standardKillCredits,
} from '../data/combatCredits';
import { isPrimeBossDepth } from '../data/districtPacing';
import {
  buildInitialSquadUiSnapshot,
  type CombatSquadUiSnapshot,
} from '../utils/combatTelemetryFormat';
import { buildCombatAugmentIcons } from '../utils/combatAugmentIcons';
import { encounterBudgetForDepth } from '../data/combatEncounterBudget';
import type { CargoItemId } from '../types/cargoGrid';
import {
  createDefaultPendingNarrativeCombatBoons,
  type PendingNarrativeCombatBoons,
} from '../types/narrativeBonusReward';
import { depthFromNodesCleared, isDistrictGateDepth } from '../data/districtPacing';
import { collectFactionTraitLoot, rollGatekeeperLockedTemplate } from '../data/combatRewardEngine';
import { shouldGrantAdrenalinePrimerAp } from '../data/boundRequisitionEngine';
import type { IncursionConsumableUseResult } from '../types/incursionInventory';
import CombatGlobalChrome from './combat/layouts/CombatGlobalChrome';
import CombatOperativeVitalsOverlay from './combat/layouts/CombatOperativeVitalsOverlay';
import CombatTacticalDashboard from './combat/layouts/CombatTacticalDashboard';
import CombatDashboardMacroLog from './combat/layouts/CombatDashboardMacroLog';
import HostileIntelView from './combat/layouts/HostileIntelView';
import TurnOrderSidebar from './combat/layouts/TurnOrderSidebar';
import CombatDashboardCommandColumn from './combat/layouts/CombatDashboardCommandColumn';
import type { CombatOperativeTelemetry } from '../components/combat/CombatOperativeHud';
import { useImmersiveCombatChrome } from '../hooks/useImmersiveCombatChrome';

export default function CombatScreen(): React.JSX.Element {
  useImmersiveCombatChrome(true);
  const { theme } = useTerminal();
  const { startResourceHarvest, startPostCombatBoon, startGameOver, startExtractionReview, goToHub } = useGameFlow();
  const { setTerminalView } = useTerminalNav();
  const {
    runState,
    syncAfterCombat,
    appendRunLog,
    useIncursionConsumable,
    endRun,
    exitCombatToBadge,
    refillStaminaAfterCombat,
    preparePostCombatMutations,
    clearPendingAmbush,
    incrementCombatNodesCleared,
    activeIncursion,
    shiftBossPhase,
    awardRunCredits,
    getSelectedVectorNode,
    beginPostCombatHarvest,
    grantCombatResourceDrops,
    completeDefendRiftVictory,
    consumeAdrenalinePrimerAfterCombat,
    claimPendingNarrativeCombatBoons,
    clearNarrativeBoonStatusEffects,
    isPostCombatBoonBlocked,
    recordRunKillAttacker,
    clearEncounterUltimateDisabled,
  } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const { getWeaponCombatStats, account, addLockedContainer } = usePlayerAccount();
  const baseWeaponStats = getWeaponCombatStats();
  const strikeBonusPct = activeIncursion.strikeDamageBonusPct ?? 0;
  const weaponCombatStats = useMemo(() => {
    if (strikeBonusPct <= 0) return baseWeaponStats;
    const mult = 1 + strikeBonusPct / 100;
    return {
      ...baseWeaponStats,
      strikeDamage: Math.floor(baseWeaponStats.strikeDamage * mult),
      exhaustedStrikeDamage: Math.floor(baseWeaponStats.exhaustedStrikeDamage * mult),
    };
  }, [baseWeaponStats, strikeBonusPct]);
  const playerCritChanceBonus = account.factionPerks.critChanceBonus;
  const env = activeIncursion.environmentalModifiers;
  const combatEntryStamina =
    env.startingStaminaPenalty > 0 ? 50 : runState.currentStamina;
  const adrenalinePrimerBonusAp = shouldGrantAdrenalinePrimerAp(activeIncursion) ? 1 : 0;
  const shadowWarApBonus = activeIncursion.shadowWarBuffs?.firstTurnApBonus ?? 0;
  const shadowWarKineticArmor = activeIncursion.shadowWarBuffs?.kineticArmorBonus ?? 0;
  const kineticBatteryActive = activeIncursion.boundRequisition?.kineticBatteryActive ?? false;
  const firstTurnBonusAp = adrenalinePrimerBonusAp + shadowWarApBonus;
  const [narrativeCombatBoons, setNarrativeCombatBoons] = useState<PendingNarrativeCombatBoons>(
    createDefaultPendingNarrativeCombatBoons,
  );
  const narrativeBoonsClaimedRef = useRef(false);

  useLayoutEffect(() => {
    if (narrativeBoonsClaimedRef.current) return;
    narrativeBoonsClaimedRef.current = true;
    setNarrativeCombatBoons(claimPendingNarrativeCombatBoons());
  }, [claimPendingNarrativeCombatBoons]);

  const [squadUi, setSquadUi] = useState<CombatSquadUiSnapshot | null>(null);
  const [operativeTelemetry, setOperativeTelemetry] = useState<CombatOperativeTelemetry | null>(null);
  const [wardPrimed, setWardPrimed] = useState(false);
  const [abilityPrimed, setAbilityPrimed] = useState(false);
  const [resolutionOutcome, setResolutionOutcome] = useState<'VICTORY' | 'DEFEAT' | null>(null);
  const resolutionDismissRef = useRef<() => void>(() => {});
  const apparitionRef = useRef<ApparitionViewportRef>(null);
  const playerViewportRef = useRef<CombatPlayerViewportRef>(null);
  const killResolverRef = useRef<() => void>(() => {});
  const healHandlerRef = useRef<(amount: number) => void>(() => {});
  const consumableHandlerRef = useRef<(result: IncursionConsumableUseResult) => void>(() => {});
  const canDeployCargoRef = useRef<(itemId: CargoItemId) => boolean>(() => false);
  const targetHandlerRef = useRef<(unitId: string) => void>(() => {});
  const intelTargetHandlerRef = useRef<(unitId: string) => void>(() => {});
  const dissolveCompleteRef = useRef<(unitId: string) => void>(() => {});

  const handlePlayerCritImpact = useCallback(() => {
    triggerShake('heavy');
  }, []);

  const handleSquadUiChange = useCallback((snapshot: CombatSquadUiSnapshot) => {
    setSquadUi(snapshot);
  }, []);

  const handleOperativeTelemetryChange = useCallback((telemetry: CombatOperativeTelemetry | null) => {
    setOperativeTelemetry(telemetry);
  }, []);

  const registerTargetHandler = useCallback((handler: (unitId: string) => void) => {
    targetHandlerRef.current = handler;
  }, []);

  const registerIntelTargetHandler = useCallback((handler: (unitId: string) => void) => {
    intelTargetHandlerRef.current = handler;
  }, []);

  const handleEnemyUnitPress = useCallback((unitId: string) => {
    pulseCombatTargetSelect();
    targetHandlerRef.current(unitId);
  }, []);

  const handleTurnOrderHostilePress = useCallback((unitId: string) => {
    pulseCombatTargetSelect();
    intelTargetHandlerRef.current(unitId);
  }, []);

  const registerKillResolver = useCallback((resolver: () => void) => {
    killResolverRef.current = resolver;
  }, []);

  const registerHealHandler = useCallback((handler: (amount: number) => void) => {
    healHandlerRef.current = handler;
  }, []);

  const registerConsumableHandler = useCallback((handler: (result: IncursionConsumableUseResult) => void) => {
    consumableHandlerRef.current = handler;
  }, []);

  const registerCanDeployCargoHandler = useCallback((handler: (itemId: CargoItemId) => boolean) => {
    canDeployCargoRef.current = handler;
  }, []);

  const registerDissolveCompleteHandler = useCallback((handler: (unitId: string) => void) => {
    dissolveCompleteRef.current = handler;
  }, []);

  const handleUnitDissolveComplete = useCallback((unitId: string) => {
    dissolveCompleteRef.current(unitId);
  }, []);

  const handleConsumableUsed = useCallback((result: IncursionConsumableUseResult) => {
    consumableHandlerRef.current(result);
  }, []);

  const handleDeployCargoItem = useCallback((itemId: CargoItemId): boolean => {
    if (!canDeployCargoRef.current(itemId)) {
      appendRunLog('[REJECTED] >> Cargo deploy unavailable this turn.');
      return false;
    }
    const result = useIncursionConsumable(itemId);
    if (!result) return false;
    consumableHandlerRef.current(result);
    return true;
  }, [appendRunLog, useIncursionConsumable]);

  const handleEradicationComplete = useCallback(() => {
    killResolverRef.current();
  }, []);

  const combatSquad = useMemo(
    () => (runState.pendingEnemies.length > 0
      ? runState.pendingEnemies
      : runState.pendingEnemy
        ? [runState.pendingEnemy]
        : []),
    [runState.pendingEnemies, runState.pendingEnemy],
  );
  const operativeClass = activeIncursion.activeClass ?? account.activeClass;

  const combatAugmentIcons = useMemo(
    () => buildCombatAugmentIcons({
      operativeClass,
      aegisLoadout: activeIncursion.aegisLoadout,
      hexShotLoadout: activeIncursion.hexShotLoadout,
      envoyLoadout: activeIncursion.envoyLoadout,
      abilityGrafts: activeIncursion.abilityGrafts,
      hexShotAbilityGrafts: activeIncursion.hexShotAbilityGrafts,
      envoyAbilityGrafts: activeIncursion.envoyAbilityGrafts,
      leyLineMutations: activeIncursion.leyLineMutations,
      hexShotBoons: activeIncursion.hexShotBoons,
      envoyBoons: activeIncursion.envoyBoons,
      narrativeCombatBoons,
    }),
    [
      operativeClass,
      activeIncursion.aegisLoadout,
      activeIncursion.hexShotLoadout,
      activeIncursion.envoyLoadout,
      activeIncursion.abilityGrafts,
      activeIncursion.hexShotAbilityGrafts,
      activeIncursion.envoyAbilityGrafts,
      activeIncursion.leyLineMutations,
      activeIncursion.hexShotBoons,
      activeIncursion.envoyBoons,
      narrativeCombatBoons,
    ],
  );

  const arenaLayoutMode = useMemo(
    () => resolveArenaLayoutMode(combatSquad.length),
    [combatSquad.length],
  );
  const vectorNode = getSelectedVectorNode();
  const isBossEncounter =
    activeIncursion.bossProfile != null || runState.pendingEnemy?.isBoss === true;
  const nodeType = vectorNode?.type;
  const combatDepth = depthFromNodesCleared(runState.combatNodesCleared);
  const threatBudget = encounterBudgetForDepth({
    depth: combatDepth,
    isElite: nodeType === 'ELITE_COMBAT',
    isAmbush: runState.pendingAmbush,
  }).phaseBudget;
  const portraitSource = resolveCombatEnemyPortrait({
    isBoss: isBossEncounter,
    isVeilStalker: runState.pendingEnemy?.isVeilStalker === true,
    rosterId: runState.pendingEnemy?.rosterId,
    nodeType,
  });
  const portraitKey =
    `${runState.pendingEnemy?.designation ?? 'hostile'}`
    + `-${resolvePortraitKeySuffix({
      isBoss: isBossEncounter,
      isVeilStalker: runState.pendingEnemy?.isVeilStalker === true,
      rosterId: runState.pendingEnemy?.rosterId,
      nodeType,
    })}`
    + `-${activeIncursion.currentEncounterIndex}`
    + `-${runState.combatNodesCleared}`;

  const bootstrappedSquadUi = useMemo(
    () => buildInitialSquadUiSnapshot(combatSquad),
    [combatSquad],
  );
  const effectiveSquadUi = useMemo(() => {
    if (!squadUi || squadUi.units.length === 0) {
      return bootstrappedSquadUi;
    }
    return squadUi;
  }, [bootstrappedSquadUi, squadUi]);

  const gridUnits = useMemo(() => {
    const liveById = new Map(effectiveSquadUi.units.map((unit) => [unit.unitId, unit]));
    const baseUnits = bootstrappedSquadUi.units.length > 0
      ? bootstrappedSquadUi.units
      : effectiveSquadUi.units;

    return baseUnits
      .filter((unit) => {
        if (unit.dissolveHidden) return false;
        if (unit.currentHp > 0 && unit.maxHp > 0) return true;
        return (unit.dissolveSeq ?? 0) > 0;
      })
      .map((unit) => {
        const live = liveById.get(unit.unitId);
        const merged = live ? { ...unit, ...live } : unit;
        const portraitMeta = {
          isBoss: merged.isBoss,
          isVeilStalker: merged.isVeilStalker,
          class: merged.enemyClass ?? 'GREMLIN',
          rosterId: merged.rosterId,
        } as const;
        const portraitSource = resolveUnitCombatPortrait(portraitMeta, nodeType);
        return {
          ...merged,
          isDead: merged.currentHp <= 0,
          portraitSource,
          attackPortraitSource: resolveUnitCombatAttackPortrait(portraitMeta, portraitSource),
        };
      });
  }, [bootstrappedSquadUi.units, effectiveSquadUi.units, nodeType]);

  const showVictoryBanner = resolutionOutcome === 'VICTORY';

  const enemySquadPanel = (
    <CombatEnemyGrid
      variant="arena"
      layoutMode={arenaLayoutMode}
      arenaGridVariant="staggered"
      units={gridUnits}
      targetingActive={effectiveSquadUi.targetingActive}
      onUnitPress={handleEnemyUnitPress}
      onUnitDissolveComplete={handleUnitDissolveComplete}
      accentColor={theme.primaryColor}
      mutedColor={theme.mutedColor}
    />
  );

  const focusedPortraitSource = useMemo(() => {
    const focused = gridUnits.find((unit) => unit.isFocused && !unit.isDead)
      ?? gridUnits.find((unit) => unit.isSelected && !unit.isDead)
      ?? gridUnits.find((unit) => !unit.isDead);
    return focused?.portraitSource ?? portraitSource;
  }, [gridUnits, portraitSource]);

  const selectedEnemyUnit = useMemo(
    () => gridUnits.find((unit) => unit.isFocused && !unit.isDead)
      ?? gridUnits.find((unit) => unit.isSelected && !unit.isDead)
      ?? null,
    [gridUnits],
  );

  const combatBiomeId = useMemo(
    () => macroFamilyToBiomeId(activeIncursion.currentMacroBiomeFamily),
    [activeIncursion.currentMacroBiomeFamily],
  );
  const arenaBackgroundSource = useMemo(
    () => resolveCombatArenaBackground(combatBiomeId),
    [combatBiomeId],
  );
  const arenaBackgroundScrimColor = useMemo(
    () => resolveCombatArenaBackgroundScrim(combatBiomeId),
    [combatBiomeId],
  );

  const handleResolutionPanelChange = useCallback(
    (panel: { outcome: 'VICTORY' | 'DEFEAT'; onDismiss: () => void } | null) => {
      setResolutionOutcome(panel?.outcome ?? null);
      resolutionDismissRef.current = panel?.onDismiss ?? (() => {});
    },
    [],
  );

  const handleResolutionDismiss = useCallback(() => {
    resolutionDismissRef.current();
  }, []);

  const handleCombatComplete = useCallback((result: {
    victory: boolean;
    remainingHp: number;
    remainingStamina: number;
  }) => {
    if (runState.combatTestPreset) {
      exitCombatToBadge();
      goToHub();
      setTerminalView('BADGE');
      return;
    }

    if (!result.victory || result.remainingHp <= 0) {
      clearNarrativeBoonStatusEffects();
      endRun(result.remainingHp <= 0 ? 'SOUL ANCHOR DESTROYED' : 'OPERATIVE DEFEATED IN COMBAT');
      startGameOver();
      return;
    }

    syncAfterCombat(result.remainingHp, result.remainingStamina);
    clearEncounterUltimateDisabled();
    clearNarrativeBoonStatusEffects();

    if (activeIncursion.defendRiftActive) {
      completeDefendRiftVictory();
      startExtractionReview();
      return;
    }

    const vectorNode = getSelectedVectorNode();
    const isBossEncounter =
      activeIncursion.bossProfile != null || runState.pendingEnemy?.isBoss === true;
    const nodeType = vectorNode?.type;
    const depth = activeIncursion.nodesCleared + 1;
    const creditReward = isBossEncounter
      ? (isPrimeBossDepth(depth) ? primeBossKillCredits(depth) : districtBossKillCredits(depth))
      : nodeType === 'ELITE_COMBAT'
        ? eliteKillCredits(depth)
        : standardKillCredits(depth);
    const creditReason = isBossEncounter
      ? (isPrimeBossDepth(depth) ? 'prime anomaly eradicated' : 'district gate boss eradicated')
      : nodeType === 'ELITE_COMBAT'
        ? 'elite hostile eradicated'
        : 'hostile eradicated';

    awardRunCredits(creditReward, creditReason);
    const isGatekeeper = isBossEncounter && isDistrictGateDepth(depth);
    if (isGatekeeper) {
      const lockedTemplate = rollGatekeeperLockedTemplate(
        `gatekeeper:${depth}:${runState.pendingEnemy?.rosterId ?? 'unknown'}`,
      );
      addLockedContainer(lockedTemplate);
      appendRunLog('>> GATEKEEPER SALVAGE — sealed container routed to Safehouse decryption vault.');
    }
    const factionLoot = collectFactionTraitLoot(runState.pendingEnemies ?? []);
    const combatDropInstanceIds = grantCombatResourceDrops({
      depth,
      isElite: nodeType === 'ELITE_COMBAT',
      isGatekeeper,
      rosterId: runState.pendingEnemy?.rosterId,
      seed: `combat:${depth}:${nodeType ?? 'std'}:${runState.pendingEnemy?.rosterId ?? 'unknown'}`,
      extraLoot: factionLoot,
      slainEnemies: runState.pendingEnemies ?? [],
      rareLootBonusPct: activeIncursion.shadowWarBuffs?.rareLootBonusPct ?? 0,
    });
    if (adrenalinePrimerBonusAp > 0) {
      consumeAdrenalinePrimerAfterCombat();
    }

    if (runState.pendingAmbush) {
      clearPendingAmbush();
      incrementCombatNodesCleared();
      refillStaminaAfterCombat();

      const harvestRoute = activeIncursion.pendingHarvestReturn;
      if (harvestRoute === 'POST_COMBAT') {
        if (isPostCombatBoonBlocked()) {
          completeCurrentNode('Ambush repelled — Ley-Scar boon waived.', result.remainingHp);
          return;
        }
        startPostCombatBoon();
        return;
      }
      if (harvestRoute === 'COMPLETE_NODE') {
        completeCurrentNode('Ambush repelled — harvest secured.', result.remainingHp);
        return;
      }

      completeCurrentNode('Ambush repelled.', result.remainingHp);
      return;
    }

    incrementCombatNodesCleared();
    refillStaminaAfterCombat();

    if (isBossEncounter) {
      completeCurrentNode('Region-Prime checkpoint cleared.', result.remainingHp);
      return;
    }

    beginPostCombatHarvest(combatDropInstanceIds);

    if (isPostCombatBoonBlocked()) {
      startResourceHarvest();
      return;
    }

    startPostCombatBoon();
  }, [
    activeIncursion.bossProfile,
    activeIncursion.defendRiftActive,
    adrenalinePrimerBonusAp,
    awardRunCredits,
    grantCombatResourceDrops,
    consumeAdrenalinePrimerAfterCombat,
    addLockedContainer,
    appendRunLog,
    isPostCombatBoonBlocked,
    completeDefendRiftVictory,
    clearPendingAmbush,
    completeCurrentNode,
    endRun,
    exitCombatToBadge,
    getSelectedVectorNode,
    goToHub,
    incrementCombatNodesCleared,
    beginPostCombatHarvest,
    refillStaminaAfterCombat,
    runState.combatTestPreset,
    runState.pendingAmbush,
    runState.pendingEnemy?.isBoss,
    setTerminalView,
    startExtractionReview,
    startGameOver,
    startPostCombatBoon,
    startResourceHarvest,
    syncAfterCombat,
    clearNarrativeBoonStatusEffects,
    activeIncursion.pendingHarvestReturn,
  ]);

  return (
    <IncursionShell immersive>
      <StatusBar hidden translucent backgroundColor="transparent" />
      <CombatTurnProvider>
        <CombatEnemyChromeProvider>
        <CombatArenaOverlayProvider>
        <MacroLogAnchoredLayout
          showMacroLog={false}
          onConsumableUsed={handleConsumableUsed}
          onDeployCargoItem={handleDeployCargoItem}
          style={styles.combatRoot}
        >
          <View style={styles.landscapeRoot}>
            <View style={styles.landscapeColumn}>
              <CombatOperativeVitalsOverlay
                telemetry={operativeTelemetry}
                primaryColor={theme.primaryColor}
              />
              <CombatGlobalChrome />

              <TurnOrderSidebar
                turnOrder={squadUi?.turnOrder}
                gridUnits={gridUnits}
                operativeClass={operativeClass}
                primaryColor={theme.primaryColor}
                mutedColor={theme.mutedColor}
                selectedUnitId={selectedEnemyUnit?.unitId}
                onHostilePress={handleTurnOrderHostilePress}
              />

              <CombatJuiceHost style={styles.body}>
                <View style={styles.arenaPanel}>
                  <ImageBackground
                    source={arenaBackgroundSource}
                    style={styles.arenaBackground}
                    resizeMode="cover"
                  >
                    {arenaBackgroundScrimColor ? (
                      <View
                        style={[styles.arenaBackgroundScrim, { backgroundColor: arenaBackgroundScrimColor }]}
                        pointerEvents="none"
                      />
                    ) : null}
                  </ImageBackground>

                  <View style={styles.arenaForeground} pointerEvents="box-none">
                    <ParticleOverlay biomeId={combatBiomeId} />

                    <CombatLandscapeArena
                      apparitionRef={apparitionRef}
                      playerViewportRef={playerViewportRef}
                      portraitKey={portraitKey}
                      portraitSource={focusedPortraitSource}
                      operativeClass={operativeClass}
                      wardPrimed={wardPrimed}
                      abilityPrimed={abilityPrimed}
                      enemySquadPanel={enemySquadPanel}
                      augmentIcons={combatAugmentIcons}
                      gridUnits={gridUnits}
                      onEradicationComplete={handleEradicationComplete}
                    />

                    {showVictoryBanner ? (
                      <CombatResolutionBanner
                        outcome="VICTORY"
                        primaryColor="#00ff33"
                        defeatColor="#ef4444"
                        onDismiss={handleResolutionDismiss}
                      />
                    ) : null}
                  </View>
                </View>

                <CombatTacticalDashboard
                  commandDeck={(
                    <CombatDashboardCommandColumn>
                      <TacticalCombatHub
                      arenaGridVariant="staggered"
                      apparitionRef={apparitionRef}
                      playerViewportRef={playerViewportRef}
                      registerKillResolver={registerKillResolver}
                      registerDissolveCompleteHandler={registerDissolveCompleteHandler}
                      registerHealHandler={registerHealHandler}
                      registerConsumableHandler={registerConsumableHandler}
                      registerCanDeployCargoHandler={registerCanDeployCargoHandler}
                      registerTargetHandler={registerTargetHandler}
                      registerIntelTargetHandler={registerIntelTargetHandler}
                      onSquadUiChange={handleSquadUiChange}
                      onOperativeTelemetryChange={handleOperativeTelemetryChange}
                      enemySquad={combatSquad}
                      threatBudget={threatBudget}
                      combatDistrict={activeIncursion.currentDistrict}
                      onWardPrimedChange={setWardPrimed}
                      onAbilityPrimedChange={setAbilityPrimed}
                      onResolutionPanelChange={handleResolutionPanelChange}
                      onCombatComplete={handleCombatComplete}
                      onLethalEnemyStrike={recordRunKillAttacker}
                      onGraftLootDrop={(kind) => {
                        if (kind === 'CREDITS') {
                          awardRunCredits(standardKillCredits(activeIncursion.nodesCleared), 'Scavenger Bolt graft');
                        }
                      }}
                      runCredits={activeIncursion.runCredits}
                      initialOperativeHp={runState.soulAnchorIntegrity}
                      initialStamina={combatEntryStamina}
                      maxStamina={runState.maxStamina}
                      maxSoulAnchor={runState.maxSoulAnchor}
                      startingAbyssalReservePercent={runState.startingAbyssalReservePercent}
                      parryMultiplierBonus={runState.parryMultiplierBonus}
                      parryWindowBonus={runState.parryWindowBonus}
                      sliceDamagePenalty={runState.sliceDamagePenalty}
                      enemyProfile={runState.pendingEnemy}
                      nodeIndex={activeIncursion.currentEncounterIndex}
                      onTerminalLog={appendRunLog}
                      weaponCombatStats={weaponCombatStats}
                      environmentalModifiers={env}
                      bossProfile={activeIncursion.bossProfile}
                      onBossPhaseShift={shiftBossPhase}
                      aegisLoadout={activeIncursion.aegisLoadout}
                      hexShotLoadout={activeIncursion.hexShotLoadout}
                      envoyLoadout={activeIncursion.envoyLoadout}
                      leyLineMutations={activeIncursion.leyLineMutations}
                      hexShotBoons={activeIncursion.hexShotBoons}
                      envoyBoons={activeIncursion.envoyBoons}
                      firstTurnBonusAp={firstTurnBonusAp}
                      playerKineticArmorBonus={shadowWarKineticArmor}
                      kineticBatteryActive={kineticBatteryActive}
                      narrativeCombatBoons={narrativeCombatBoons}
                      equippedBlueprintId={account.equippedBlueprintId}
                      playerCritChanceBonus={playerCritChanceBonus}
                      onPlayerCritImpact={handlePlayerCritImpact}
                      godModeActive={activeIncursion.godModeActive}
                      abilityGrafts={activeIncursion.abilityGrafts}
                      hexShotAbilityGrafts={activeIncursion.hexShotAbilityGrafts}
                      envoyAbilityGrafts={activeIncursion.envoyAbilityGrafts}
                      encounterUltimateDisabled={activeIncursion.encounterUltimateDisabled}
                      operativeClass={operativeClass}
                    />
                    </CombatDashboardCommandColumn>
                  )}
                  macroLog={<CombatDashboardMacroLog />}
                  hostileIntel={(
                    <HostileIntelView
                      enemy={selectedEnemyUnit}
                      mutedColor={theme.mutedColor}
                    />
                  )}
                />
              </CombatJuiceHost>

              <CombatParryScreenOverlay />
            </View>
          </View>
        </MacroLogAnchoredLayout>
        </CombatArenaOverlayProvider>
        </CombatEnemyChromeProvider>
      </CombatTurnProvider>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  combatRoot: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  landscapeRoot: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0a0a0c',
  },
  landscapeColumn: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  },
  arenaPanel: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  arenaBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  arenaBackgroundScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  arenaForeground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});
