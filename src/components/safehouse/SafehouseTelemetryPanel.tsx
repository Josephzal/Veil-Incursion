import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HubPrimaryCta from '../hub/HubPrimaryCta';
import DecryptionPanel from '../DecryptionPanel';
import FieldPlate from '../runField/FieldPlate';
import { RUN_FIELD } from '../../theme/runFieldTokens';
import type { DistrictIntelBrief } from '../../data/districtPacing';

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

/**
 * Safehouse left dossier — FieldPlate chrome matching Black Market CACHE SIGNAL panel.
 */
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
  const panelPad = 14 * fontScale;
  const actionGap = 10 * fontScale;
  const dossierMeta = 8 * fontScale;
  const section = 9 * fontScale;
  const valueSize = 16 * fontScale;
  const labelSize = 8 * fontScale;

  return (
    <FieldPlate
      density="standard"
      tone="neutral"
      brackets={false}
      style={[styles.panel, isDesktop ? styles.sidePanel : null]}
      contentStyle={[styles.panelContent, { gap: actionGap, padding: panelPad }]}
    >
      <View style={styles.eyebrow}>
        <Text
          style={[
            styles.eyebrowText,
            { color: RUN_FIELD.mint, fontSize: dossierMeta, lineHeight: dossierMeta * 1.35 },
          ]}
        >
          SECTOR SIGNAL // LIVE VITALS
        </Text>
      </View>

      <FieldPlate
        density="wash"
        tone="neutral"
        brackets={false}
        style={styles.vitalsReadout}
        contentStyle={styles.vitalsReadoutContent}
      >
        <Text
          style={[
            styles.sectionLabel,
            {
              color: RUN_FIELD.textSecondary,
              fontSize: section,
              lineHeight: section * 1.4,
            },
          ]}
        >
          SECTOR TELEMETRY
        </Text>

        <View style={styles.telemetryBlock}>
          <View style={styles.telemetryRow}>
            <Text style={[styles.telemetryLabel, { fontSize: labelSize }]}>HEALTH</Text>
            <Text
              style={[
                styles.telemetryValue,
                { fontSize: valueSize, color: RUN_FIELD.mint, minWidth: valueSize * 2.8 },
              ]}
            >
              {`${healthPct}%`}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={[styles.telemetryLabel, { fontSize: labelSize }]}>SHIELDS</Text>
            <Text
              style={[
                styles.telemetryValue,
                { fontSize: valueSize, color: RUN_FIELD.text, minWidth: valueSize * 2.8 },
              ]}
            >
              {`${shieldPct}%`}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={[styles.telemetryLabel, { fontSize: labelSize }]}>RESONANCE PURGE</Text>
            <Text
              style={[
                styles.telemetryValue,
                { fontSize: valueSize, color: RUN_FIELD.text, minWidth: valueSize * 2.8 },
              ]}
            >
              {`${resonancePct}%`}
            </Text>
          </View>
        </View>
      </FieldPlate>

      <HubPrimaryCta
        label="BENCH RESTORE — 25% HP"
        onPress={onBenchRestore}
        variant="glow"
        accessibilityLabel="Bench restore twenty five percent health"
        minHeight={44}
        style={styles.restoreCta}
      />

      <Text
        style={[
          styles.sectionLabel,
          {
            color: RUN_FIELD.textSecondary,
            fontSize: section,
            lineHeight: section * 1.4,
            marginTop: 4,
          },
        ]}
      >
        DISTRICT INTEL // FIELD BRIEF
      </Text>

      <View style={styles.intelHost}>
        <Text style={[styles.intelMeta, { fontSize: dossierMeta, color: RUN_FIELD.textSecondary }]}>
          {`TARGET: ${intel.districtName.toUpperCase()} // ${intel.depthStageLabel.toUpperCase()} // ${intel.anchorStageLabel.toUpperCase()}`}
        </Text>
        {intel.activeAnchorName ? (
          <Text style={[styles.intelMeta, { fontSize: dossierMeta, color: RUN_FIELD.textSecondary }]}>
            {`ANCHOR: ${intel.activeAnchorName.toUpperCase()}`}
          </Text>
        ) : null}
        {intel.operationTitle ? (
          <Text style={[styles.intelMeta, { fontSize: dossierMeta, color: RUN_FIELD.textSecondary }]}>
            {`OPERATION: ${intel.operationTitle.toUpperCase()}`}
          </Text>
        ) : null}
        {intel.veilDistortionName ? (
          <Text style={[styles.intelMeta, { fontSize: dossierMeta, color: activeCabal }]}>
            {`BREACH DISTORTION: ${intel.veilDistortionName.toUpperCase()}`}
          </Text>
        ) : null}
        {intel.veilDistortionSummary ? (
          <Text style={[styles.intelMeta, { fontSize: dossierMeta, color: RUN_FIELD.textSecondary }]}>
            {intel.veilDistortionSummary.toUpperCase()}
          </Text>
        ) : null}
        {intel.deepVeilLawName ? (
          <Text style={[styles.intelMeta, { fontSize: dossierMeta, color: activeCabal }]}>
            {`${intel.deepVeilLawIntensified ? 'DEEP VEIL LAW (INTENSIFIED)' : 'DEEP VEIL LAW'}: ${intel.deepVeilLawName.toUpperCase()}`}
          </Text>
        ) : null}
        {intel.deepVeilLawSummary ? (
          <Text style={[styles.intelMeta, { fontSize: dossierMeta, color: RUN_FIELD.textSecondary }]}>
            {intel.deepVeilLawSummary.toUpperCase()}
          </Text>
        ) : null}
        <Text
          style={[
            styles.intelWarn,
            {
              fontSize: dossierMeta,
              lineHeight: dossierMeta * 1.45,
              color: RUN_FIELD.text,
            },
          ]}
        >
          {formatIntelWarning(intel)}
        </Text>
        <Text
          style={[
            styles.intelHint,
            {
              fontSize: dossierMeta,
              lineHeight: dossierMeta * 1.45,
              color: RUN_FIELD.textSecondary,
            },
          ]}
        >
          {intel.tacticHint}
        </Text>
      </View>

      {hasLockedContainers ? (
        <View style={styles.decryptWrap}>
          <DecryptionPanel onStatus={onStatus} />
        </View>
      ) : null}
    </FieldPlate>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
  sidePanel: {
    flex: 0.72,
    maxWidth: 320,
    minWidth: 220,
    flexGrow: 0,
    flexShrink: 1,
  },
  panelContent: {
    flex: 1,
    minHeight: 0,
  },
  eyebrow: {
    flexShrink: 0,
  },
  eyebrowText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    letterSpacing: 0.8,
    fontWeight: '700',
    flexShrink: 0,
  },
  vitalsReadout: {
    flexShrink: 0,
  },
  vitalsReadoutContent: {
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  telemetryBlock: {
    gap: 8,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  telemetryLabel: {
    fontFamily: 'monospace',
    color: RUN_FIELD.textSecondary,
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
  restoreCta: {
    alignSelf: 'stretch',
    width: '100%',
  },
  intelHost: {
    flex: 1,
    minHeight: 0,
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
});
