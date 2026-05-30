import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BlueprintSilhouette from '../components/BlueprintSilhouette';
import PersistentTerminalLog from '../components/PersistentTerminalLog';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useNodeProgression } from '../hooks/useNodeProgression';

type CombatPhase = 'TEXT_COMBAT' | 'DEFEND_PARRY' | 'OFFENSE_SLICE' | 'RESOLUTION';

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
  const [cyclePhase, setCyclePhase] = useState<CombatPhase>('TEXT_COMBAT');

  const hideMacroLog = cyclePhase === 'DEFEND_PARRY' || cyclePhase === 'OFFENSE_SLICE';

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

    syncAfterCombat(result.remainingHp);

    // Skill-check ambush fights skip the post-combat boon and advance immediately.
    if (runState.pendingAmbush) {
      clearPendingAmbush();
      incrementCombatNodesCleared();
      completeCurrentNode('Ambush repelled.', result.remainingHp);
      return;
    }

    // Standard combat victory: boon reward first, then node advance + path selection.
    incrementCombatNodesCleared();
    refillStaminaAfterCombat();
    preparePostCombatBoons();
    startPostCombatBoon();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.combatStage}>
        <View style={styles.hubWrapper}>
          <BlueprintSilhouette
            onCombatComplete={handleCombatComplete}
            onCycleStateChange={setCyclePhase}
            initialOperativeHp={runState.soulAnchorIntegrity}
            initialStamina={runState.currentStamina}
            maxStamina={runState.maxStamina}
            maxSoulAnchor={runState.maxSoulAnchor}
            startingKineticPercent={runState.startingKineticPercent}
            parryMultiplierBonus={runState.parryMultiplierBonus}
            parryWindowBonus={runState.parryWindowBonus}
            sliceDamagePenalty={runState.sliceDamagePenalty}
            onTerminalLog={appendRunLog}
          />
        </View>
        <PersistentTerminalLog visible={runState.runActive && !hideMacroLog} expanded />
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
