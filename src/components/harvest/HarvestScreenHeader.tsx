import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import {
  SCANNER_BORDER_QUIET,
  SCANNER_HEADER_BG,
  SCANNER_PHOSPHOR,
  SCANNER_TEXT_PRIMARY,
  SCANNER_TEXT_SECONDARY,
} from '../scanner/vectorScannerShared';

interface HarvestScreenHeaderProps {
  title?: string;
  eyebrow?: string;
  statusLine: string;
  depthLabel: string;
  cargoLabel: string;
  fontScale: number;
}

/**
 * Field-scanner-aligned page header for Resource Harvest (in-run operational screen).
 */
export default function HarvestScreenHeader({
  title = 'RESOURCE HARVEST',
  eyebrow = 'FIELD RECOVERY // RH-01',
  statusLine,
  depthLabel,
  cargoLabel,
  fontScale,
}: HarvestScreenHeaderProps): React.JSX.Element {
  const titleSize = Math.min(30, Math.max(26, 15 * fontScale));

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <TerminalText size={6.5} letterSpacing={1.1} style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </TerminalText>
          <TerminalText
            size={titleSize}
            letterSpacing={0.85}
            style={styles.title}
            numberOfLines={1}
          >
            {title}
          </TerminalText>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <TerminalText size={7} letterSpacing={0.95} style={styles.liveLine} numberOfLines={1}>
              {statusLine}
            </TerminalText>
          </View>
        </View>
        <View style={styles.meta}>
          <TerminalText size={7} letterSpacing={1.05} style={styles.metaLabel} numberOfLines={1}>
            {depthLabel}
          </TerminalText>
          <TerminalText size={7} letterSpacing={1.05} style={styles.metaLabel} numberOfLines={1}>
            {cargoLabel}
          </TerminalText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    minHeight: 68,
    maxHeight: 78,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SCANNER_BORDER_QUIET,
    backgroundColor: SCANNER_HEADER_BG,
    flexShrink: 0,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '700',
  },
  title: {
    color: SCANNER_TEXT_PRIMARY,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 1,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SCANNER_PHOSPHOR,
  },
  liveLine: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '700',
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  metaLabel: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '700',
  },
});
