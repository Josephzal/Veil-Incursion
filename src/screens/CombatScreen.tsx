import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import EnemyPlaceholder from '../../assets/enemy images/enemy_placeholder.png';
import IncursionShell from '../components/IncursionShell';
import EncounterBiomeBanner from '../components/EncounterBiomeBanner';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import TacticalCombatHub from '../components/TacticalCombatHub';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useNodeProgression } from '../hooks/useNodeProgression';

export default function CombatScreen(): React.JSX.Element {
  const { startPostCombatBoon, startGameOver } = useGameFlow();
  const { theme } = useTerminal();
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

  const handleCombatComplete = (result: {
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
  };

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <EncounterBiomeBanner />
        <View style={styles.combatLayout}>
          <View style={styles.enemyViewport}>
            <Image
              source={EnemyPlaceholder}
              style={styles.enemyImage}
              resizeMode="contain"
              accessibilityLabel="Hostile signature placeholder"
            />
          </View>

          <View style={styles.combatConsole}>
            <TacticalCombatHub
              onCombatComplete={handleCombatComplete}
              initialOperativeHp={runState.soulAnchorIntegrity}
              initialStamina={combatEntryStamina}
              maxStamina={runState.maxStamina}
              maxSoulAnchor={runState.maxSoulAnchor}
              startingKineticPercent={runState.startingKineticPercent}
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
    </IncursionShell>
  );
}

const ENEMY_VIEWPORT_HEIGHT = 300;

const styles = StyleSheet.create({
  combatLayout: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 8,
    flexDirection: 'column',
  },
  enemyViewport: {
    width: '100%',
    height: ENEMY_VIEWPORT_HEIGHT,
    flexShrink: 0,
    backgroundColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyImage: {
    width: '100%',
    height: ENEMY_VIEWPORT_HEIGHT,
  },
  combatConsole: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});
