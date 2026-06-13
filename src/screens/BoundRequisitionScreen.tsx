import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CabalBg from '../../assets/images/location images/cabal.png';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import SelectionContinueButton from '../components/SelectionContinueButton';
import { tierLabel } from '../data/boundRequisitions';
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
    runState,
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
    confirmBoundRequisition(selectedId);
    beginScanSession();
    startScanning();
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

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.docHeader, { borderBottomColor: theme.borderColor }]}>
              <Text style={[styles.docLabel, { color: theme.mutedColor }]}>
                CABAL REQUISITION DESK // PRE-INCURSION LOCK
              </Text>
              <Text style={styles.docTitle}>BOUND REQUISITION</Text>
              <Text style={[styles.levelLine, { color: theme.mutedColor }]}>
                {`OPERATIVE RANK ${account.operativeRank} // REQUISITION CLEARANCE TIER ${requisitionLevel}`}
              </Text>
              <Text style={[styles.instruction, { color: theme.primaryColor }]}>
                Select one requisition offer. Effects bind for the entire incursion.
              </Text>
            </View>

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

            <SelectionContinueButton
              enabled={selectedId != null && !confirming && boundRequisitionOffers.length > 0}
              onPress={handleContinue}
              borderColor={theme.borderColor}
              mutedColor={theme.mutedColor}
              accentColor={theme.primaryColor}
              label="[ LOCK REQUISITION // CONTINUE ]"
            />
          </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingTop: 10,
    paddingBottom: 24,
  },
  docHeader: {
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 14,
  },
  docLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 1,
    marginBottom: 4,
  },
  docTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: TERMINAL_ACCENT,
    marginBottom: 6,
  },
  levelLine: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  instruction: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 14,
  },
  choiceCol: {
    gap: 10,
    marginBottom: 16,
  },
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
});
