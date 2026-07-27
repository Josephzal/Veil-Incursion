import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BoonsBg from '../../assets/images/location images/boons.png';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame from '../components/layout/RunEventScreenFrame';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import RunEventChoiceCard from '../components/layout/RunEventChoiceCard';
import TerminalOverlay from '../components/TerminalOverlay';
import RunActionRail from '../components/runField/RunActionRail';
import ClassBoonSwapOverlay from '../components/ClassBoonSwapOverlay';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useRunDeathFinalizer } from '../hooks/useRunDeathFinalizer';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import type { ClassType } from '../types/game';
import { MAX_LEY_MUTATIONS } from '../types/overworldFeatures';
import { VEIL } from '../theme/veilTerminalTokens';
import { RUN_FIELD } from '../theme/runFieldTokens';

const TERMINAL_ACCENT = VEIL.mint;

const HEADER_TITLE: Record<ClassType, string> = {
  AEGIS: 'LEY-LINE MUTATION',
  HEX_SHOT: 'HEX-SHOT BOON',
  ENVOY: 'ENVOY BOON',
};

export default function PostCombatBoonScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const {
    runState,
    activeIncursion,
    postCombatMutationChoices,
    preparePostCombatMutations,
    completeNodeAfterMutation,
    swapClassBoon,
    cancelClassBoonSwap,
  } = useRun();
  const { startResourceHarvest } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const { finalizeRunDeath } = useRunDeathFinalizer();
  const {
    isDesktop,
    fontScale,
    gap,
    scaleFont,
    scaleSpacing,
  } = useResponsiveLayout();

  const selectingRef = useRef(false);
  const swapAdvancePendingRef = useRef(false);
  const swapOverlayShownRef = useRef(false);
  const mutationsPreparedRef = useRef(false);
  const [selectedBoonId, setSelectedBoonId] = useState<string | null>(null);

  const activeClass = activeIncursion.activeClass ?? 'AEGIS';
  const pendingClassSwap = activeIncursion.pendingClassBoonSwap;
  const ownedClassBoons = activeClass === 'HEX_SHOT'
    ? activeIncursion.hexShotBoons
    : activeClass === 'ENVOY'
      ? activeIncursion.envoyBoons
      : activeIncursion.leyLineMutations;

  const cardPadding = isDesktop ? scaleSpacing(14) : scaleSpacing(10);
  const canContinue = selectedBoonId != null && !selectingRef.current && postCombatMutationChoices.length > 0;

  const headerSubtitle = useMemo(() => {
    const ownedCount = ownedClassBoons.length;
    const cap = MAX_LEY_MUTATIONS;
    return `Elite node cleared · Loadout ${ownedCount}/${cap}`;
  }, [ownedClassBoons.length]);

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
      finalizeRunDeath('SOUL ANCHOR DESTROYED');
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
      <IncursionRunLayout hideRunChrome style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventScreenFrame
          backgroundImage={BoonsBg}
          backgroundScrimOpacity={RUN_FIELD.environmentScrimDense}
          contentPadding={isDesktop ? scaleSpacing(16) : 8}
          overlay={<TerminalOverlay />}
        >
          <View style={styles.masterStage}>
            <RunEventNodeHeader
              eyebrow="VEIL RESPONSE"
              title={HEADER_TITLE[activeClass]}
              subtitle={headerSubtitle}
              fontScale={fontScale}
            />

            <View style={styles.offerWorkspace}>
              <View
                style={[
                  styles.spreadRow,
                  {
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap: Math.max(12, gap),
                  },
                ]}
              >
                {postCombatMutationChoices.map((offer) => (
                  <View
                    key={offer.id}
                    style={isDesktop ? styles.cardSlotDesktop : styles.cardSlotMobile}
                  >
                    <RunEventChoiceCard
                      tierTag={`VEIL BOON // ${String(offer.tierLabel ?? offer.tier).toUpperCase()}`}
                      name={offer.name}
                      tagline={offer.effect}
                      effectSummary={offer.description}
                      cardWidth="100%"
                      cardPadding={cardPadding}
                      isDesktop={isDesktop}
                      isSelected={selectedBoonId === offer.id}
                      isDimmed={selectedBoonId != null && selectedBoonId !== offer.id}
                      disabled={selectingRef.current}
                      borderColor={theme.borderColor}
                      textColor={theme.primaryColor}
                      mutedColor={theme.mutedColor}
                      fontScale={fontScale}
                      scaleFont={scaleFont}
                      onPress={() => setSelectedBoonId(offer.id)}
                      occult
                    />
                  </View>
                ))}
              </View>
            </View>

            <RunActionRail
              mode="screen"
              primaryLabel="SECURE BOON"
              onPrimary={handleContinue}
              primaryDisabled={!canContinue}
            />
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
  masterStage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    gap: 12,
    alignItems: 'stretch',
  },
  offerWorkspace: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    minHeight: 0,
  },
  spreadRow: {
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    flex: 1,
    maxHeight: 520,
  },
  cardSlotDesktop: {
    flex: 1,
    minWidth: 0,
    maxWidth: 360,
    alignSelf: 'stretch',
  },
  cardSlotMobile: {
    width: '100%',
    flex: 1,
  },
});
