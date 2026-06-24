import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
          scrollable
          backgroundImage={CabalBg}
          header={(
            <RunEventScreenHeader
              eyebrow="CABAL REQUISITION DESK // PRE-INCURSION LOCK"
              title="BOUND REQUISITION"
              align="left"
              borderColor={theme.borderColor}
              eyebrowColor={theme.mutedColor}
              titleColor={TERMINAL_ACCENT}
            >
              <Text style={[styles.levelLine, { color: theme.mutedColor }]}>
                {`OPERATIVE RANK ${account.operativeRank} // REQUISITION CLEARANCE TIER ${requisitionLevel}`}
              </Text>
              <Text style={[styles.instruction, { color: theme.primaryColor }]}>
                Select one requisition offer. Effects bind for the entire incursion.
              </Text>
              {account.craftedAugments.length > 0 ? (
                <View style={[styles.forgePassivesBlock, { borderColor: theme.borderColor }]}>
                  <Text style={[styles.forgePassivesLabel, { color: theme.mutedColor }]}>
                    FORGE PASSIVES (ALWAYS ACTIVE)
                  </Text>
                  {account.craftedAugments.map((augmentId) => {
                    const def = getBoundRequisitionDefinition(augmentId);
                    return (
                      <Text key={augmentId} style={[styles.forgePassiveLine, { color: TERMINAL_ACCENT }]}>
                        {`>> ${def.name.toUpperCase()} — ${def.effectSummary}`}
                      </Text>
                    );
                  })}
                </View>
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
            />
          )}
        >
          <View style={styles.choiceCol}>
            {boundRequisitionOffers.map((offer) => {
              const isSelected = selectedId === offer.id;
              const isMandate = offer.kind === 'CABAL_MANDATE';
              return (
                <Pressable
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
                  <Text style={[styles.tierTag, { color: theme.mutedColor }]}>
                    {isMandate ? 'CABAL MANDATE' : tierLabel(offer.tier)}
                  </Text>
                  <Text
                    style={[
                      styles.choiceName,
                      { color: isSelected ? TERMINAL_ACCENT : theme.primaryColor },
                    ]}
                  >
                    {offer.name.toUpperCase()}
                  </Text>
                  <Text style={[styles.choiceTagline, { color: theme.mutedColor }]}>
                    {offer.tagline}
                  </Text>
                  <Text style={[styles.choiceEffect, { color: theme.primaryColor }]}>
                    {offer.effectSummary}
                  </Text>
                  {offer.tradeoffSummary ? (
                    <Text style={[styles.choiceTradeoff, { color: '#f87171' }]}>
                      {`TRADE-OFF: ${offer.tradeoffSummary}`}
                    </Text>
                  ) : null}
                </Pressable>
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
    fontSize: 8,
    letterSpacing: 0.6,
    marginTop: 4,
  },
  instruction: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },
  choiceCol: { gap: 10 },
  choiceBtn: {
    borderWidth: 1,
    backgroundColor: 'rgba(10, 11, 15, 0.92)',
    padding: 12,
  },
  choiceBtnSelected: {
    backgroundColor: 'rgba(14, 22, 36, 0.95)',
  },
  tierTag: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  choiceName: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  choiceTagline: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  choiceEffect: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 14,
  },
  choiceTradeoff: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 13,
    marginTop: 6,
  },
  forgePassivesBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 4,
  },
  forgePassivesLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  forgePassiveLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 12,
  },
});
