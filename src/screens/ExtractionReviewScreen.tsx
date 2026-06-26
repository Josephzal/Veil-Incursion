import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../components/HapticPressable';
import IncursionShell from '../components/IncursionShell';
import IncursionRunLayout from '../components/IncursionRunLayout';
import RunEventScreenFrame, { RunEventScreenHeader } from '../components/layout/RunEventScreenFrame';
import { useGameFlow } from '../context/GameFlowContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useDescentNavigator } from '../hooks/useDescentNavigator';
import { resolveExtractionVeilResidueDeposit } from '../data/extractionPersistenceEngine';
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
  const cargoItemCount =
    activeIncursion.cargo.grid.placed.length + activeIncursion.cargo.containment.length;
  const zone = getSectorZone(activeIncursion.nodesCleared, activeIncursion.collapseActive);

  const payoutPreview = useMemo(() => {
    let total = activeIncursion.runCredits + 150;
    if (activeIncursion.primeExtractionBonus) total = Math.floor(total * 1.5);
    if (reviewKind === 'MASTER_LINK') total = Math.floor(total * MASTER_EXTRACTION_PAYOUT_MULTIPLIER);
    if (reviewKind === 'EMERGENCY_RECALL') {
      total = Math.floor(total * (1 - EMERGENCY_EXTRACT_CARGO_BLEED_PCT / 100));
    }
    return total;
  }, [activeIncursion.primeExtractionBonus, activeIncursion.runCredits, reviewKind]);

  const residueVaultPreview = useMemo(
    () => resolveExtractionVeilResidueDeposit(
      activeIncursion.cargo,
      activeIncursion.sessionVeilResidueCollected,
    ).totalDeposit,
    [activeIncursion.cargo, activeIncursion.sessionVeilResidueCollected],
  );

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
      <IncursionRunLayout style={{ backgroundColor: theme.backgroundColor }}>
        <RunEventScreenFrame
          scrollable
          header={(
            <RunEventScreenHeader
              eyebrow={headerMeta.label}
              title={headerMeta.title}
              borderColor={theme.borderColor}
              eyebrowColor={theme.mutedColor}
              titleColor={TERMINAL_ACCENT}
            />
          )}
          footer={(
            <View style={styles.actions}>
              {reviewKind !== 'EMERGENCY_RECALL' ? (
                <HapticPressable
                  onPress={handleContinue}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { borderColor: theme.borderColor, opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <Text style={[styles.actionText, { color: theme.primaryColor }]}>[ CONTINUE INCURSION ]</Text>
                </HapticPressable>
              ) : null}
              <HapticPressable
                onPress={handleExtract}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.extractBtn,
                  { borderColor: TERMINAL_ACCENT, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.actionText, { color: TERMINAL_ACCENT }]}>[ EXTRACT ]</Text>
              </HapticPressable>
            </View>
          )}
        >
          <View style={[styles.panel, { borderColor: theme.borderColor }]}>
            <Text style={[styles.sectionTitle, { color: theme.mutedColor }]}>OPERATIVE STATUS</Text>
            <Text style={[styles.line, { color: theme.primaryColor }]}>
              {`HP ${runState.soulAnchorIntegrity}/${runState.maxSoulAnchor} // STA ${runState.currentStamina}/${runState.maxStamina}`}
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
              {`CARGO ITEMS ${cargoItemCount} → HOME STASH`}
            </Text>
            {residueVaultPreview > 0 ? (
              <Text style={[styles.line, { color: TERMINAL_ACCENT }]}>
                {`VEIL RESIDUE ${residueVaultPreview} → SAFEHOUSE VAULT (SHADOW WAR DONATABLE)`}
              </Text>
            ) : null}
            {reviewKind === 'EMERGENCY_RECALL' ? (
              <Text style={[styles.line, { color: '#fbbf24' }]}>
                {`EMERGENCY BLEED — −${EMERGENCY_EXTRACT_CARGO_BLEED_PCT}% cargo items lost on extract`}
              </Text>
            ) : null}
            <Text style={[styles.line, { color: TERMINAL_ACCENT }]}>
              {`EST. CREDIT PAYOUT ~${payoutPreview}`}
            </Text>
          </View>
        </RunEventScreenFrame>
      </IncursionRunLayout>
    </IncursionShell>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, padding: 12, backgroundColor: '#0a0b0f', gap: 6 },
  sectionTitle: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 1, marginBottom: 4 },
  line: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.4, lineHeight: 14 },
  actions: { gap: 10 },
  actionBtn: { borderWidth: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#050608' },
  extractBtn: { backgroundColor: 'rgba(0, 255, 51, 0.06)' },
  actionText: { fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
});
