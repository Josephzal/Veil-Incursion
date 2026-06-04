import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { Trinket } from '../types/run';

const TERMINAL_ACCENT = '#00ff33';

export default function PostCombatBoonScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    postCombatBoonChoices,
    preparePostCombatBoons,
    completeNodeAfterBoon,
    endRun,
  } = useRun();
  const { startGameOver } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const selectingRef = useRef(false);

  const boonsPreparedRef = useRef(false);

  useEffect(() => {
    if (postCombatBoonChoices.length === 0 && !boonsPreparedRef.current) {
      boonsPreparedRef.current = true;
      preparePostCombatBoons();
    }
  }, [postCombatBoonChoices.length, preparePostCombatBoons]);

  const handleSelect = (trinket: Trinket) => {
    if (selectingRef.current) return;
    selectingRef.current = true;

    if (runState.soulAnchorIntegrity <= 0) {
      endRun('SOUL ANCHOR DESTROYED');
      startGameOver();
      return;
    }

    completeNodeAfterBoon(trinket);
    finalizeIncursionAdvance(`Post-combat boon secured: ${trinket.name}.`);
  };

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.body}>
          <View style={[styles.header, { borderColor: theme.borderColor }]}>
            <Text style={[styles.headerText, { color: theme.mutedColor }]}>
              POST-COMBAT BOON // SELECT TRINKET
            </Text>
          </View>
          <View style={styles.choices}>
            {postCombatBoonChoices.map((trinket) => (
              <Pressable
                key={trinket.id}
                onPress={() => handleSelect(trinket)}
                style={({ pressed }) => [
                  styles.choice,
                  { borderColor: TERMINAL_ACCENT, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.choiceName, { color: TERMINAL_ACCENT }]}>{trinket.name}</Text>
                <Text style={[styles.choiceEffect, { color: theme.mutedColor }]}>{trinket.effect}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0 },
  header: { borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  headerText: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 1.2, textAlign: 'center' },
  choices: { flex: 1, padding: 16, gap: 10 },
  choice: { borderWidth: 2, padding: 14 },
  choiceName: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  choiceEffect: { fontFamily: 'monospace', fontSize: 9 },
});
