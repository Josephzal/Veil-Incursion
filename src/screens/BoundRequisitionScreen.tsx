import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame from '../components/layout/RunEventScreenFrame';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import TerminalOverlay from '../components/TerminalOverlay';
import TacticalButton from '../components/TacticalButton';
import BoonsBg from '../../assets/images/location images/boons.png';
import { tierLabel, getBoundRequisitionDefinition } from '../data/boundRequisitions';
import { getBoundRequisitionLevel } from '../data/boundRequisitionProgression';
import { getFactionAccent } from '../data/factions';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { HUB_BORDER_INSET, hubCtaButtonStyle } from '../constants/hubCta';
import type { BoundRequisitionDefinition, BoundRequisitionId } from '../types/boundRequisition';
import { viewShadow } from '../utils/adaptiveStyles';
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';

const TERMINAL_ACCENT = '#00ff33';
const CARD_ASPECT_RATIO = 0.65;

interface RequisitionChoiceCardProps {
  offer: BoundRequisitionDefinition;
  cardWidth: number | '100%';
  cardPadding: number;
  isDesktop: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  confirming: boolean;
  cabalAccent: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  fontScale: number;
  scaleFont: (base: number) => number;
  onSelect: (id: BoundRequisitionId) => void;
}

function RequisitionChoiceCard({
  offer,
  cardWidth,
  cardPadding,
  isDesktop,
  isSelected,
  isDimmed,
  confirming,
  cabalAccent,
  borderColor,
  textColor,
  mutedColor,
  fontScale,
  scaleFont,
  onSelect,
}: RequisitionChoiceCardProps): React.JSX.Element {
  const isMandate = offer.kind === 'CABAL_MANDATE';
  const tierText = isMandate ? 'CABAL MANDATE' : tierLabel(offer.tier);
  const selectedBorder = isMandate && offer.cabal
    ? getFactionAccent(offer.cabal)
    : cabalAccent;

  const cardFrameStyle: ViewStyle = isDesktop && typeof cardWidth === 'number'
    ? { width: cardWidth, aspectRatio: CARD_ASPECT_RATIO }
    : { width: '100%', minHeight: scaleFont(220) };

  return (
    <HapticPressable
      onPress={() => !confirming && onSelect(offer.id)}
      disabled={confirming}
      style={(state) => {
        const hovered = readPressableHover(state);
        return [
          styles.choiceCard,
          cardFrameStyle,
          {
            padding: cardPadding,
            borderColor: isSelected ? selectedBorder : borderColor,
            borderWidth: isSelected ? 2 : 1,
            backgroundColor: isSelected
              ? 'rgba(8, 12, 20, 0.88)'
              : 'rgba(0, 0, 0, 0.6)',
            opacity: isDimmed ? 0.4 : 1,
            transform: isSelected ? [{ scale: 1.02 }] : undefined,
          },
          isSelected
            ? viewShadow({
              color: selectedBorder,
              opacity: 0.9,
              radius: 16,
              offset: { width: 0, height: 0 },
            })
            : null,
          isSelected
            ? { cursor: 'pointer' as const }
            : terminalHoverStyle(hovered, state.pressed),
        ];
      }}
    >
      <View style={styles.cardHeader}>
        <Text
          style={[
            styles.tierTag,
            {
              color: mutedColor,
              fontSize: 6 * fontScale,
              lineHeight: 9 * fontScale,
            },
          ]}
          numberOfLines={1}
        >
          {`[ ${tierText} ]`}
        </Text>
        <Text
          style={[
            styles.choiceName,
            {
              color: isSelected ? selectedBorder : textColor,
              fontSize: 11 * fontScale,
              lineHeight: 14 * fontScale,
            },
          ]}
          numberOfLines={2}
        >
          {offer.name.toUpperCase()}
        </Text>
        <Text
          style={[
            styles.choiceTagline,
            {
              color: mutedColor,
              fontSize: 7 * fontScale,
              lineHeight: 10 * fontScale,
            },
          ]}
          numberOfLines={2}
        >
          {offer.tagline}
        </Text>
      </View>

      <View style={styles.visualAnchor} />

      <View style={styles.cardDescription}>
        <Text
          style={[
            styles.choiceEffect,
            {
              color: textColor,
              fontSize: 8 * fontScale,
              lineHeight: 12 * fontScale,
            },
          ]}
        >
          {offer.effectSummary}
        </Text>
        {offer.tradeoffSummary ? (
          <Text
            style={[
              styles.choiceTradeoff,
              {
                fontSize: 7 * fontScale,
                lineHeight: 11 * fontScale,
              },
            ]}
            numberOfLines={3}
          >
            {`TRADE-OFF: ${offer.tradeoffSummary}`}
          </Text>
        ) : null}
      </View>
    </HapticPressable>
  );
}

