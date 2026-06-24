import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import CabalBg from '../../assets/images/location images/cabal.png';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame, { RunEventScreenHeader } from '../components/layout/RunEventScreenFrame';
import SelectionContinueButton from '../components/SelectionContinueButton';
import { tierLabel, getBoundRequisitionDefinition } from '../data/boundRequisitions';
import { getBoundRequisitionLevel } from '../data/boundRequisitionProgression';
import { useGameFlow } from '../context/GameFlowContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import type { BoundRequisitionId } from '../types/boundRequisition';

const TERMINAL_ACCENT = '#00ff33';

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
  const [selectedId, setSelectedId] = useState<BoundRequisitionId | null>(null);
  const [confirming, setConfirming] = useState(false);

  const requisitionLevel = getBoundRequisitionLevel(account);

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
      <IncursionRunLayout style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventScreenFrame
          contentPadding={8}
          backgroundImage={CabalBg}
          header={(
            <RunEventScreenHeader
              title="BOUND REQUISITION"
              align="left"
              borderColor={theme.borderColor}
              titleColor={TERMINAL_ACCENT}
            >
              <Text style={[styles.levelLine, { color: theme.mutedColor }]} numberOfLines={1}>
                {`RANK ${account.operativeRank} // TIER ${requisitionLevel} // SELECT ONE OFFER`}
              </Text>
              {account.craftedAugments.length > 0 ? (
                <Text style={[styles.forgeLine, { color: TERMINAL_ACCENT }]} numberOfLines={2}>
                  {`FORGE PASSIVES: ${account.craftedAugments.map((id) => getBoundRequisitionDefinition(id).name).join(' // ')}`}
                </Text>
              ) : null}
            </RunEventScreenHeader>
          )}
          footer={(
            <SelectionContinueButton
              enabled={selectedId != null && !confirming && boundRequisitionOffers.length > 0}
              onPress={handleContinue}
              borderColor={theme.borderColor}
              mutedColor={theme.mutedColor}
              accentColor={theme.primaryColor}
              label="[ LOCK REQUISITION // CONTINUE ]"
              style={styles.continueBtn}
            />
          )}
        >
          <View style={styles.choiceRow}>
            {boundRequisitionOffers.map((offer) => {
              const isSelected = selectedId === offer.id;
              const isMandate = offer.kind === 'CABAL_MANDATE';
              return (
                <HapticPressable
                  key={offer.id}
                  onPress={() => !confirming && setSelectedId(offer.id)}
                  disabled={confirming}
                  style={({ pressed }) => [
                    styles.choiceBtn,
                    isSelected && styles.choiceBtnSelected,
                    {
                      borderColor: isSelected ? TERMINAL_ACCENT : theme.borderColor,
                      opacity: confirming && !isSelected ? 0.4 : pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.tierTag, { color: theme.mutedColor }]} numberOfLines={1}>
                    {isMandate ? 'CABAL MANDATE' : tierLabel(offer.tier)}
                  </Text>
                  <Text
                    style={[
                      styles.choiceName,
                      { color: isSelected ? TERMINAL_ACCENT : theme.primaryColor },
                    ]}
                    numberOfLines={2}
                  >
                    {offer.name.toUpperCase()}
                  </Text>
                  <Text style={[styles.choiceTagline, { color: theme.mutedColor }]} numberOfLines={2}>
                    {offer.tagline}
                  </Text>
                  <Text style={[styles.choiceEffect, { color: theme.primaryColor }]} numberOfLines={3}>
                    {offer.effectSummary}
                  </Text>
                  {offer.tradeoffSummary ? (
                    <Text style={[styles.choiceTradeoff, { color: '#f87171' }]} numberOfLines={2}>
                      {`TRADE-OFF: ${offer.tradeoffSummary}`}
                    </Text>
                  ) : null}
                </HapticPressable>
              );
            })}
          </View>
        </RunEventScreenFrame>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  levelLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  forgeLine: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.4,
    lineHeight: 9,
    marginTop: 4,
  },
  choiceRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  choiceBtn: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    backgroundColor: 'rgba(10, 11, 15, 0.92)',
    padding: 8,
    justifyContent: 'flex-start',
  },
  choiceBtnSelected: {
    backgroundColor: 'rgba(14, 22, 36, 0.95)',
  },
  tierTag: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  choiceName: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
    lineHeight: 11,
  },
  choiceTagline: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.3,
    marginBottom: 4,
    lineHeight: 9,
  },
  choiceEffect: {
    fontFamily: 'monospace',
    fontSize: 7,
    lineHeight: 9,
  },
  choiceTradeoff: {
    fontFamily: 'monospace',
    fontSize: 6,
    lineHeight: 9,
    marginTop: 4,
  },
  continueBtn: {
    marginTop: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
  },
});
