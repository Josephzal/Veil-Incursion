import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import TacticalButton from '../TacticalButton';
import DecryptionPanel from '../DecryptionPanel';
import SafehouseTexturedPanel from './SafehouseTexturedPanel';
import type { DistrictIntelBrief } from '../../data/districtPacing';

const STARK_WHITE = '#F8FAFC';
const MUTED_SLATE = '#94A3B8';

interface SafehouseTelemetryPanelProps {
  healthPct: number;
  shieldPct: number;
  resonancePct: number;
  intel: DistrictIntelBrief;
  activeCabal: string;
  fontScale: number;
  isDesktop: boolean;
  hasLockedContainers: boolean;
  onBenchRestore: () => void;
  onStatus: (line: string) => void;
}

function formatIntelWarning(intel: DistrictIntelBrief): string {
  if (intel.district === 2) {
    return '>> INTEL: SUB-GRID SENSORS DETECT HIGH KINETIC ARMOR';
  }
  if (intel.district === 3) {
    return '>> INTEL: DEEP VEIL SIGNATURES — ELITE ARMOR PLATING EXPECTED';
  }
  return `>> INTEL: ${intel.hazardSummary.toUpperCase()}`;
}

export default function SafehouseTelemetryPanel({
  healthPct,
  shieldPct,
  resonancePct,
  intel,
  activeCabal,
  fontScale,
  isDesktop,
  hasLockedContainers,
  onBenchRestore,
  onStatus,
}: SafehouseTelemetryPanelProps): React.JSX.Element {
  const pad = 16 * fontScale;
  const labelSize = 7 * fontScale;
  const valueSize = 10 * fontScale;
  const sectionTitle = 8 * fontScale;

  return (
    <SafehouseTexturedPanel
      flex={isDesktop ? 0.62 : undefined}
      style={isDesktop ? styles.sidePanel : undefined}
      padding={pad}
      contentStyle={styles.content}
    >
      <View style={styles.telemetrySection}>
        <Text style={[styles.sectionLabel, { fontSize: sectionTitle, color: MUTED_SLATE, letterSpacing: 1.5 }]}>
          [ SECTOR TELEMETRY ]
        </Text>

        <View style={styles.telemetryBlock}>
          <View style={styles.telemetryRow}>
            <Text style={[styles.telemetryLabel, { fontSize: labelSize }]}>HEALTH</Text>
            <Text style={[styles.telemetryValue, { fontSize: valueSize, color: activeCabal, minWidth: valueSize * 3.5 }]}>
              {`${healthPct}%`}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={[styles.telemetryLabel, { fontSize: labelSize }]}>SHIELDS</Text>
            <Text style={[styles.telemetryValue, { fontSize: valueSize, color: STARK_WHITE, minWidth: valueSize * 3.5 }]}>
              {`${shieldPct}%`}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={[styles.telemetryLabel, { fontSize: labelSize }]}>RESONANCE PURGE</Text>
            <Text style={[styles.telemetryValue, { fontSize: valueSize, color: STARK_WHITE, minWidth: valueSize * 3.5 }]}>
              {`${resonancePct}%`}
            </Text>
          </View>
        </View>

        <TacticalButton
          label="[ BENCH RESTORE — 25% HP ]"
          active
          onPress={onBenchRestore}
          accentColor={activeCabal}
          mutedColor={MUTED_SLATE}
          variant="inline"
          style={styles.restoreBtn}
        />
      </View>

      <Text
        style={[
          styles.sectionLabel,
          {
            fontSize: sectionTitle,
            color: MUTED_SLATE,
            letterSpacing: 1.5,
            marginTop: pad * 1.25,
          },
        ]}
      >
        [ DISTRICT INTEL ]
      </Text>

      <View style={[styles.intelBlock, { borderLeftColor: activeCabal, padding: 12 * fontScale }]}>
        <Text style={[styles.intelMeta, { fontSize: labelSize, color: MUTED_SLATE }]}>
          {`TARGET: ${intel.districtName.toUpperCase()} // ${intel.depthStageLabel.toUpperCase()} // ${intel.anchorStageLabel.toUpperCase()}`}
        </Text>
        {intel.activeAnchorName ? (
          <Text style={[styles.intelMeta, { fontSize: labelSize, color: MUTED_SLATE, marginTop: 4 * fontScale }]}>
            {`ANCHOR: ${intel.activeAnchorName.toUpperCase()}`}
          </Text>
        ) : null}
        {intel.operationTitle ? (
          <Text style={[styles.intelMeta, { fontSize: labelSize, color: MUTED_SLATE, marginTop: 4 * fontScale }]}>
            {`OPERATION: ${intel.operationTitle.toUpperCase()}`}
          </Text>
        ) : null}
        {intel.veilDistortionName ? (
          <Text style={[styles.intelMeta, { fontSize: labelSize, color: activeCabal, marginTop: 4 * fontScale }]}>
            {`BREACH DISTORTION: ${intel.veilDistortionName.toUpperCase()}`}
          </Text>
        ) : null}
        {intel.veilDistortionSummary ? (
          <Text style={[styles.intelMeta, { fontSize: labelSize, color: MUTED_SLATE, marginTop: 2 * fontScale }]}>
            {intel.veilDistortionSummary.toUpperCase()}
          </Text>
        ) : null}
        {intel.deepVeilLawName ? (
          <Text style={[styles.intelMeta, { fontSize: labelSize, color: activeCabal, marginTop: 4 * fontScale }]}>
            {`${intel.deepVeilLawIntensified ? 'DEEP VEIL LAW (INTENSIFIED)' : 'DEEP VEIL LAW'}: ${intel.deepVeilLawName.toUpperCase()}`}
          </Text>
        ) : null}
        {intel.deepVeilLawSummary ? (
          <Text style={[styles.intelMeta, { fontSize: labelSize, color: MUTED_SLATE, marginTop: 2 * fontScale }]}>
            {intel.deepVeilLawSummary.toUpperCase()}
          </Text>
        ) : null}
        <Text style={[styles.intelWarn, { fontSize: labelSize, lineHeight: labelSize * 1.5, color: STARK_WHITE }]}>
          {formatIntelWarning(intel)}
        </Text>
        <Text style={[styles.intelHint, { fontSize: labelSize, lineHeight: labelSize * 1.45, color: MUTED_SLATE }]}>
          {intel.tacticHint}
        </Text>
      </View>

      {hasLockedContainers ? (
        <View style={styles.decryptWrap}>
          <DecryptionPanel onStatus={onStatus} />
        </View>
      ) : null}
    </SafehouseTexturedPanel>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  telemetrySection: {
    gap: 12,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  telemetryBlock: {
    gap: 10,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  telemetryLabel: {
    fontFamily: 'monospace',
    color: MUTED_SLATE,
    letterSpacing: 1.2,
    fontWeight: '600',
    flex: 1,
  },
  telemetryValue: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  restoreBtn: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
  intelBlock: {
    borderLeftWidth: 2,
    backgroundColor: 'rgba(9, 9, 11, 0.45)',
    gap: 8,
  },
  intelMeta: {
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  intelWarn: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  intelHint: {
    fontFamily: 'monospace',
    letterSpacing: 0.35,
  },
  decryptWrap: {
    marginTop: 4,
    flexShrink: 1,
    minHeight: 0,
  },
  sidePanel: {
    maxWidth: 240,
    minWidth: 180,
    flexGrow: 0,
    flexShrink: 1,
  },
});