export default function BoundRequisitionScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const {
    boundRequisitionOffers,
    prepareBoundRequisitionOffers,
    confirmBoundRequisition,
    beginScanSession,
  } = useRun();
  const { startScanning } = useGameFlow();
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
  const [selectedId, setSelectedId] = useState<BoundRequisitionId | null>(null);
  const [confirming, setConfirming] = useState(false);

  const requisitionLevel = getBoundRequisitionLevel(account);
  const cabalAccent = getFactionAccent(account.alignedFaction);

  const reqCardWidth = isDesktop
    ? (activeViewportWidth - (gap * 4)) / 3
    : '100%';

  const cardPadding = isDesktop ? scaleSpacing(24) : scaleSpacing(12);
  const canContinue = selectedId != null && !confirming && boundRequisitionOffers.length > 0;

  const continueButtonStyle = useMemo(
    () => [
      styles.continueBtn,
      { marginTop: scaleSpacing(48) },
      hubCtaButtonStyle(TERMINAL_ACCENT, scaleSize, scaleSpacing, !canContinue),
    ],
    [canContinue, scaleSize, scaleSpacing],
  );

  const headerSubtitle = useMemo(() => {
    const base = `RANK ${account.operativeRank} // TIER ${requisitionLevel} // SELECT ONE OFFER`;
    if (account.craftedAugments.length === 0) return base;
    const passives = account.craftedAugments
      .map((id) => getBoundRequisitionDefinition(id).name)
      .join(' // ');
    return `${base} // FORGE PASSIVES: ${passives}`;
  }, [account.craftedAugments, account.operativeRank, requisitionLevel]);

  useEffect(() => {
    if (boundRequisitionOffers.length === 0) {
      prepareBoundRequisitionOffers(account);
    }
  }, [account, boundRequisitionOffers.length, prepareBoundRequisitionOffers]);

  const handleContinue = () => {
    if (!selectedId || confirming) return;
    setConfirming(true);
    confirmBoundRequisition(selectedId, account.craftedAugments);
    beginScanSession();
    startScanning();
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
              title="BOUND REQUISITION"
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
                {boundRequisitionOffers.map((offer) => (
                  <RequisitionChoiceCard
                    key={offer.id}
                    offer={offer}
                    cardWidth={reqCardWidth}
                    cardPadding={cardPadding}
                    isDesktop={isDesktop}
                    isSelected={selectedId === offer.id}
                    isDimmed={selectedId != null && selectedId !== offer.id}
                    confirming={confirming}
                    cabalAccent={cabalAccent}
                    borderColor={theme.borderColor}
                    textColor={theme.primaryColor}
                    mutedColor={theme.mutedColor}
                    fontScale={fontScale}
                    scaleFont={scaleFont}
                    onSelect={setSelectedId}
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
                label="[ LOCK REQUISITION ]"
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
  choiceCard: {
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardHeader: {
    flexShrink: 0,
    gap: 6,
  },
  tierTag: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  choiceName: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  choiceTagline: {
    fontFamily: 'monospace',
    letterSpacing: 0.35,
  },
  visualAnchor: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 24,
  },
  cardDescription: {
    flexShrink: 0,
    gap: 8,
  },
  choiceEffect: {
    fontFamily: 'monospace',
    letterSpacing: 0.35,
  },
  choiceTradeoff: {
    fontFamily: 'monospace',
    color: '#f87171',
    letterSpacing: 0.3,
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
