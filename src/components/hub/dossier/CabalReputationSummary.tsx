import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import TerminalText from '../../TerminalText';
import type { CabalReputationProgress } from '../../../data/cabalRepEngine';
import { VEIL, type VeilTone } from '../../../theme/veilTerminalTokens';

interface CabalReputationSummaryProps {
  progress: CabalReputationProgress;
  tone: VeilTone;
  /** Independent / non-ranked channel — no Cabal progression track. */
  independent?: boolean;
}

/** Compact selected-Cabal reputation tracker for the contract feed. */
export default function CabalReputationSummary({
  progress,
  tone,
  independent = false,
}: CabalReputationSummaryProps): React.JSX.Element {
  if (independent) {
    return (
      <View
        style={styles.host}
        accessibilityRole="text"
        accessibilityLabel="Independent channel. No Cabal reputation."
      >
        <TerminalText size={6.5} letterSpacing={1} style={styles.sectionLabel}>
          CHANNEL STATUS
        </TerminalText>
        <TerminalText size={9} letterSpacing={0.45} style={[styles.rankLine, { color: tone.accent }]}>
          INDEPENDENT CHANNEL // NO CABAL REPUTATION
        </TerminalText>
      </View>
    );
  }

  const fillWidth = `${Math.min(100, Math.max(0, progress.percent))}%`;

  return (
    <View
      style={styles.host}
      accessibilityRole="text"
      accessibilityLabel={progress.accessibilityLabel}
    >
      <TerminalText size={6.5} letterSpacing={1} style={styles.sectionLabel}>
        CABAL REPUTATION
      </TerminalText>
      <TerminalText size={10} letterSpacing={0.4} style={styles.rankLine} numberOfLines={1}>
        {`RANK ${progress.rank} // ${progress.rankLabel}`}
      </TerminalText>
      {progress.isMaxRank ? (
        <>
          <TerminalText size={8} letterSpacing={0.35} style={styles.progressNums}>
            REPUTATION SECURED
          </TerminalText>
          <TerminalText size={7} letterSpacing={0.55} style={[styles.remaining, { color: tone.accent }]}>
            MAXIMUM RANK
          </TerminalText>
        </>
      ) : (
        <>
          <TerminalText size={8} letterSpacing={0.35} style={styles.progressNums}>
            {`${progress.current} / ${progress.required} REP`}
          </TerminalText>
          <TerminalText size={7} letterSpacing={0.55} style={styles.remaining}>
            {`${progress.remaining} REP TO RANK ${progress.nextRank}`}
          </TerminalText>
        </>
      )}
      <View
        style={styles.track}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        {...(Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : null)}
      >
        <View
          style={[
            styles.fill,
            {
              width: fillWidth as `${number}%`,
              backgroundColor: tone.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexGrow: 0,
    flexShrink: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    color: '#9CA7A0',
    fontWeight: '700',
    marginBottom: 5,
  },
  rankLine: {
    color: VEIL.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  progressNums: {
    color: '#BCC6C0',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginBottom: 3,
  },
  remaining: {
    color: '#9CA7A0',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  track: {
    height: 4,
    width: '100%',
    maxWidth: 420,
    backgroundColor: VEIL.surface1,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VEIL.lineFaint,
  },
  fill: {
    height: '100%',
    ...Platform.select({
      web: {
        transitionProperty: 'width',
        transitionDuration: '140ms',
        transitionTimingFunction: 'ease-out',
      } as object,
      default: {},
    }),
  },
});
