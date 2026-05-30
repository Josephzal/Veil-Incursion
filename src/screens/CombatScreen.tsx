import React from 'react';
import { StyleSheet, View } from 'react-native';
import TacticalCombatHub from '../components/TacticalCombatHub';
import PersistentTerminalLog from '../components/PersistentTerminalLog';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
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
  } = useRun();
  const { completeCurrentNode } = useNodeProgression();

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

    if (runState.pendingAmbush) {
      clearPendingAmbush();
      incrementCombatNodesCleared();
      completeCurrentNode('Ambush repelled.', result.remainingHp);
      return;
    }

    incrementCombatNodesCleared();
    refillStaminaAfterCombat();
    preparePostCombatBoons();
    startPostCombatBoon();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.combatStage}>
        <View style={styles.hubWrapper}>
          <TacticalCombatHub
            onCombatComplete={handleCombatComplete}
            initialOperativeHp={runState.soulAnchorIntegrity}
            initialStamina={runState.currentStamina}
            maxStamina={runState.maxStamina}
            maxSoulAnchor={runState.maxSoulAnchor}
            startingKineticPercent={runState.startingKineticPercent}
            parryMultiplierBonus={runState.parryMultiplierBonus}
            parryWindowBonus={runState.parryWindowBonus}
            sliceDamagePenalty={runState.sliceDamagePenalty}
            enemyProfile={runState.pendingEnemy}
            nodeIndex={runState.pendingEncounter?.index ?? runState.currentNode}
            onTerminalLog={appendRunLog}
          />
        </View>
        <PersistentTerminalLog visible={runState.runActive} expanded />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  combatStage: {
    flex: 1,
    alignItems: 'stretch',
    paddingHorizontal: 8,
  },
  hubWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
});
