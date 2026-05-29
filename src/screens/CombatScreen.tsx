import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import BlueprintSilhouette from '../components/BlueprintSilhouette';
import { useGameFlow } from '../context/GameFlowContext';
import { useTerminal } from '../context/TerminalContext';

export default function CombatScreen(): React.JSX.Element {
  const { goToWelcome } = useGameFlow();
  const { theme } = useTerminal();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BlueprintSilhouette onCombatComplete={goToWelcome} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
