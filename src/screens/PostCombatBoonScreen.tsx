import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PersistentTerminalLog from '../components/PersistentTerminalLog';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { Trinket } from '../types/run';

const TERMINAL_ACCENT = '#00ff33';

export default function PostCombatBoonScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    postCombatBoonChoices,
    preparePostCombatBoons,
    completeNodeAfterBoon,
    appendRunLog,
    endRun,
    beginScanSession,
  } = useRun();
  const { startScanning, startRunComplete, startGameOver } = useGameFlow();
  const selectingRef = useRef(false);

  useEffect(() => {
    if (postCombatBoonChoices.length === 0) {
      preparePostCombatBoons();
    }
  }, [postCombatBoonChoices.length, preparePostCombatBoons]);

  const handleSelect = (trinket: Trinket) => {
    if (selectingRef.current) return;
    selectingRef.current = true;

    const clearedNodeNum = runState.currentNode + 1;
    appendRunLog(`>> Node ${clearedNodeNum} Clear. Post-combat boon: ${trinket.name}.`);

    if (runState.soulAnchorIntegrity <= 0) {
      endRun('SOUL ANCHOR DESTROYED');
      startGameOver();
      return;
    }

    const { route, nodesCleared } = completeNodeAfterBoon(trinket);

    if (route === 'RUN_COMPLETE') {
      appendRunLog('>> ALL NODES SECURED — RUN COMPLETE.');
      startRunComplete();
      return;
    }

    appendRunLog(`>> Anomaly sweep authorized — select route to Node ${nodesCleared + 1}.`);
    beginScanSession();
    startScanning();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { borderColor: theme.borderColor }]}>
        <Text style={[styles.headerText, { color: theme.mutedColor }]}>
          POST-COMBAT BOON // SELECT ONE REWARD
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.primaryColor }]}>COMBAT NODE CLEARED</Text>
        <Text style={[styles.subtitle, { color: theme.mutedColor }]}>
          Stamina fully replenished. Choose a tactical upgrade for the remainder of the run.
        </Text>

        {postCombatBoonChoices.map((trinket) => (
          <Pressable
            key={trinket.id}
            onPress={() => handleSelect(trinket)}
            style={({ pressed }) => [
              styles.boonCard,
              { borderColor: TERMINAL_ACCENT, backgroundColor: pressed ? '#0d1a12' : '#0e1624' },
            ]}
          >
            <Text style={styles.boonName}>{trinket.name}</Text>
            <Text style={[styles.boonDesc, { color: theme.mutedColor }]}>{trinket.description}</Text>
            <Text style={styles.boonEffect}>{trinket.effect}</Text>
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
  subtitle: { fontFamily: 'monospace', fontSize: 10, marginBottom: 24, lineHeight: 15 },
  boonCard: { borderWidth: 2, padding: 16, marginBottom: 12 },
  boonName: { fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: TERMINAL_ACCENT, marginBottom: 6 },
  boonDesc: { fontFamily: 'monospace', fontSize: 10, marginBottom: 6 },
  boonEffect: { fontFamily: 'monospace', fontSize: 10, color: TERMINAL_ACCENT },
});
