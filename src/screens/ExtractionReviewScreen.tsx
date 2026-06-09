import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import IncursionShell from '../components/IncursionShell';
import MacroLogAnchoredLayout from '../components/MacroLogAnchoredLayout';
import OperativeTelemetryBar from '../components/OperativeTelemetryBar';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { calculateCargoMarketValue } from '../data/cargoGridEngine';
import { getSectorZone } from '../data/sectorZoneEngine';
import {
  EMERGENCY_EXTRACT_CARGO_BLEED_PCT,
  MASTER_EXTRACTION_PAYOUT_MULTIPLIER,
} from '../types/sectorPacing';

const TERMINAL_ACCENT = '#00ff33';

export default function ExtractionReviewScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    runState,
    activeIncursion,
    continueFromExtractionReview,
    confirmSafeAnchorExtraction,
    confirmMasterExtraction,
    applyEmergencyRecallCargoBleed,
  } = useRun();
  const { startScanning } = useGameFlow();
  const { finalizeSectorExtraction } = useDescentNavigator();

  const reviewKind = activeIncursion.extractionReviewKind;
  const anchorIndex = activeIncursion.pendingSafeAnchorIndex;
  const cargoValue = calculateCargoMarketValue(activeIncursion.cargo);
  const zone = getSectorZone(activeIncursion.nodesCleared, activeIncursion.collapseActive);

  const payoutPreview = useMemo(() => {
    let total = activeIncursion.runCredits + cargoValue + 150;
    if (activeIncursion.primeExtractionBonus) total = Math.floor(total * 1.5);
    if (reviewKind === 'MASTER_LINK') total = Math.floor(total * MASTER_EXTRACTION_PAYOUT_MULTIPLIER);
    if (reviewKind === 'EMERGENCY_RECALL') {
      total = Math.floor(total * (1 - EMERGENCY_EXTRACT_CARGO_BLEED_PCT / 100));
    }
    return total;
  }, [activeIncursion.primeExtractionBonus, activeIncursion.runCredits, cargoValue, reviewKind]);

  const headerMeta = useMemo(() => {
    switch (reviewKind) {
      case 'EMERGENCY_RECALL':
        return {
          label: 'EXTRACTION REVIEW // EMERGENCY RECALL',
          title: `DIRTY EVAC — ${EMERGENCY_EXTRACT_CARGO_BLEED_PCT}% CARGO BLEED`,
        };
      case 'MASTER_LINK':
        return {
          label: 'EXTRACTION REVIEW // MASTER LINK',
          title: 'PRIME CONDUIT — GUARANTEED CLEAN EXIT',
        };
      default:
        return {
          label: `EXTRACTION REVIEW // SAFE ANCHOR ${anchorIndex ?? '—'}`,
          title: 'CLEAN EVAC CONDUIT — NO PENALTY',
        };
    }
  }, [anchorIndex, reviewKind]);

  const handleExtract = () => {
    if (reviewKind === 'SAFE_ANCHOR' && anchorIndex != null) {
      confirmSafeAnchorExtraction(anchorIndex);
    } else if (reviewKind === 'MASTER_LINK') {
      confirmMasterExtraction();
    } else if (reviewKind === 'EMERGENCY_RECALL') {
      applyEmergencyRecallCargoBleed();
    }
    finalizeSectorExtraction();
  };

  const handleContinue = () => {
    continueFromExtractionReview();
    startScanning();
  };

  return (
    <IncursionShell>
      <MacroLogAnchoredLayout
        showMacroLog={runState.runActive}
        style={{ backgroundColor: theme.backgroundColor }}
      >
        <View style={styles.body}>
          <OperativeTelemetryBar />

          <View style={[styles.header, { borderColor: theme.borderColor }]}>
            <Text style={[styles.headerLabel, { color: theme.mutedColor }]}>
              {headerMeta.label}
            </Text>
            <Text style={[styles.headerTitle, { color: TERMINAL_ACCENT }]}>
              {headerMeta.title}
            </Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <View style={[styles.panel, { borderColor: theme.borderColor }]}>
              <Text style={[styles.sectionTitle, { color: theme.mutedColor }]}>OPERATIVE STATUS</Text>
              <Text style={[styles.line, { color: theme.primaryColor }]}>
                {`HP ${runState.soulAnchorIntegrity}/${runState.maxSoulAnchor} // STA ${runState.currentStamina}/${runState.maxStamina}`}
              </Text>
              <Text style={[styles.line, { color: theme.primaryColor }]}>
                {`RESONANCE ${activeIncursion.resonance.percent}% // ATT ${activeIncursion.attunement.current}/${activeIncursion.attunement.max}`}
              </Text>
              <Text style={[styles.line, { color: theme.primaryColor }]}>
                {`ZONE ${zone.replace(/_/g, ' ')} // NODES CLEARED ${activeIncursion.nodesCleared}`}
              </Text>
            </View>

            <View style={[styles.panel, { borderColor: theme.borderColor }]}>
              <Text style={[styles.sectionTitle, { color: theme.mutedColor }]}>FIELD HAUL</Text>
              <Text style={[styles.line, { color: theme.primaryColor }]}>
                {`RUN CREDITS ${activeIncursion.runCredits}`}
              </Text>
              <Text style={[styles.line, { color: theme.primaryColor }]}>
                {`CARGO VALUE ${cargoValue}`}
              </Text>
              {reviewKind === 'EMERGENCY_RECALL' ? (
                <Text style={[styles.line, { color: '#fbbf24' }]}>
                  {`EMERGENCY BLEED — −${EMERGENCY_EXTRACT_CARGO_BLEED_PCT}% cargo value on extract`}
                </Text>
              ) : null}
              <Text style={[styles.line, { color: TERMINAL_ACCENT }]}>
                {`EST. EXTRACTION PAYOUT ~${payoutPreview}`}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            {reviewKind !== 'EMERGENCY_RECALL' ? (
              <Pressable
                onPress={handleContinue}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { borderColor: theme.borderColor, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.actionText, { color: theme.primaryColor }]}>[ CONTINUE INCURSION ]</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleExtract}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.extractBtn,
                { borderColor: TERMINAL_ACCENT, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.actionText, { color: TERMINAL_ACCENT }]}>[ EXTRACT ]</Text>
            </Pressable>
          </View>
        </View>
      </MacroLogAnchoredLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, minHeight: 0 },
  header: { borderBottomWidth: 1, paddingVertical: 10, paddingHorizontal: 16 },
  headerLabel: { fontFamily: 'monospace', fontSize: 8, letterSpacing: 1, marginBottom: 4 },
  headerTitle: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  panel: { borderWidth: 1, padding: 12, backgroundColor: '#0a0b0f', gap: 6 },
  sectionTitle: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 1, marginBottom: 4 },
  line: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.4, lineHeight: 14 },
  actions: { padding: 16, gap: 10 },
  actionBtn: { borderWidth: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#050608' },
  extractBtn: { backgroundColor: 'rgba(0, 255, 51, 0.06)' },
  actionText: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
});
