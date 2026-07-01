import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import BoonsBg from '../../assets/images/location images/boons.png';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame, { RunEventScreenHeader } from '../components/layout/RunEventScreenFrame';
import SelectionContinueButton from '../components/SelectionContinueButton';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import ClassBoonSwapOverlay from '../components/ClassBoonSwapOverlay';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import type { ClassType } from '../types/game';
import { MAX_LEY_MUTATIONS } from '../types/overworldFeatures';

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
    swapClassBoon,
    cancelClassBoonSwap,
  } = useRun();
  const { startGameOver, startResourceHarvest } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const selectingRef = useRef(false);
  const swapAdvancePendingRef = useRef(false);
  const swapOverlayShownRef = useRef(false);
  const [selectedBoonId, setSelectedBoonId] = useState<string | null>(null);

  const mutationsPreparedRef = useRef(false);
  const activeClass = activeIncursion.activeClass ?? 'AEGIS';
  const pendingClassSwap = activeIncursion.pendingClassBoonSwap;
  const ownedClassBoons = activeClass === 'HEX_SHOT'
    ? activeIncursion.hexShotBoons
    : activeClass === 'ENVOY'
      ? activeIncursion.envoyBoons
      : [];

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

  useEffect(() => {
    if (pendingClassSwap != null) {
      swapOverlayShownRef.current = true;
    }
    if (
      swapAdvancePendingRef.current
      && swapOverlayShownRef.current
      && pendingClassSwap == null
    ) {
      swapAdvancePendingRef.current = false;
      swapOverlayShownRef.current = false;
      const picked = postCombatMutationChoices.find((m) => m.id === selectedBoonId);
      advanceAfterBoon(`Class boon secured: ${picked?.name ?? selectedBoonId ?? 'unknown'}.`);
    }
  }, [
    advanceAfterBoon,
    pendingClassSwap,
    postCombatMutationChoices,
    selectedBoonId,
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
    const atClassBoonCap = activeClass !== 'AEGIS' && ownedClassBoons.length >= MAX_LEY_MUTATIONS;
    completeNodeAfterMutation(selectedBoonId);
    if (atClassBoonCap) {
      swapAdvancePendingRef.current = true;
      return;
    }
    advanceAfterBoon(`Class boon secured: ${picked?.name ?? selectedBoonId}.`);
  };

  return (
    <IncursionShell>
      <IncursionRunLayout style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventScreenFrame
          backgroundImage={BoonsBg}
          backgroundScrimOpacity={0.75}
          contentPadding={8}
          header={(
            <RunEventScreenHeader
              title={HEADER_LABEL[activeClass]}
              borderColor={theme.borderColor}
              titleColor={theme.mutedColor}
            />
          )}
          footer={(
            <SelectionContinueButton
              enabled={selectedBoonId != null && !selectingRef.current}
              onPress={handleContinue}
              borderColor={theme.borderColor}
              mutedColor={theme.mutedColor}
              style={styles.continueBtn}
            />
          )}
        >
          <View style={styles.choiceRow}>
            {postCombatMutationChoices.map((offer) => {
              const isSelected = selectedBoonId === offer.id;
              return (
                <HapticPressable
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
                  <Text style={[styles.tierTag, { color: theme.mutedColor }]} numberOfLines={1}>
                    {offer.tierLabel ?? offer.tier}
                  </Text>
                  <Text
                    style={[styles.choiceName, { color: isSelected ? TERMINAL_ACCENT : theme.primaryColor }]}
                    numberOfLines={2}
                  >
                    {offer.name}
                  </Text>
                  <Text style={[styles.choiceEffect, { color: theme.mutedColor }]} numberOfLines={2}>
                    {offer.effect}
                  </Text>
                  <Text style={[styles.choiceDesc, { color: theme.primaryColor }]} numberOfLines={4}>
                    {offer.description}
                  </Text>
                </HapticPressable>
              );
            })}
          </View>
        </RunEventScreenFrame>
      </IncursionRunLayout>

      <ClassBoonSwapOverlay
        visible={pendingClassSwap != null && activeClass !== 'AEGIS'}
        classId={pendingClassSwap?.classId ?? activeClass}
        ownedBoonIds={ownedClassBoons}
        incomingBoonId={pendingClassSwap?.incomingBoonId ?? ''}
        theme={theme}
        accentColor={TERMINAL_ACCENT}
        onSwap={swapClassBoon}
        onCancel={cancelClassBoonSwap}
      />
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  choiceRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  choice: {
    flex: 1,
    minWidth: 0,
    borderWidth: 2,
    padding: 8,
    justifyContent: 'flex-start',
  },
  choiceSelected: { backgroundColor: 'rgba(0, 255, 51, 0.08)' },
  tierTag: { fontFamily: 'monospace', fontSize: 6, letterSpacing: 0.8, marginBottom: 2 },
  choiceName: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', marginBottom: 2, lineHeight: 11 },
  choiceEffect: { fontFamily: 'monospace', fontSize: 7, marginBottom: 2, lineHeight: 9 },
  choiceDesc: { fontFamily: 'monospace', fontSize: 7, lineHeight: 9 },
  continueBtn: { marginTop: 0, alignSelf: 'center', width: '100%', maxWidth: 320 },
});
