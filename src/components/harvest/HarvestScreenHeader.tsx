import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
 * Compact page header for Resource Harvest — RESOURCE HARVEST is the only display title.
 */
export default function HarvestScreenHeader({
  title = 'RESOURCE HARVEST',
  eyebrow = 'FIELD RECOVERY // RH-01',
  statusLine,
  depthLabel,
  cargoLabel,
  fontScale,
}: HarvestScreenHeaderProps): React.JSX.Element {
  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <TerminalText
            size={6.5 * fontScale}
            letterSpacing={1.05}
            style={styles.eyebrow}
            numberOfLines={1}
          >
            {eyebrow}
          </TerminalText>
          <TerminalText
            size={20 * fontScale}
            letterSpacing={0.7}
            style={styles.title}
            numberOfLines={1}
          >
            {title}
          </TerminalText>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <TerminalText
              size={6.5 * fontScale}
              letterSpacing={0.9}
              style={styles.liveLine}
              numberOfLines={1}
            >
              {statusLine}
            </TerminalText>
          </View>
        </View>
        <View style={styles.meta}>
          <TerminalText
            size={6.5 * fontScale}
            letterSpacing={1}
            style={styles.metaLabel}
            numberOfLines={1}
          >
            {depthLabel}
          </TerminalText>
          <TerminalText
            size={6.5 * fontScale}
            letterSpacing={1}
            style={styles.metaLabel}
            numberOfLines={1}
          >
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
    minHeight: 72,
    maxHeight: 96,
    paddingTop: 8,
    paddingBottom: 10,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SCANNER_BORDER_QUIET,
    backgroundColor: SCANNER_HEADER_BG,
    flexShrink: 0,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eyebrow: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '600',
    ...Platform.select({
      web: {
        fontSize: 'clamp(11px, 0.7vw, 12px)',
      } as object,
      default: {},
    }),
  },
  title: {
    color: SCANNER_TEXT_PRIMARY,
    fontWeight: '800',
    textTransform: 'uppercase',
    lineHeight: 36,
    marginVertical: 0,
    ...Platform.select({
      web: {
        fontSize: 'clamp(36px, 2.2vw, 42px)',
        lineHeight: 0.98,
        letterSpacing: '0.03em',
      } as object,
      default: {},
    }),
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 2,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: SCANNER_PHOSPHOR,
    opacity: 0.85,
  },
  liveLine: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '600',
    textTransform: 'uppercase',
    flexShrink: 1,
    ...Platform.select({
      web: {
        fontSize: 'clamp(11px, 0.7vw, 12px)',
      } as object,
      default: {},
    }),
  },
  meta: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
    paddingTop: 2,
  },
  metaLabel: {
    color: SCANNER_TEXT_SECONDARY,
    fontWeight: '600',
    ...Platform.select({
      web: {
        fontSize: 'clamp(11px, 0.7vw, 12px)',
      } as object,
      default: {},
    }),
  },
});
