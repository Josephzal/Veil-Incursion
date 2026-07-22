import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import { VEIL } from '../../theme/veilTerminalTokens';

interface BrokerPriorityBulletinProps {
  sectorLabel: string;
  headline: string;
  description: string;
  /** Small classification metadata (e.g. UNSTABLE RESOURCE), same line as the eyebrow. */
  classification?: string | null;
  compact?: boolean;
}

/**
 * Non-interactive intelligence bulletin for the Contract Board feed.
 * Must never share the selectable contract-row shell.
 */
export default function BrokerPriorityBulletin({
  sectorLabel,
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
            // Semantic aside; never interactive.
            role: 'complementary',
            'aria-label': `Broker priority. ${headline}. ${description}`,
          } as object)
        : null)}
    >
      <View style={styles.body}>
        <View
          pointerEvents="none"
          accessible={false}
          {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
          style={styles.accent}
        />
        <View style={styles.metaRow}>
          <TerminalText size={6.5} letterSpacing={1} style={styles.meta} numberOfLines={1}>
            {`BROKER PRIORITY // ${sectorLabel}`}
          </TerminalText>
          {classification ? (
            <TerminalText size={6} letterSpacing={0.95} style={styles.classification} numberOfLines={1}>
              {classification}
            </TerminalText>
          ) : null}
        </View>
        <TerminalText size={14} letterSpacing={0.2} style={styles.headline} numberOfLines={1}>
          {headline}
        </TerminalText>
        <TerminalText size={7.5} letterSpacing={0.1} style={styles.description} numberOfLines={1}>
          {description}
        </TerminalText>
      </View>
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
    minHeight: 64,
    maxHeight: 72,
    width: '100%',
    ...Platform.select({
      web: {
        cursor: 'default',
        userSelect: 'text',
      } as object,
      default: {},
    }),
  },
  hostCompact: {
    minHeight: 58,
    maxHeight: 64,
  },
  body: {
    position: 'relative',
    flex: 1,
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 14,
    paddingRight: 2,
    // Flat bulletin — no filled surface / card shell.
    backgroundColor: 'transparent',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 12,
    height: 28,
    width: 2,
    backgroundColor: VEIL.occult,
    opacity: 0.7,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  meta: {
    flex: 1,
    minWidth: 0,
    color: VEIL.occultPale,
    fontWeight: '700',
  },
  classification: {
    flexShrink: 0,
    color: 'rgba(179, 162, 192, 0.72)',
    fontWeight: '700',
  },
  headline: {
    marginTop: 4,
    color: VEIL.bone,
    fontWeight: '700',
  },
  description: {
    marginTop: 3,
    color: '#9AA39D',
    fontWeight: '600',
  },
});
