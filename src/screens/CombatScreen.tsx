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
import { useTerminal } from '../context/TerminalContext';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useNodeProgression } from '../hooks/useNodeProgression';
import type { CombatEnemyTelemetry } from '../utils/combatTelemetryFormat';

const { height: SCREEN_HEIGHT } = Dimensions.get('screen');
const ENEMY_VIEWPORT_HEIGHT = Math.round(SCREEN_HEIGHT * 0.37);

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
  const { startPostCombatBoon, startGameOver } = useGameFlow();
  const {
    runState,
    syncAfterCombat,
    appendRunLog,
    endRun,
    refillStaminaAfterCombat,
    preparePostCombatBoons,
    clearPendingAmbush,
    incrementCombatNodesCleared,
    activeIncursion,
    shiftBossPhase,
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

  const handleEnemyTelemetryChange = useCallback((enemy: CombatEnemyTelemetry | null) => {
    setEnemyTelemetry(enemy);
  }, []);

  const registerKillResolver = useCallback((resolver: () => void) => {
    killResolverRef.current = resolver;
  }, []);

  const handleEradicationComplete = useCallback(() => {
    killResolverRef.current();
  }, []);

  const portraitKey =
    `${runState.pendingEnemy?.designation ?? 'hostile'}`
    + `-${activeIncursion.currentNodeIndex}`
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
    if (!result.victory || result.remainingHp <= 0) {
      endRun(result.remainingHp <= 0 ? 'SOUL ANCHOR DESTROYED' : 'OPERATIVE DEFEATED IN COMBAT');
      startGameOver();
      return;
    }

    syncAfterCombat(result.remainingHp, result.remainingStamina);

    const isBossEncounter =
      activeIncursion.bossProfile != null || runState.pendingEnemy?.isBoss === true;

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
    clearPendingAmbush,
    completeCurrentNode,
    endRun,
    incrementCombatNodesCleared,
    preparePostCombatBoons,
    refillStaminaAfterCombat,
    runState.pendingAmbush,
    runState.pendingEnemy?.isBoss,
    startGameOver,
    startPostCombatBoon,
    syncAfterCombat,
  ]);

  return (
    <IncursionShell>
      <CombatEnemyChromeProvider>
        <MacroLogAnchoredLayout showMacroLog={runState.runActive} style={styles.combatRoot}>
          <View style={styles.body}>
            <CombatEnemyHeaderBand enemy={enemyTelemetry} intentMutedColor={theme.mutedColor} />

            <CombatApparitionZone
              apparitionRef={apparitionRef}
              portraitKey={portraitKey}
              onEradicationComplete={handleEradicationComplete}
              resolutionOutcome={resolutionOutcome}
              onResolutionDismiss={handleResolutionDismiss}
            />

            <View style={styles.combatMiddle}>
              <TacticalCombatHub
                stackedLayout
                apparitionRef={apparitionRef}
                registerKillResolver={registerKillResolver}
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
                nodeIndex={activeIncursion.currentNodeIndex}
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
  },
  apparitionViewport: {
    height: ENEMY_VIEWPORT_HEIGHT,
    maxHeight: ENEMY_VIEWPORT_HEIGHT,
    flexShrink: 0,
    flexGrow: 0,
    width: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
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
  },
});
