import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import CabalBg from '../../assets/images/location images/cabal.png';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import SelectionContinueButton from '../components/SelectionContinueButton';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import type { ClassType } from '../types/game';

const TERMINAL_ACCENT = '#00ff33';

const HEADER_LABEL: Record<ClassType, string> = {
  AEGIS: 'LEY-LINE MUTATION // SELECT ONE',
  HEX_SHOT: 'HEX-SHOT BOON // SELECT ONE',
  ENVOY: 'ENVOY BOON // SELECT ONE',
};

export default function PostCombatBoonScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    postCombatMutationChoices,
    preparePostCombatMutations,
    completeNodeAfterMutation,
    endRun,
  } = useRun();
  const { startGameOver, startResourceHarvest } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const selectingRef = useRef(false);
  const [selectedBoonId, setSelectedBoonId] = useState<string | null>(null);

  const mutationsPreparedRef = useRef(false);
  const activeClass = activeIncursion.activeClass ?? 'AEGIS';

  const advanceAfterBoon = useCallback((message: string) => {
    if (activeIncursion.pendingHarvestReturn === 'POST_COMBAT') {
      startResourceHarvest();
      return;
    }
    finalizeIncursionAdvance(message);
  }, [activeIncursion.pendingHarvestReturn, finalizeIncursionAdvance, startResourceHarvest]);

  useEffect(() => {
    if (postCombatMutationChoices.length === 0 && !mutationsPreparedRef.current) {
      mutationsPreparedRef.current = true;
      const choices = preparePostCombatMutations();
      if (choices.length === 0) {
        advanceAfterBoon('Boon acquisition blocked — node advance continues.');
      }
    }
  }, [
    advanceAfterBoon,
    postCombatMutationChoices.length,
    preparePostCombatMutations,
  ]);

  const handleContinue = () => {
    if (!selectedBoonId || selectingRef.current) return;
    selectingRef.current = true;

    if (runState.soulAnchorIntegrity <= 0) {
      endRun('SOUL ANCHOR DESTROYED');
      startGameOver();
      return;
    }

    const picked = postCombatMutationChoices.find((m) => m.id === selectedBoonId);
    completeNodeAfterMutation(selectedBoonId);
    advanceAfterBoon(`Class boon secured: ${picked?.name ?? selectedBoonId}.`);
  };

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.screenBody}>
          <Image source={CabalBg} style={styles.backgroundImage} resizeMode="cover" />
          <View style={styles.backgroundScrim} pointerEvents="none" />

          <View style={styles.body}>
            <View style={[styles.header, { borderColor: theme.borderColor }]}>
              <Text style={[styles.headerText, { color: theme.mutedColor }]}>
                {HEADER_LABEL[activeClass]}
              </Text>
            </View>
            <View style={styles.choices}>
              {postCombatMutationChoices.map((offer) => {
                const isSelected = selectedBoonId === offer.id;
                return (
                  <Pressable
                    key={offer.id}
                    onPress={() => !selectingRef.current && setSelectedBoonId(offer.id)}
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
                      {offer.tierLabel ?? offer.tier}
                    </Text>
                    <Text style={[styles.choiceName, { color: isSelected ? TERMINAL_ACCENT : theme.primaryColor }]}>
                      {offer.name}
                    </Text>
                    <Text style={[styles.choiceEffect, { color: theme.mutedColor }]}>{offer.effect}</Text>
                    <Text style={[styles.choiceDesc, { color: theme.primaryColor }]}>{offer.description}</Text>
                  </Pressable>
                );
              })}
              <SelectionContinueButton
                enabled={selectedBoonId != null && !selectingRef.current}
                onPress={handleContinue}
                borderColor={theme.borderColor}
                mutedColor={theme.mutedColor}
              />
            </View>
          </View>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  backgroundScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 6, 8, 0.78)',
  },
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
