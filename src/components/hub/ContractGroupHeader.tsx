import React from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import CabalMark from './veilChrome/CabalMark';
import { type VeilTone } from '../../theme/veilTerminalTokens';

export type ContractGroupHeaderVariant = 'cabal' | 'blackChannel';

interface ContractGroupHeaderProps {
  /** Primary category label (e.g. LEGION or BLACK CHANNEL). */
  primaryLabel: string;
  /** Secondary category label after // (e.g. AVAILABLE CONTRACTS). */
  secondaryLabel: string;
  /** Optional right-side meta (e.g. 2 AVAILABLE). */
  meta?: string | null;
  tone: VeilTone;
  variant?: ContractGroupHeaderVariant;
}

/**
 * Non-interactive contract-family divider for the Contract Board feed.
 * Establishes a category band above selectable records.
 */
export default function ContractGroupHeader({
  primaryLabel,
  secondaryLabel,
  meta = null,
  tone,
  variant = 'cabal',
}: ContractGroupHeaderProps): React.JSX.Element {
  const isBlack = variant === 'blackChannel';
  const primaryColor = isBlack ? tone.accent : 'rgba(185, 181, 167, 0.88)';
  const secondaryColor = isBlack ? 'rgba(159, 89, 99, 0.62)' : 'rgba(138, 150, 144, 0.78)';
  const a11yMeta = meta ? `. ${meta}` : '';

  return (
    <View
      style={styles.host}
      accessibilityRole="text"
      accessibilityLabel={`${primaryLabel} ${secondaryLabel}${a11yMeta}`}
    >
      <View style={styles.row}>
        <View style={styles.titleRow}>
          <CabalMark tone={tone} selected size="sm" />
          <View style={styles.titleCluster}>
            <TerminalText size={11} letterSpacing={1.05} style={[styles.primary, { color: primaryColor }]}>
              {primaryLabel}
            </TerminalText>
            <TerminalText size={11} letterSpacing={1.05} style={[styles.separator, { color: secondaryColor }]}>
              {' // '}
            </TerminalText>
            <TerminalText size={11} letterSpacing={1.05} style={[styles.secondary, { color: secondaryColor }]}>
              {secondaryLabel}
            </TerminalText>
          </View>
        </View>
        {meta ? (
          <TerminalText
            size={7}
            letterSpacing={0.9}
            style={styles.meta}
            numberOfLines={1}
          >
            {meta}
          </TerminalText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 34,
    height: 36,
    maxHeight: 38,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 28,
    // Horizontal inset comes from the feed host so cards + header share one edge.
    paddingHorizontal: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '78%',
  },
  titleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    flexShrink: 1,
    minWidth: 0,
  },
  primary: {
    fontWeight: '700',
  },
  separator: {
    fontWeight: '700',
  },
  secondary: {
    fontWeight: '700',
    flexShrink: 1,
  },
  meta: {
    flexShrink: 0,
    color: 'rgba(138, 150, 144, 0.78)',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
