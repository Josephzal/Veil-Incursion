import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame from '../components/layout/RunEventScreenFrame';
import RunEventNodeHeader from '../components/layout/RunEventNodeHeader';
import RunEventChoiceCard from '../components/layout/RunEventChoiceCard';
import TerminalOverlay from '../components/TerminalOverlay';
import RunActionRail from '../components/runField/RunActionRail';
import FieldPlate from '../components/runField/FieldPlate';
import BoonsBg from '../../assets/images/location images/boons.png';
import { getBoundRequisitionDefinition } from '../data/boundRequisitions';
import { getBoundRequisitionLevel } from '../data/boundRequisitionProgression';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import type { BoundRequisitionId } from '../types/boundRequisition';
import { RUN_FIELD } from '../theme/runFieldTokens';

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
    fontScale,
    gap,
    scaleFont,
    scaleSpacing,
  } = useResponsiveLayout();
  const [selectedId, setSelectedId] = useState<BoundRequisitionId | null>(null);
  const [confirming, setConfirming] = useState(false);

  const requisitionLevel = getBoundRequisitionLevel(account);
  const cardPadding = isDesktop ? scaleSpacing(14) : scaleSpacing(10);
  const canContinue = selectedId != null && !confirming && boundRequisitionOffers.length > 0;

  const headerSubtitle = useMemo(
    () => `Rank ${account.operativeRank} · Tier ${requisitionLevel}`,
    [account.operativeRank, requisitionLevel],
  );

  const forgePassives = useMemo(
    () => account.craftedAugments.map((id) => getBoundRequisitionDefinition(id).name),
    [account.craftedAugments],
  );

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
          backgroundScrimOpacity={RUN_FIELD.environmentScrimDense}
          contentPadding={isDesktop ? scaleSpacing(16) : 8}
          overlay={<TerminalOverlay />}
        >
          <View style={styles.masterStage}>
            <RunEventNodeHeader
              eyebrow="CABAL ISSUE"
              title="BOUND REQUISITION"
              subtitle={headerSubtitle}
              fontScale={fontScale}
              showRunChrome
            />

            {forgePassives.length > 0 ? (
              <FieldPlate density="wash" brackets={false} style={styles.forgeStrip} contentStyle={styles.forgeStripContent}>
                <Text style={styles.forgeLabel}>FORGE PASSIVES</Text>
                <Text style={styles.forgeValue} numberOfLines={1}>
                  {forgePassives.join(' · ')}
                </Text>
              </FieldPlate>
            ) : null}

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
                {boundRequisitionOffers.map((offer) => {
                  const isMandate = offer.kind === 'CABAL_MANDATE';
                  const tierText = isMandate ? 'CABAL MANDATE' : `TIER ${offer.tier}`;

                  return (
                    <View
                      key={offer.id}
                      style={isDesktop ? styles.cardSlotDesktop : styles.cardSlotMobile}
                    >
                      <RunEventChoiceCard
                        tierTag={`BOUND ISSUE // ${tierText}`}
                        name={offer.name}
                        tagline={offer.tagline}
                        effectSummary={offer.effectSummary}
                        tradeoffSummary={offer.tradeoffSummary}
                        cardWidth="100%"
                        cardPadding={cardPadding}
                        isDesktop={isDesktop}
                        isSelected={selectedId === offer.id}
                        isDimmed={selectedId != null && selectedId !== offer.id}
                        disabled={confirming}
                        borderColor={theme.borderColor}
                        textColor={theme.primaryColor}
                        mutedColor={theme.mutedColor}
                        fontScale={fontScale}
                        scaleFont={scaleFont}
                        onPress={() => setSelectedId(offer.id)}
                      />
                    </View>
                  );
                })}
              </View>
            </View>

            <RunActionRail
              mode="screen"
              primaryLabel="LOCK REQUISITION"
              onPrimary={handleContinue}
              primaryDisabled={!canContinue}
            />
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
    gap: 12,
    alignItems: 'stretch',
  },
  offerWorkspace: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    justifyContent: 'center',
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
  forgeStrip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 0,
  },
  forgeStripContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  forgeLabel: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.micro,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: RUN_FIELD.textSecondary,
    flexShrink: 0,
  },
  forgeValue: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    fontWeight: '600',
    color: RUN_FIELD.text,
    flexShrink: 1,
  },
});
