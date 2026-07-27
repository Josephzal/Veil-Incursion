import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import ScannerBreachButton from '../scanner/ScannerBreachButton';
import SignalMetadataLedger, { type LedgerRow } from '../scanner/SignalMetadataLedger';
import SignalClassification from '../scanner/SignalClassification';
import BreachAction from '../scanner/BreachAction';
import FieldSectionHeader from '../runField/FieldSectionHeader';
import { RUN_FIELD } from '../../theme/runFieldTokens';

export interface InlineScannerEngagementProps {
  headline?: string;
  spectralLines: string[];
  statusLines?: string[];
  /** Idle scanner prompt styled as telemetry readout (no node locked). */
  idleMessage?: string;
  /** All radar pings locked — crossfade caption to SIGNAL DECRYPTED. */
  signalDecrypted?: boolean;
  /** Selected contact has known type coloring (existing gameplay state). */
  contactTyped?: boolean;
  /** Optional sector / region for metadata ledger. */
  sectorLabel?: string;
  /** @deprecated Fingerprint graphic removed — prop retained for call-site compat. */
  selectedBearingDeg?: number | null;
  /** @deprecated Fingerprint graphic removed — prop retained for call-site compat. */
  fingerprintSeed?: string;
  /** @deprecated Fingerprint graphic removed — prop retained for call-site compat. */
  fingerprintAccent?: string;
  canEngage: boolean;
  accent: string;
  mutedColor: string;
  onEngage: () => void;
  layout?: 'card' | 'dock';
  engageLabel?: string;
  sonarPrompt?: React.ReactNode;
}

function parseTelemetryLine(line: string): { label: string; value: string } {
  const trimmed = line.replace(/^>\s*/, '');
  const splitIndex = trimmed.indexOf(':');
  if (splitIndex === -1) {
    return { label: trimmed, value: '' };
  }
  return {
    label: trimmed.slice(0, splitIndex).trim(),
    value: trimmed.slice(splitIndex + 1).trim(),
  };
}

function buildDossierFromLines(
  spectralLines: string[],
  statusLines: string[],
  sectorLabel: string | undefined,
  signalDecrypted: boolean,
  idleMessage: string | undefined,
  contactTyped: boolean,
): {
  vectorId: string | null;
  vectorTitle: string | null;
  classification: string | null;
  ledgerRows: LedgerRow[];
  idle: boolean;
  resolved: boolean;
} {
  const telemetryLines = [...spectralLines, ...statusLines];
  if (telemetryLines.length === 0) {
    return {
      vectorId: null,
      vectorTitle: null,
      classification: null,
      ledgerRows: [
        { label: 'SIGNAL STATE', value: 'SEARCHING' },
        { label: 'SCANNER STATE', value: 'SELECT AN ILLUMINATED PING' },
      ],
      idle: true,
      resolved: false,
    };
  }

  let vectorId: string | null = null;
  let vectorTitle: string | null = null;
  let classification: string | null = null;
  const ledgerRows: LedgerRow[] = [];

  telemetryLines.forEach((line) => {
    const { label, value } = parseTelemetryLine(line);
    const upper = label.toUpperCase();
    if (upper === 'VECTOR' || upper.startsWith('VECTOR ')) {
      vectorId = value || label;
      vectorTitle = value || label;
      return;
    }
    if (upper === 'NODE TYPE' || upper === 'NODE CLASSIFICATION') {
      classification = value;
      return;
    }
    if (!value) return;
    if (upper.includes('VECTOR')) return;
    ledgerRows.push({ label: upper, value: value.toUpperCase() });
  });

  if (sectorLabel) {
    const hasSector = ledgerRows.some((row) => row.label.includes('SECTOR'));
    if (!hasSector) {
      ledgerRows.splice(Math.min(1, ledgerRows.length), 0, {
        label: 'SECTOR',
        value: sectorLabel.toUpperCase(),
      });
    }
  }

  // Typed/decrypted comes from existing gameplay flags — not string parsing.
  const resolved = contactTyped || signalDecrypted;
  ledgerRows.push({
    label: 'SIGNAL STATE',
    value: resolved ? 'DECRYPTED' : 'VECTOR LOCKED',
  });

  if (idleMessage) {
    ledgerRows.push({
      label: 'SCANNER STATE',
      value: idleMessage.toUpperCase(),
    });
  }

  return {
    vectorId,
    vectorTitle,
    classification,
    ledgerRows,
    idle: false,
    resolved,
  };
}

