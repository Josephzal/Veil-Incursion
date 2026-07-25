import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame from '../components/layout/RunEventScreenFrame';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import RunEventChoiceCard from '../components/layout/RunEventChoiceCard';
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
import { HUB_BORDER_INSET } from '../constants/hubCta';
import type { BoundRequisitionId } from '../types/boundRequisition';
import { VEIL } from '../theme/veilTerminalTokens';

const TERMINAL_ACCENT = VEIL.mint;

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
    ],
    [scaleSpacing],
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
                {boundRequisitionOffers.map((offer) => {
                  const isMandate = offer.kind === 'CABAL_MANDATE';
                  const tierText = isMandate ? 'CABAL MANDATE' : tierLabel(offer.tier);
                  const cardAccent = isMandate && offer.cabal
                    ? getFactionAccent(offer.cabal)
                    : cabalAccent;

                  return (
                    <RunEventChoiceCard
                      key={offer.id}
                      tierTag={`[ ${tierText} ]`}
                      name={offer.name.toUpperCase()}
                      tagline={offer.tagline}
                      effectSummary={offer.effectSummary}
                      tradeoffSummary={offer.tradeoffSummary}
                      cardWidth={reqCardWidth}
                      cardPadding={cardPadding}
                      isDesktop={isDesktop}
                      isSelected={selectedId === offer.id}
                      isDimmed={selectedId != null && selectedId !== offer.id}
                      disabled={confirming}
                      accentColor={cardAccent}
                      borderColor={theme.borderColor}
                      textColor={theme.primaryColor}
                      mutedColor={theme.mutedColor}
                      fontScale={fontScale}
                      scaleFont={scaleFont}
                      onPress={() => setSelectedId(offer.id)}
                    />
                  );
                })}
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
