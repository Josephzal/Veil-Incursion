import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BoonsBg from '../../assets/images/location images/boons.png';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame from '../components/layout/RunEventScreenFrame';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import RunEventChoiceCard from '../components/layout/RunEventChoiceCard';
import TerminalOverlay from '../components/TerminalOverlay';
import TacticalButton from '../components/TacticalButton';
import ClassBoonSwapOverlay from '../components/ClassBoonSwapOverlay';
import { getFactionAccent } from '../data/factions';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { HUB_BORDER_INSET, hubCtaButtonStyle } from '../constants/hubCta';
import type { ClassType } from '../types/game';
import { MAX_LEY_MUTATIONS } from '../types/overworldFeatures';

const TERMINAL_ACCENT = '#00ff33';

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
    endRun,
    swapClassBoon,
    cancelClassBoonSwap,
  } = useRun();
  const { startGameOver, startResourceHarvest } = useGameFlow();
  const { finalizeIncursionAdvance } = useDescentNavigator();
  const {
    isDesktop,
    activeViewportWidth,
    fontScale,
    gap,
    scaleFont,
    scaleSize,
    scaleSpacing,
    deploymentStagingLaneWidth,
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

  const cabalAccent = getFactionAccent(account.alignedFaction);
  const boonCardWidth = isDesktop
    ? (activeViewportWidth - (gap * 4)) / 3
    : '100%';
  const cardPadding = isDesktop ? scaleSpacing(24) : scaleSpacing(12);
  const canContinue = selectedBoonId != null && !selectingRef.current && postCombatMutationChoices.length > 0;

  const continueButtonStyle = useMemo(
    () => [
      styles.continueBtn,
      { marginTop: scaleSpacing(48) },
      hubCtaButtonStyle(TERMINAL_ACCENT, scaleSize, scaleSpacing, !canContinue),
    ],
    [canContinue, scaleSize, scaleSpacing],
  );

  const headerSubtitle = useMemo(() => {
    const ownedCount = ownedClassBoons.length;
    const cap = MAX_LEY_MUTATIONS;
    return `ELITE NODE CLEARED // SELECT ONE OFFER // LOADOUT ${ownedCount}/${cap}`;
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
      <IncursionRunLayout hideRunChrome style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventScreenFrame
          backgroundImage={BoonsBg}
          backgroundScrimOpacity={0.75}
          contentPadding={isDesktop ? scaleSpacing(16) : 8}
          overlay={<TerminalOverlay />}
        >
          <View style={styles.masterStage}>
            <RunEventNodeHeader
              title={HEADER_TITLE[activeClass]}
              subtitle={headerSubtitle}
              fontScale={fontScale}
            />

            <View style={styles.spreadStage}>
              <View
                style={[
                  styles.spreadRow,
                  {
                    gap,
                    maxWidth: isDesktop ? activeViewportWidth : undefined,
                  },
                ]}
              >
                {postCombatMutationChoices.map((offer) => (
                  <RunEventChoiceCard
                    key={offer.id}
                    tierTag={`[ ${offer.tierLabel ?? offer.tier} ]`}
                    name={offer.name.toUpperCase()}
                    tagline={offer.effect}
                    effectSummary={offer.description}
                    cardWidth={boonCardWidth}
                    cardPadding={cardPadding}
                    isDesktop={isDesktop}
                    isSelected={selectedBoonId === offer.id}
                    isDimmed={selectedBoonId != null && selectedBoonId !== offer.id}
                    disabled={selectingRef.current}
                    accentColor={cabalAccent}
                    borderColor={theme.borderColor}
                    textColor={theme.primaryColor}
                    mutedColor={theme.mutedColor}
                    fontScale={fontScale}
                    scaleFont={scaleFont}
                    onPress={() => setSelectedBoonId(offer.id)}
                  />
                ))}
              </View>
            </View>

            <View
              style={[
                styles.ctaRail,
                isDesktop ? { maxWidth: deploymentStagingLaneWidth } : null,
              ]}
            >
              <TacticalButton
                label="[ SECURE BOON ]"
                active={canContinue}
                onPress={handleContinue}
                accentColor={TERMINAL_ACCENT}
                mutedColor={theme.mutedColor}
                variant="cta"
                style={continueButtonStyle}
              />
            </View>
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
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  spreadStage: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 0,
  },
  spreadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    width: '100%',
  },
  continueBtn: {
    flexShrink: 0,
  },
  ctaRail: {
    width: '100%',
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 8,
    paddingHorizontal: HUB_BORDER_INSET,
  },
});
