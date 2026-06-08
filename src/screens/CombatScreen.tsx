import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import EnemyPlaceholder from '../../assets/enemy images/enemy_placeholder.png';
import {
  ApparitionViewport,
  type ApparitionViewportRef,
} from '../components/combat/ApparitionViewport';
import CombatEnemyHeaderBand from '../components/combat/CombatEnemyHeaderBand';
import CombatResolutionBanner from '../components/combat/CombatResolutionBanner';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import TacticalCombatHub from '../components/TacticalCombatHub';
import {
  CombatEnemyChromeLayer,
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

const { height: SCREEN_HEIGHT } = Dimensions.get('screen');
/** Flexible middle band — grows/shrinks so the hub can dock above the macro log without clipping the descent HUD. */
const ENEMY_VIEWPORT_MIN_HEIGHT = Math.round(SCREEN_HEIGHT * 0.2);

function CombatApparitionZone({
  apparitionRef,
  portraitKey,
  onEradicationComplete,
  resolutionOutcome,
  onResolutionDismiss,
}: {
  apparitionRef: React.RefObject<ApparitionViewportRef | null>;
  portraitKey: string;
  onEradicationComplete: () => void;
  resolutionOutcome: 'VICTORY' | 'DEFEAT' | null;
  onResolutionDismiss: () => void;
}): React.JSX.Element {
  const { theme } = useTerminal();
  const { ui } = useCombatEnemyChrome();

  return (
    <View style={styles.apparitionViewport}>
      <ApparitionViewport
        key={portraitKey}
        ref={apparitionRef}
        imageSource={EnemyPlaceholder}
        style={styles.apparitionFill}
        pointerEvents={ui.parryVisible ? 'none' : 'auto'}
        onEradicationComplete={onEradicationComplete}
      />
      <CombatEnemyChromeLayer />
      {resolutionOutcome === 'VICTORY' ? (
        <CombatResolutionBanner
          outcome="VICTORY"
          primaryColor={theme.primaryColor}
          defeatColor="#ef4444"
          onDismiss={onResolutionDismiss}
        />
      ) : null}
    </View>
  );
}

export default function CombatScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { startPostCombatBoon, startGameOver, goToHub } = useGameFlow();
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
  } = useRun();
  const { completeCurrentNode } = useNodeProgression();
  const { getWeaponCombatStats } = usePlayerAccount();
  const weaponCombatStats = getWeaponCombatStats();
  const env = activeIncursion.environmentalModifiers;
  const combatEntryStamina =
    env.startingStaminaPenalty > 0 ? 50 : runState.currentStamina;

  const [enemyTelemetry, setEnemyTelemetry] = useState<CombatEnemyTelemetry | null>(null);
  const [resolutionOutcome, setResolutionOutcome] = useState<'VICTORY' | 'DEFEAT' | null>(null);
  const resolutionDismissRef = useRef<() => void>(() => {});
  const apparitionRef = useRef<ApparitionViewportRef>(null);
  const killResolverRef = useRef<() => void>(() => {});
  const healHandlerRef = useRef<(amount: number) => void>(() => {});
  const consumableHandlerRef = useRef<(result: IncursionConsumableUseResult) => void>(() => {});

  const handleEnemyTelemetryChange = useCallback((enemy: CombatEnemyTelemetry | null) => {
    setEnemyTelemetry(enemy);
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

  const portraitKey =
    `${runState.pendingEnemy?.designation ?? 'hostile'}`
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
      completeCurrentNode('Ambush repelled.', result.remainingHp);
      return;
    }

    incrementCombatNodesCleared();
    refillStaminaAfterCombat();

    if (isBossEncounter) {
      completeCurrentNode('Region-Prime checkpoint cleared.', result.remainingHp);
      return;
    }

    preparePostCombatBoons();
    startPostCombatBoon();
  }, [
    activeIncursion.bossProfile,
    awardRunCredits,
    clearPendingAmbush,
    completeCurrentNode,
    endRun,
    exitCombatToBadge,
    getSelectedVectorNode,
    goToHub,
    incrementCombatNodesCleared,
    preparePostCombatBoons,
    refillStaminaAfterCombat,
    runState.combatTestPreset,
    runState.pendingAmbush,
    runState.pendingEnemy?.isBoss,
    setTerminalView,
    startGameOver,
    startPostCombatBoon,
    syncAfterCombat,
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
            <CombatEnemyHeaderBand enemy={enemyTelemetry} intentMutedColor={theme.mutedColor} />

            <View style={styles.apparitionStage}>
              <CombatApparitionZone
                apparitionRef={apparitionRef}
                portraitKey={portraitKey}
                onEradicationComplete={handleEradicationComplete}
                resolutionOutcome={resolutionOutcome}
                onResolutionDismiss={handleResolutionDismiss}
              />
            </View>

            <View style={styles.combatMiddle}>
              <TacticalCombatHub
                stackedLayout
                apparitionRef={apparitionRef}
                registerKillResolver={registerKillResolver}
                registerHealHandler={registerHealHandler}
                registerConsumableHandler={registerConsumableHandler}
                onEnemyTelemetryChange={handleEnemyTelemetryChange}
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
  apparitionStage: {
    flex: 1,
    flexShrink: 1,
    minHeight: ENEMY_VIEWPORT_MIN_HEIGHT,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  apparitionViewport: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  apparitionFill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  combatMiddle: {
    flexShrink: 0,
    width: '100%',
    overflow: 'hidden',
    // Match DescentPipelineHUD rootCompact marginBottom (veil descent → enemy header).
    marginBottom: 8,
  },
});
