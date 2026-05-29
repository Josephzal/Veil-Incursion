import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PersistentTerminalLog from '../components/PersistentTerminalLog';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { PathChoice } from '../types/run';

const TERMINAL_ACCENT = '#00ff33';

export default function PathChoiceScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { runState, pathChoices, selectPathChoice } = useRun();
  const { proceedToEncounter } = useGameFlow();

  const handleSelect = (choice: PathChoice) => {
    selectPathChoice(choice);
    proceedToEncounter(choice.encounterType);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { borderColor: theme.borderColor }]}>
        <Text style={[styles.headerText, { color: theme.mutedColor }]}>
          NODE {runState.currentNode + 1}/{runState.totalNodes} // REGIONAL PATH MATRIX
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.primaryColor }]}>SELECT NEXT SECTOR</Text>
        <Text style={[styles.subtitle, { color: theme.mutedColor }]}>
          Clustered regional weighting active — {runState.homeRegion} bias 80%
        </Text>

        {pathChoices.map((choice) => (
          <Pressable
            key={choice.id}
            onPress={() => handleSelect(choice)}
            style={({ pressed }) => [
              styles.pathCard,
              { borderColor: TERMINAL_ACCENT, backgroundColor: pressed ? '#0d1a12' : '#0e1624' },
            ]}
          >
            <Text style={styles.pathType}>{choice.encounterType.replace('_', ' ')}</Text>
            <Text style={styles.pathSector}>{choice.sector.name}</Text>
            <Text style={[styles.pathSub, { color: TERMINAL_ACCENT }]}>{choice.sector.subsector}</Text>
            <Text style={[styles.pathLabel, { color: theme.mutedColor }]}>{choice.label}</Text>
          </Pressable>
        ))}
      </View>

      <PersistentTerminalLog />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  headerText: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.2, textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  title: { fontFamily: 'monospace', fontSize: 16, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  subtitle: { fontFamily: 'monospace', fontSize: 10, marginBottom: 20, lineHeight: 15 },
  pathCard: { borderWidth: 2, padding: 14, marginBottom: 12 },
  pathType: { fontFamily: 'monospace', fontSize: 8, color: '#888', letterSpacing: 1.2, marginBottom: 4 },
  pathSector: { fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: '#fff' },
  pathSub: { fontFamily: 'monospace', fontSize: 11, marginTop: 2, marginBottom: 6 },
  pathLabel: { fontFamily: 'monospace', fontSize: 9 },
});