/** Node readout + breach action — card (legacy) or Signal Dossier dock. */
export default function InlineScannerEngagement({
  headline,
  spectralLines,
  statusLines = [],
  idleMessage,
  signalDecrypted = false,
  contactTyped = false,
  sectorLabel,
  selectedBearingDeg: _selectedBearingDeg = null,
  fingerprintSeed: _fingerprintSeed,
  fingerprintAccent: _fingerprintAccent,
  canEngage,
  accent,
  mutedColor,
  onEngage,
  layout = 'card',
  engageLabel = '[ ENGAGE ]',
  sonarPrompt,
}: InlineScannerEngagementProps): React.JSX.Element {
  const dossier = useMemo(
    () => buildDossierFromLines(
      spectralLines,
      statusLines,
      sectorLabel,
      signalDecrypted,
      idleMessage,
      contactTyped,
    ),
    [contactTyped, idleMessage, sectorLabel, signalDecrypted, spectralLines, statusLines],
  );

  if (layout === 'dock') {
    const readinessLine = canEngage
      ? 'LINK READY // SIGNAL DECRYPTED'
      : signalDecrypted
        ? 'SIGNAL DECRYPTED // SELECT CONTACT TO BREACH'
        : 'SWEEP ACTIVE // AWAITING VECTOR LOCK';
    const eyebrow = dossier.idle
      ? 'SIGNAL DOSSIER // VECTOR UNKNOWN'
      : 'SIGNAL DOSSIER // LOCKED VECTOR';
    const titlePrimary = dossier.idle
      ? 'NO VECTOR'
      : dossier.resolved
        ? (dossier.vectorTitle ?? dossier.classification ?? 'SIGNAL')
            .replace(/^VECTOR\s+/i, '')
            .toUpperCase()
        : 'UNRESOLVED';
    const titleSecondary = dossier.idle
      ? 'LOCK'
      : dossier.resolved
        ? null
        : 'SIGNAL';

    return (
      <View style={styles.dockRoot}>
        <View style={styles.dossierHeader}>
          <FieldSectionHeader label={eyebrow} />
          <Text
            style={[
              styles.dossierTitle,
              dossier.idle || !dossier.resolved ? styles.dossierTitleIdle : null,
            ]}
            numberOfLines={1}
          >
            {titlePrimary}
          </Text>
          {titleSecondary ? (
            <Text
              style={[
                styles.dossierTitle,
                dossier.idle ? styles.dossierTitleIdle : null,
              ]}
              numberOfLines={1}
            >
              {titleSecondary}
            </Text>
          ) : null}
        </View>

        <ScrollView
          style={styles.dossierScroll}
          contentContainerStyle={styles.dossierScrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {headline ? (
            <Text style={styles.feedHeadline} numberOfLines={2}>
              {headline}
            </Text>
          ) : null}

          {dossier.resolved && dossier.classification ? (
            <SignalClassification value={dossier.classification} />
          ) : null}

          <FieldSectionHeader label="Signal metadata" meta={dossier.resolved ? 'Decrypted' : 'Partial lock'} />
          <SignalMetadataLedger rows={dossier.ledgerRows} />

          <View style={styles.negativeSpace} />
        </ScrollView>

        {sonarPrompt}

        <View style={styles.footer}>
          <BreachAction
            enabled={canEngage}
            label={engageLabel.replace(/[[\]]/g, '').trim() || 'BREACH'}
            readinessLine={readinessLine}
            mutedColor={mutedColor}
            onPress={onEngage}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.panel} pointerEvents="box-none">
      <View style={styles.readoutShell}>
        {headline ? (
          <Text style={[styles.headline, { color: accent }]} numberOfLines={2}>
            {headline}
          </Text>
        ) : null}

        {spectralLines.map((line) => (
          <Text key={line} style={[styles.spectralLine, { color: accent }]} numberOfLines={2}>
            {line}
          </Text>
        ))}

        {statusLines.map((line) => (
          <Text key={line} style={[styles.statusLine, { color: mutedColor }]} numberOfLines={2}>
            {line}
          </Text>
        ))}

        <ScannerBreachButton
          label={engageLabel}
          enabled={canEngage}
          accent={accent}
          mutedColor={mutedColor}
          onPress={onEngage}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: 200 },
  readoutShell: {
    borderWidth: 1,
    borderColor: RUN_FIELD.line,
    backgroundColor: RUN_FIELD.panel,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  headline: {
    fontFamily: 'monospace',
    fontSize: 7,
    lineHeight: 10,
    letterSpacing: 0.4,
    fontWeight: '700',
  },
  spectralLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    lineHeight: 9,
    letterSpacing: 0.3,
  },
  statusLine: {
    fontFamily: 'monospace',
    fontSize: 7,
    lineHeight: 9,
    letterSpacing: 0.3,
    fontWeight: '600',
  },
  dockRoot: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  dossierHeader: {
    position: 'relative',
    zIndex: 1,
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 22,
    gap: 8,
    flexShrink: 0,
  },
  dossierTitle: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.section,
    lineHeight: RUN_FIELD.type.section * 1.1,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: RUN_FIELD.text,
    ...Platform.select({
      web: {
        fontSize: 'clamp(15px, 0.95vw, 18px)',
      } as object,
      default: {},
    }),
  },
  dossierTitleIdle: {
    color: RUN_FIELD.textSecondary,
    fontWeight: '700',
  },
  dossierScroll: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
  },
  dossierScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 8,
  },
  feedHeadline: {
    fontFamily: RUN_FIELD.mono,
    fontSize: RUN_FIELD.type.secondary,
    lineHeight: RUN_FIELD.type.secondary * 1.35,
    letterSpacing: 0.4,
    color: RUN_FIELD.textSecondary,
    marginBottom: 8,
  },
  negativeSpace: {
    flexGrow: 1,
    minHeight: 48,
    width: '100%',
  },
  footer: {
    zIndex: 1,
    paddingHorizontal: 22,
    paddingBottom: 18,
    flexShrink: 0,
  },
});
