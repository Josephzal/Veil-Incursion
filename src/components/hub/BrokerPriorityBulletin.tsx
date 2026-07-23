import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { VEIL } from '../../theme/veilTerminalTokens';

interface BrokerPriorityBulletinProps {
  headline: string;
  description: string;
  /** Small classification metadata (e.g. UNSTABLE RESOURCE). */
  classification?: string | null;
  compact?: boolean;
}

/**
 * Non-interactive intelligence bulletin for the Contract Board feed.
 * Typography mirrors CabalReputationSummary so the two columns align.
 */
export default function BrokerPriorityBulletin({
  headline,
  description,
  classification = null,
  compact = false,
}: BrokerPriorityBulletinProps): React.JSX.Element {
  return (
    <View
      style={[styles.host, compact && styles.hostCompact]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Broker priority. ${headline}. ${description}`}
      importantForAccessibility="yes"
      pointerEvents="box-none"
      {...(Platform.OS === 'web'
        ? ({
            role: 'complementary',
            'aria-label': `Broker priority. ${headline}. ${description}`,
          } as object)
        : null)}
    >
      <View style={styles.metaRow}>
        <TerminalText size={6.5} letterSpacing={1} style={styles.sectionLabel} numberOfLines={1}>
          BROKER PRIORITY
        </TerminalText>
        {classification ? (
          <TerminalText size={6} letterSpacing={0.95} style={styles.classification} numberOfLines={1}>
            {classification}
          </TerminalText>
        ) : null}
      </View>
      <TerminalText size={10} letterSpacing={0.4} style={styles.headline}>
        {headline}
      </TerminalText>
      <TerminalText size={7.5} letterSpacing={0.1} style={styles.description}>
        {description}
      </TerminalText>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexGrow: 1,
    flexShrink: 1,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    minWidth: 0,
    width: '100%',
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        cursor: 'default',
        userSelect: 'text',
      } as object,
      default: {},
    }),
  },
  hostCompact: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
    marginBottom: 5,
  },
  sectionLabel: {
    flexShrink: 1,
    minWidth: 0,
    color: '#9CA7A0',
    fontWeight: '700',
  },
  classification: {
    flexShrink: 0,
    color: 'rgba(179, 162, 192, 0.72)',
    fontWeight: '700',
  },
  headline: {
    color: VEIL.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    color: '#B0BAB4',
    fontWeight: '600',
  },
});
