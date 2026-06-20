import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View, Dimensions, type ImageSourcePropType } from 'react-native';
import {
  resolveCombatEnemyPortrait,
  resolvePortraitKeySuffix,
  resolveUnitCombatAttackPortrait,
  resolveUnitCombatPortrait,
} from '../utils/combatEnemyPortrait';
import type { ApparitionViewportRef } from '../components/combat/ApparitionViewport';
import CombatArenaStage from '../components/combat/CombatArenaStage';
import CombatEnemyGrid from '../components/combat/CombatEnemyGrid';
import { resolveArenaLayoutMode } from '../components/combat/combatEnemyBarLayout';
import CombatEviscerateCinematic from '../components/combat/CombatEviscerateCinematic';
import CombatOperativeHud from '../components/combat/CombatOperativeHud';
import CombatParryScreenOverlay from '../components/combat/CombatParryScreenOverlay';
import CombatResolutionBanner from '../components/combat/CombatResolutionBanner';
import CombatSelectedEnemyIntel from '../components/combat/CombatSelectedEnemyIntel';
import StatusEffectTray from '../components/combat/StatusEffectTray';
import ParticleOverlay from '../components/atmosphere/ParticleOverlay';
import { macroFamilyToBiomeId } from '../constants/biomeConfig';
import {
  resolveCombatArenaBackground,
  resolveCombatArenaBackgroundScrim,
} from '../constants/combatArenaBackground';
import { pulseCombatTargetSelect } from '../utils/hubButtonHaptics';
import type { CombatOperativeTelemetry } from '../components/combat/CombatOperativeHud';
import type { CombatPlayerViewportRef } from '../components/combat/CombatPlayerViewport';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import TacticalCombatHub from '../components/TacticalCombatHub';
import {
  CombatEnemyChromeProvider,
  useCombatEnemyChrome,
} from '../context/CombatEnemyChromeContext';
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

import {
  resolvePlayerCombatAttackPortrait,
  resolvePlayerCombatIdlePortrait,
} from '../utils/combatPlayerPortrait';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('screen');
const ARENA_MIN_HEIGHT = Math.round(SCREEN_HEIGHT * 0.28);
/** Matches TacticalCombatHub rootStacked horizontal inset. */
const DECK_INSET = 8;
const DECK_WIDTH = SCREEN_WIDTH - 16;
const DECK_HALF = DECK_WIDTH / 2;

function CombatArenaZone({
  apparitionRef,
  playerViewportRef,
  portraitKey,
  portraitSource,
  operativeClass,
  wardPrimed,
  abilityPrimed,
  enemySquadPanel,
  gridUnits,
  onEradicationComplete,
}: {
  apparitionRef: React.RefObject<ApparitionViewportRef | null>;
  playerViewportRef: React.RefObject<CombatPlayerViewportRef | null>;
  portraitKey: string;
  portraitSource: ReturnType<typeof resolveCombatEnemyPortrait>;
  operativeClass: import('../types/game').ClassType;
  wardPrimed: boolean;
  abilityPrimed: boolean;
  enemySquadPanel?: React.ReactNode;
  gridUnits: Array<{ unitId: string; portraitSource: ImageSourcePropType }>;
  onEradicationComplete: () => void;
}): React.JSX.Element {
  const { ui } = useCombatEnemyChrome();
  const eviscerateTargetPortrait = useMemo(() => {
    if (!ui.eviscerateTargetUnitId) return null;
    return gridUnits.find((unit) => unit.unitId === ui.eviscerateTargetUnitId)?.portraitSource ?? null;
  }, [gridUnits, ui.eviscerateTargetUnitId]);

  return (
    <>
      <CombatArenaStage
        playerViewportRef={playerViewportRef}
        enemyViewportRef={apparitionRef}
        playerImageSource={resolvePlayerCombatIdlePortrait(operativeClass)}
        playerAttackImageSource={resolvePlayerCombatAttackPortrait(operativeClass)}
        enemyImageSource={portraitSource}
        enemyPortraitKey={portraitKey}
        wardPrimed={wardPrimed}
        abilityPrimed={abilityPrimed}
        enemySquadPanel={enemySquadPanel}
        parryBlocksEnemyTouches={ui.parryVisible}
        onEradicationComplete={onEradicationComplete}
      />
      <CombatEviscerateCinematic targetPortrait={eviscerateTargetPortrait} />
    </>
  );
}

