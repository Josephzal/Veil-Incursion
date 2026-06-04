import React from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import EnemyPlaceholder from '../../assets/enemy images/enemy_placeholder.png';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import TacticalCombatHub from '../components/TacticalCombatHub';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useNodeProgression } from '../hooks/useNodeProgression';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ENEMY_VIEWPORT_RATIO = 0.28;
const ENEMY_VIEWPORT_HEIGHT = Math.round(SCREEN_HEIGHT * ENEMY_VIEWPORT_RATIO);

export default function CombatScreen(): React.JSX.Element {
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
      <MacroLogAnchoredLayout showMacroLog={runState.runActive} style={styles.combatRoot}>
        <View style={styles.body}>
          <View
            style={[
              styles.enemyViewport,
              { height: ENEMY_VIEWPORT_HEIGHT, maxHeight: ENEMY_VIEWPORT_HEIGHT },
            ]}
          >
            <Image
              source={EnemyPlaceholder}
              style={styles.enemyImage}
              resizeMode="contain"
              accessibilityLabel="Hostile signature placeholder"
            />
          </View>

          <View style={styles.combatMiddle}>
            <TacticalCombatHub
              stackedLayout
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
  enemyViewport: {
    width: '100%',
    flexShrink: 0,
    flexGrow: 0,
    backgroundColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyImage: {
    width: '100%',
    height: '100%',
  },
  combatMiddle: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    overflow: 'hidden',
  },
});
