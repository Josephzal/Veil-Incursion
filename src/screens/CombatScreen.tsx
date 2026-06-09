import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import {
  resolveCombatEnemyPortrait,
  resolvePortraitKeySuffix,
} from '../utils/combatEnemyPortrait';
import type { ApparitionViewportRef } from '../components/combat/ApparitionViewport';
import CombatArenaStage from '../components/combat/CombatArenaStage';
import CombatEnemyHeaderBand from '../components/combat/CombatEnemyHeaderBand';
import CombatOperativeHud from '../components/combat/CombatOperativeHud';
import CombatPlayerSliceOverlay from '../components/combat/CombatPlayerSliceOverlay';
import CombatResolutionBanner from '../components/combat/CombatResolutionBanner';
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
  RUN_CREDIT_BOSS_KILL,
  RUN_CREDIT_ELITE_KILL,
  RUN_CREDIT_STANDARD_KILL,
} from '../data/blackMarket';
import type { CombatEnemyTelemetry } from '../utils/combatTelemetryFormat';
import type { IncursionConsumableUseResult } from '../types/incursionInventory';

import AegisCombat from '../../assets/images/character images/aegis/aegis_combat.png';

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
  wardPrimed,
  onEradicationComplete,
  resolutionOutcome,
  onResolutionDismiss,
}: {
  apparitionRef: React.RefObject<ApparitionViewportRef | null>;
  playerViewportRef: React.RefObject<CombatPlayerViewportRef | null>;
  portraitKey: string;
  portraitSource: ReturnType<typeof resolveCombatEnemyPortrait>;
  wardPrimed: boolean;
  onEradicationComplete: () => void;
  resolutionOutcome: 'VICTORY' | 'DEFEAT' | null;
  onResolutionDismiss: () => void;
}): React.JSX.Element {
  const { ui } = useCombatEnemyChrome();

  return (
    <CombatArenaStage
      playerViewportRef={playerViewportRef}
      enemyViewportRef={apparitionRef}
      playerImageSource={AegisCombat}
      enemyImageSource={portraitSource}
      enemyPortraitKey={portraitKey}
      wardPrimed={wardPrimed}
      parryBlocksEnemyTouches={ui.parryVisible}
      onEradicationComplete={onEradicationComplete}
      resolutionBanner={
        resolutionOutcome === 'VICTORY' ? (
          <CombatResolutionBanner
            outcome="VICTORY"
            primaryColor="#00ff33"
            defeatColor="#ef4444"
            onDismiss={onResolutionDismiss}
          />
        ) : null
      }
    />
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
    endRun,
    exitCombatToBadge,
    refillStaminaAfterCombat,
    preparePostCombatBoons,
    clearPendingAmbush,
    incrementCombatNodesCleared,
    activeIncursion,
    shiftBossPhase,
    awardRunCredits,
    getSelectedVectorNode,
    beginPostCombatHarvest,
    completeDefendRiftVictory,
  } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const { getWeaponCombatStats } = usePlayerAccount();
  const weaponCombatStats = getWeaponCombatStats();
  const env = activeIncursion.environmentalModifiers;
  const combatEntryStamina =
    env.startingStaminaPenalty > 0 ? 50 : runState.currentStamina;

  const [enemyTelemetry, setEnemyTelemetry] = useState<CombatEnemyTelemetry | null>(null);
  const [operativeTelemetry, setOperativeTelemetry] = useState<CombatOperativeTelemetry | null>(null);
  const [wardPrimed, setWardPrimed] = useState(false);
  const [resolutionOutcome, setResolutionOutcome] = useState<'VICTORY' | 'DEFEAT' | null>(null);
  const resolutionDismissRef = useRef<() => void>(() => {});
  const apparitionRef = useRef<ApparitionViewportRef>(null);
  const playerViewportRef = useRef<CombatPlayerViewportRef>(null);
  const killResolverRef = useRef<() => void>(() => {});
  const healHandlerRef = useRef<(amount: number) => void>(() => {});
  const consumableHandlerRef = useRef<(result: IncursionConsumableUseResult) => void>(() => {});

  const handleEnemyTelemetryChange = useCallback((enemy: CombatEnemyTelemetry | null) => {
    setEnemyTelemetry(enemy);
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

  const handleConsumableUsed = useCallback((result: IncursionConsumableUseResult) => {
    consumableHandlerRef.current(result);
  }, []);

  const handleEradicationComplete = useCallback(() => {
    killResolverRef.current();
  }, []);

  const isBossEncounter =
    activeIncursion.bossProfile != null || runState.pendingEnemy?.isBoss === true;
  const nodeType = getSelectedVectorNode()?.type;
  const portraitSource = resolveCombatEnemyPortrait({
    isBoss: isBossEncounter,
    isVeilStalker: runState.pendingEnemy?.isVeilStalker === true,
    nodeType,
  });
  const portraitKey =
    `${runState.pendingEnemy?.designation ?? 'hostile'}`
    + `-${resolvePortraitKeySuffix({
      isBoss: isBossEncounter,
      isVeilStalker: runState.pendingEnemy?.isVeilStalker === true,
      nodeType,
    })}`
    + `-${activeIncursion.currentEncounterIndex}`
    + `-${runState.combatNodesCleared}`;

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
      endRun(result.remainingHp <= 0 ? 'SOUL ANCHOR DESTROYED' : 'OPERATIVE DEFEATED IN COMBAT');
      startGameOver();
      return;
    }

    syncAfterCombat(result.remainingHp, result.remainingStamina);

    if (activeIncursion.defendRiftActive) {
      completeDefendRiftVictory();
      startExtractionReview();
      return;
    }

    const isBossEncounter =
      activeIncursion.bossProfile != null || runState.pendingEnemy?.isBoss === true;
    const nodeType = getSelectedVectorNode()?.type;
    const creditReward = isBossEncounter
      ? RUN_CREDIT_BOSS_KILL
      : nodeType === 'ELITE_COMBAT'
        ? RUN_CREDIT_ELITE_KILL
        : RUN_CREDIT_STANDARD_KILL;
    const creditReason = isBossEncounter
      ? 'region-prime hostile eradicated'
      : nodeType === 'ELITE_COMBAT'
        ? 'elite hostile eradicated'
        : 'hostile eradicated';

    awardRunCredits(creditReward, creditReason);

    if (runState.pendingAmbush) {
      clearPendingAmbush();
      incrementCombatNodesCleared();
      refillStaminaAfterCombat();

      const harvestRoute = activeIncursion.pendingHarvestReturn;
      if (harvestRoute === 'POST_COMBAT') {
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

    beginPostCombatHarvest();
    startResourceHarvest();
  }, [
    activeIncursion.bossProfile,
    activeIncursion.defendRiftActive,
    awardRunCredits,
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
    activeIncursion.pendingHarvestReturn,
  ]);

  return (
    <IncursionShell>
      <CombatTurnProvider>
        <CombatEnemyChromeProvider>
        <MacroLogAnchoredLayout
          showMacroLog={runState.runActive}
          onConsumableUsed={handleConsumableUsed}
          style={styles.combatRoot}
        >
          <View style={styles.body}>
            <View style={styles.arenaStage}>
              <CombatArenaZone
                apparitionRef={apparitionRef}
                playerViewportRef={playerViewportRef}
                portraitKey={portraitKey}
                portraitSource={portraitSource}
                wardPrimed={wardPrimed}
                onEradicationComplete={handleEradicationComplete}
                resolutionOutcome={resolutionOutcome}
                onResolutionDismiss={handleResolutionDismiss}
              />

              {enemyTelemetry ? (
                <View style={[styles.enemyHudOverlay, { left: DECK_INSET, width: DECK_HALF }]}>
                  <CombatEnemyHeaderBand
                    enemy={enemyTelemetry}
                    intentMutedColor={theme.mutedColor}
                    arena
                  />
                </View>
              ) : null}

              <View style={[styles.playerHudOverlay, { right: DECK_INSET, width: DECK_HALF }]}>
                <CombatPlayerSliceOverlay />
                {operativeTelemetry ? (
                  <CombatOperativeHud telemetry={operativeTelemetry} deckAligned />
                ) : null}
              </View>
            </View>

            <View style={styles.combatMiddle}>
              <TacticalCombatHub
                stackedLayout
                arenaLayout
                apparitionRef={apparitionRef}
                playerViewportRef={playerViewportRef}
                registerKillResolver={registerKillResolver}
                registerHealHandler={registerHealHandler}
                registerConsumableHandler={registerConsumableHandler}
                onEnemyTelemetryChange={handleEnemyTelemetryChange}
                onOperativeTelemetryChange={handleOperativeTelemetryChange}
                onWardPrimedChange={setWardPrimed}
                onResolutionPanelChange={handleResolutionPanelChange}
                onCombatComplete={handleCombatComplete}
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
    overflow: 'hidden',
  },
  arenaStage: {
    flex: 1,
    flexShrink: 1,
    minHeight: ARENA_MIN_HEIGHT,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 6,
  },
  playerHudOverlay: {
    position: 'absolute',
    bottom: 6,
    zIndex: 8,
    alignItems: 'flex-end',
    gap: 2,
  },
  enemyHudOverlay: {
    position: 'absolute',
    top: 6,
    zIndex: 6,
  },
  combatMiddle: {
    flexShrink: 0,
    width: '100%',
    overflow: 'hidden',
    marginBottom: 8,
  },
});
