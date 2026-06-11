import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import SelectionContinueButton from '../components/SelectionContinueButton';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import type { LeyLineMutationDefinition, LeyLineMutationId } from '../types/leyLineMutation';

const TERMINAL_ACCENT = '#00ff33';

const TIER_LABEL: Record<string, string> = {
  KINETIC: 'TIER 1 // KINETIC',
  OCCULT: 'TIER 2 // OCCULT',
  SYSTEM: 'TIER 3 // SYSTEM',
  AP_BOOST: 'TIER 4 // AP BOOST',
};

export default function PostCombatBoonScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    postCombatMutationChoices,
    preparePostCombatMutations,
    completeNodeAfterMutation,
    endRun,
  } = useRun();
  const { startGameOver } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const selectingRef = useRef(false);
  const [selectedMutationId, setSelectedMutationId] = useState<LeyLineMutationId | null>(null);

  const mutationsPreparedRef = useRef(false);

  useEffect(() => {
    if (postCombatMutationChoices.length === 0 && !mutationsPreparedRef.current) {
      mutationsPreparedRef.current = true;
      preparePostCombatMutations();
    }
  }, [postCombatMutationChoices.length, preparePostCombatMutations]);

  const handleContinue = () => {
    if (!selectedMutationId || selectingRef.current) return;
    selectingRef.current = true;

    if (runState.soulAnchorIntegrity <= 0) {
      endRun('SOUL ANCHOR DESTROYED');
      startGameOver();
      return;
    }

    const picked = postCombatMutationChoices.find((m) => m.id === selectedMutationId);
    completeNodeAfterMutation(selectedMutationId);
    finalizeIncursionAdvance(`Ley-Line mutation secured: ${picked?.name ?? selectedMutationId}.`);
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
              LEY-LINE MUTATION // SELECT ONE
            </Text>
          </View>
          <View style={styles.choices}>
            {postCombatMutationChoices.map((mutation: LeyLineMutationDefinition) => {
              const isSelected = selectedMutationId === mutation.id;
              return (
                <Pressable
                  key={mutation.id}
                  onPress={() => !selectingRef.current && setSelectedMutationId(mutation.id)}
                  disabled={selectingRef.current}
                  style={({ pressed }) => [
                    styles.choice,
                    isSelected && styles.choiceSelected,
                    {
                      borderColor: isSelected ? TERMINAL_ACCENT : theme.borderColor,
                      opacity: selectingRef.current && !isSelected ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.tierTag, { color: theme.mutedColor }]}>
                    {TIER_LABEL[mutation.tier] ?? mutation.tier}
                  </Text>
                  <Text style={[styles.choiceName, { color: isSelected ? TERMINAL_ACCENT : theme.primaryColor }]}>
                    {mutation.name}
                  </Text>
                  <Text style={[styles.choiceEffect, { color: theme.mutedColor }]}>{mutation.effect}</Text>
                  <Text style={[styles.choiceDesc, { color: theme.primaryColor }]}>{mutation.description}</Text>
                </Pressable>
              );
            })}
            <SelectionContinueButton
              enabled={selectedMutationId != null && !selectingRef.current}
              onPress={handleContinue}
              borderColor={theme.borderColor}
              mutedColor={theme.mutedColor}
            />
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
  choiceSelected: { backgroundColor: 'rgba(0, 255, 51, 0.08)' },
  tierTag: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 1, marginBottom: 4 },
  choiceName: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  choiceEffect: { fontFamily: 'monospace', fontSize: 8, marginBottom: 4 },
  choiceDesc: { fontFamily: 'monospace', fontSize: 8, lineHeight: 12 },
});