export default function CombatScreen(): React.JSX.Element {
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
  const dissolveCompleteRef = useRef<(unitId: string) => void>(() => {});
  const arenaShakeX = useRef(new Animated.Value(0)).current;
  const arenaShakeY = useRef(new Animated.Value(0)).current;

  const handlePlayerCritImpact = useCallback(() => {
    arenaShakeX.setValue(0);
    arenaShakeY.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(arenaShakeX, { toValue: 22, duration: 40, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(arenaShakeX, { toValue: -18, duration: 35, useNativeDriver: true }),
        Animated.timing(arenaShakeX, { toValue: 14, duration: 30, useNativeDriver: true }),
        Animated.timing(arenaShakeX, { toValue: -8, duration: 28, useNativeDriver: true }),
        Animated.timing(arenaShakeX, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(arenaShakeY, { toValue: -10, duration: 40, useNativeDriver: true }),
        Animated.timing(arenaShakeY, { toValue: 8, duration: 35, useNativeDriver: true }),
        Animated.timing(arenaShakeY, { toValue: 0, duration: 70, useNativeDriver: true }),
      ]),
    ]).start();
  }, [arenaShakeX, arenaShakeY]);

  const handleSquadUiChange = useCallback((snapshot: CombatSquadUiSnapshot) => {
    setSquadUi(snapshot);
  }, []);

  const registerTargetHandler = useCallback((handler: (unitId: string) => void) => {
    targetHandlerRef.current = handler;
  }, []);

  const handleEnemyUnitPress = useCallback((unitId: string) => {
    pulseCombatTargetSelect();
    targetHandlerRef.current(unitId);
  }, []);

  const handleOperativeTelemetryChange = useCallback((telemetry: CombatOperativeTelemetry | null) => {
    setOperativeTelemetry(telemetry);
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
    () => gridUnits.find((unit) => unit.isSelected && !unit.isDead) ?? null,
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

  const spectralSaltActive = activeIncursion.spectralWeaponImbued === true;

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
    <IncursionShell>
      <CombatTurnProvider>
        <CombatEnemyChromeProvider>
        <MacroLogAnchoredLayout
          showMacroLog={runState.runActive}
          onConsumableUsed={handleConsumableUsed}
          onDeployCargoItem={handleDeployCargoItem}
          style={styles.combatRoot}
        >
          <View style={styles.body}>
            <Animated.View
              style={[
                styles.arenaStage,
                {
                  transform: [
                    { translateX: arenaShakeX },
                    { translateY: arenaShakeY },
                  ],
                },
              ]}
            >
              <Image source={arenaBackgroundSource} style={styles.arenaBackground} resizeMode="cover" />
              {arenaBackgroundScrimColor ? (
                <View
                  style={[styles.arenaBackgroundScrim, { backgroundColor: arenaBackgroundScrimColor }]}
                  pointerEvents="none"
                />
              ) : null}
              <ParticleOverlay biomeId={combatBiomeId} />

              {selectedEnemyUnit ? (
                <View style={styles.enemyIntelOverlay} pointerEvents="box-none">
                  <CombatSelectedEnemyIntel
                    unit={selectedEnemyUnit}
                    mutedColor={theme.mutedColor}
                  />
                  <StatusEffectTray activeStatuses={selectedEnemyUnit.activeStatuses ?? []} />
                </View>
              ) : null}

              <CombatArenaZone
                apparitionRef={apparitionRef}
                playerViewportRef={playerViewportRef}
                portraitKey={portraitKey}
                portraitSource={focusedPortraitSource}
                operativeClass={activeIncursion.activeClass ?? account.activeClass}
                wardPrimed={wardPrimed}
                abilityPrimed={abilityPrimed}
                enemySquadPanel={enemySquadPanel}
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

              {operativeTelemetry ? (
                <View style={[styles.playerHudOverlay, { right: DECK_INSET, width: DECK_HALF }]}>
                  <CombatOperativeHud telemetry={operativeTelemetry} deckAligned />
                </View>
              ) : null}
            </Animated.View>

            <CombatParryScreenOverlay />

            <View style={styles.combatMiddle}>
              <TacticalCombatHub
                stackedLayout
                arenaLayout
                apparitionRef={apparitionRef}
                playerViewportRef={playerViewportRef}
                registerKillResolver={registerKillResolver}
                registerDissolveCompleteHandler={registerDissolveCompleteHandler}
                registerHealHandler={registerHealHandler}
                registerConsumableHandler={registerConsumableHandler}
                registerCanDeployCargoHandler={registerCanDeployCargoHandler}
                registerTargetHandler={registerTargetHandler}
                onSquadUiChange={handleSquadUiChange}
                enemySquad={combatSquad}
                threatBudget={threatBudget}
                onEnemyTelemetryChange={undefined}
                combatDistrict={activeIncursion.currentDistrict}
                onOperativeTelemetryChange={handleOperativeTelemetryChange}
                onWardPrimedChange={setWardPrimed}
                onAbilityPrimedChange={setAbilityPrimed}
                onResolutionPanelChange={handleResolutionPanelChange}
                onCombatComplete={handleCombatComplete}
                onLethalEnemyStrike={recordRunKillAttacker}
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
                spectralSaltActive={spectralSaltActive}
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
                operativeClass={activeIncursion.activeClass ?? account.activeClass}
              />
            </View>
          </View>
        </MacroLogAnchoredLayout>
        </CombatEnemyChromeProvider>
      </CombatTurnProvider>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  combatRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  body: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
    position: 'relative',
  },
  arenaStage: {
    flex: 1,
    flexShrink: 1,
    minHeight: ARENA_MIN_HEIGHT,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
  },
  arenaBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  arenaBackgroundScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  enemyIntelOverlay: {
    position: 'absolute',
    top: 6,
    left: DECK_INSET,
    right: DECK_INSET,
    zIndex: 12,
    alignItems: 'flex-start',
  },
  playerHudOverlay: {
    position: 'absolute',
    bottom: 0,
    zIndex: 8,
    alignItems: 'stretch',
  },
  combatMiddle: {
    flexShrink: 0,
    width: '100%',
    overflow: 'hidden',
    marginBottom: 4,
  },
});
