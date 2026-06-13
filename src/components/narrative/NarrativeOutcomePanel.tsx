import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NarrativeOutcomeSummary } from '../../data/narrative/narrativeOutcomeSummary';
import SelectionContinueButton from '../SelectionContinueButton';

const TERMINAL_ACCENT = '#00ff33';
const BONUS_ACCENT = '#7dd3fc';
const FAILURE_ACCENT = '#f87171';
const REWARD_ACCENT = '#4ade80';
const PENALTY_ACCENT = '#fb923c';
const AMBUSH_ACCENT = '#f472b6';

interface NarrativeOutcomePanelProps {
  summary: NarrativeOutcomeSummary;
  bonusLine?: string | null;
  onContinue: () => void;
  borderColor?: string;
  mutedColor?: string;
  primaryColor?: string;
  cityStreets?: boolean;
}

export default function NarrativeOutcomePanel({
  summary,
  bonusLine,
  onContinue,
  borderColor = '#334155',
  mutedColor = '#94a3b8',
  primaryColor = '#f8fafc',
  cityStreets = false,
}: NarrativeOutcomePanelProps): React.JSX.Element {
  const accent = summary.status === 'SUCCESS' ? TERMINAL_ACCENT : FAILURE_ACCENT;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.panel,
            { borderColor: accent },
            cityStreets && styles.panelCityStreets,
          ]}
        >
          <Text style={[styles.headline, { color: accent }]}>{summary.headline}</Text>
          <Text style={[styles.sectionLabel, { color: mutedColor }]}>OUTCOME</Text>
          {summary.outcomeLines.map((line) => (
            <Text key={line} style={[styles.outcomeLine, { color: primaryColor }]}>
              {line}
            </Text>
          ))}

          {summary.rewardLines.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, styles.sectionGap, { color: mutedColor }]}>
                REWARDS
              </Text>
              {summary.rewardLines.map((line) => (
                <Text key={line} style={[styles.rewardLine, { color: REWARD_ACCENT }]}>
                  {line}
                </Text>
              ))}
              {bonusLine ? (
                <Text style={[styles.bonusLine, { color: BONUS_ACCENT }]}>{bonusLine}</Text>
              ) : null}
            </>
          ) : null}

          {summary.penaltyLines.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, styles.sectionGap, { color: mutedColor }]}>
                CONSEQUENCES
              </Text>
              {summary.penaltyLines.map((line) => (
                <Text key={line} style={[styles.penaltyLine, { color: PENALTY_ACCENT }]}>
                  {line}
                </Text>
              ))}
            </>
          ) : null}

          {summary.ambushPending ? (
            <Text style={[styles.ambushLine, { color: AMBUSH_ACCENT }]}>
              {'>> HOSTILE SIGNATURES DETECTED — COMBAT IMMINENT'}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <SelectionContinueButton
          enabled
          onPress={onContinue}
          label={summary.continueLabel}
          borderColor={borderColor}
          mutedColor={mutedColor}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'space-between',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  panel: {
    borderWidth: 2,
    padding: 16,
    gap: 6,
  },
  panelCityStreets: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  headline: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 2,
  },
  sectionGap: {
    marginTop: 10,
  },
  outcomeLine: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 17,
  },
  rewardLine: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  bonusLine: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  penaltyLine: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  ambushLine: {
    fontFamily: 'monospace',
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.5,
    marginTop: 10,
  },
  footer: {
    flexShrink: 0,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
