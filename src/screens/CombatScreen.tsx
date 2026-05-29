import React from 'react';
import { StyleSheet, View } from 'react-native';
import BlueprintSilhouette from '../components/BlueprintSilhouette';
import { useGameFlow } from '../context/GameFlowContext';
import { useTerminal } from '../context/TerminalContext';

export default function CombatScreen(): React.JSX.Element {
  const { goToWelcome } = useGameFlow();
  const { theme } = useTerminal();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.combatStage}>
        <BlueprintSilhouette onCombatComplete={goToWelcome} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  combatStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});
