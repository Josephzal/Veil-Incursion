import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import CabalMark from './veilChrome/CabalMark';
import { VEIL, type VeilTone } from '../../theme/veilTerminalTokens';

export type ContractGroupHeaderVariant = 'cabal' | 'blackChannel';

interface ContractGroupHeaderProps {
  /** Primary category label (e.g. LEGION or BLACK CHANNEL). */
  primaryLabel: string;
  /** Secondary category label after // (e.g. AVAILABLE CONTRACTS). */
  secondaryLabel: string;
  /** Right-side meta (e.g. 2 AVAILABLE or 1 ROUTE // UNVERIFIED). */
  meta: string;
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
  meta,
  tone,
  variant = 'cabal',
}: ContractGroupHeaderProps): React.JSX.Element {
  const isBlack = variant === 'blackChannel';
  const primaryColor = isBlack ? tone.accent : 'rgba(185, 181, 167, 0.88)';
  const secondaryColor = isBlack ? 'rgba(159, 89, 99, 0.62)' : 'rgba(138, 150, 144, 0.78)';

  return (
    <View
      style={styles.host}
      accessibilityRole="text"
      accessibilityLabel={`${primaryLabel} ${secondaryLabel}. ${meta}`}
    >
      <View style={styles.row}>
        <View style={styles.left}>
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
        <TerminalText
          size={7}
          letterSpacing={0.9}
          style={[styles.meta, isBlack && { color: 'rgba(159, 89, 99, 0.7)' }]}
          numberOfLines={1}
        >
          {meta}
        </TerminalText>
      </View>
      <View
        style={styles.ruleTrack}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      >
        {isBlack ? (
          <View style={[styles.ruleAccent, { backgroundColor: tone.accent }]} />
        ) : null}
        <View style={styles.ruleRest} />
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
    justifyContent: 'flex-end',
    ...Platform.select({
      web: {
        cursor: 'default',
      } as object,
      default: {},
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 28,
    paddingBottom: 6,
    paddingHorizontal: 18,
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleCluster: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
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
  ruleTrack: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    height: 1,
  },
  ruleAccent: {
    width: 28,
    height: 1,
    opacity: 0.85,
  },
  ruleRest: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(185, 181, 167, 0.42)',
  },
});
