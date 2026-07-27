import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { RUN_FIELD } from '../../theme/runFieldTokens';

interface HarvestScreenHeaderProps {
  title?: string;
  eyebrow?: string;
  statusLine: string;
  depthLabel: string;
  cargoLabel?: string | null;
  fontScale: number;
}

/**
 * Page header for Resource Harvest — RESOURCE HARVEST is the only display title.
 * Field-scoped styling (RUN_FIELD) — no scanner token imports.
 * Height stays tall enough for full glyph boxes (no clipped title).
 */
export default function HarvestScreenHeader({
  title = 'RESOURCE HARVEST',
  eyebrow = 'FIELD RECOVERY // RH-01',
  statusLine,
  depthLabel,
  cargoLabel = null,
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
          >
            {eyebrow}
          </TerminalText>
          <TerminalText
            size={18 * fontScale}
            letterSpacing={0.7}
            style={styles.title}
          >
            {title}
          </TerminalText>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <TerminalText
              size={6.5 * fontScale}
              letterSpacing={0.9}
              style={styles.liveLine}
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
          >
            {depthLabel}
          </TerminalText>
          {cargoLabel ? (
            <TerminalText
              size={6.5 * fontScale}
              letterSpacing={1}
              style={styles.metaLabel}
            >
              {cargoLabel}
            </TerminalText>
          ) : null}
        </View>
      </View>
      <View style={styles.baseline} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    minHeight: 104,
    maxHeight: 112,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 8,
    backgroundColor: RUN_FIELD.panelWash,
    flexShrink: 0,
    justifyContent: 'center',
    overflow: 'visible',
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
    gap: 4,
    overflow: 'visible',
  },
  eyebrow: {
    color: 'rgba(99, 226, 177, 0.62)',
    fontWeight: '700',
    ...Platform.select({
      web: {
        fontSize: 'clamp(11px, 0.7vw, 12px)',
        lineHeight: '1.25',
      } as object,
      default: {
        lineHeight: 16,
      },
    }),
  },
  title: {
    color: RUN_FIELD.text,
    fontWeight: '800',
    textTransform: 'uppercase',
    ...Platform.select({
      web: {
        fontSize: 'clamp(34px, 2vw, 38px)',
        lineHeight: '1.05',
        letterSpacing: '0.03em',
      } as object,
      default: {
        lineHeight: 40,
      },
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
    backgroundColor: RUN_FIELD.mint,
    opacity: 0.85,
  },
  liveLine: {
    color: RUN_FIELD.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    flexShrink: 1,
    ...Platform.select({
      web: {
        fontSize: 'clamp(11px, 0.7vw, 12px)',
        lineHeight: '1.25',
      } as object,
      default: {
        lineHeight: 16,
      },
    }),
  },
  meta: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
    paddingTop: 2,
  },
  metaLabel: {
    color: RUN_FIELD.textSecondary,
    fontWeight: '600',
    ...Platform.select({
      web: {
        fontSize: 'clamp(11px, 0.7vw, 12px)',
        lineHeight: '1.25',
      } as object,
      default: {
        lineHeight: 16,
      },
    }),
  },
  baseline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    backgroundColor: RUN_FIELD.line,
    marginTop: 10,
  },
});
