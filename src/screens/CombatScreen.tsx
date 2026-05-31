import React from 'react';
import { StyleSheet, View } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import TacticalCombatHub from '../components/TacticalCombatHub';
import PersistentTerminalLog from '../components/PersistentTerminalLog';
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
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.combatStage}>
          <View style={styles.hubWrapper}>
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
          <PersistentTerminalLog visible={runState.runActive} expanded />
        </View>
      </View>
    </IncursionShell>
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
