import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  LANDSCAPE_PANEL_PADDING,
  META_RESULTS_CARD_MAX_WIDTH,
  META_RESULTS_CARD_MAX_WIDTH_WIDE,
  META_RESULTS_PRIMARY_RATIO,
} from '../../constants/landscapeLayout';
import { useLandscapeMetrics } from '../../hooks/useLandscapeMetrics';
import LandscapeSplitPane from './LandscapeSplitPane';

interface TerminalResultsLayoutProps {
  /** Title block — headline, subtitle, body copy. */
  narrative: React.ReactNode;
  /** Stats / summary panel. */
  summary: React.ReactNode;
  /** Primary CTA pinned below summary on wide, after stack on compact. */
  footer: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accentBorderColor?: string;
}

/**
 * Centered meta-screen layout for Game Over / Run Complete.
 * Wide: narrative | summary+footer side-by-side inside a centered card.
 * Compact: single stacked column.
 */
export default function TerminalResultsLayout({
  narrative,
  summary,
  footer,
  style,
  accentBorderColor = '#334155',
}: TerminalResultsLayoutProps): React.JSX.Element {
  const { useHorizontalSplit, breakpoint } = useLandscapeMetrics();
  const cardMaxWidth = breakpoint === 'wide'
    ? META_RESULTS_CARD_MAX_WIDTH_WIDE
    : META_RESULTS_CARD_MAX_WIDTH;

  const summaryColumn = (
    <View style={styles.summaryColumn}>
      {summary}
      {footer}
    </View>
  );

  const body = useHorizontalSplit ? (
    <LandscapeSplitPane
      style={styles.split}
      primary={(
        <View style={styles.narrativeColumn}>{narrative}</View>
      )}
      secondary={summaryColumn}
      primaryRatio={META_RESULTS_PRIMARY_RATIO}
      primaryStyle={styles.splitPane}
      secondaryStyle={styles.splitPane}
    />
  ) : (
    <View style={styles.stacked}>
      {narrative}
      {summary}
      {footer}
    </View>
  );

  return (
    <View style={[styles.root, style]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            {
              maxWidth: cardMaxWidth,
              borderColor: accentBorderColor,
            },
          ]}
        >
          {body}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: LANDSCAPE_PANEL_PADDING,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    backgroundColor: 'rgba(5, 6, 8, 0.94)',
    padding: 20,
  },
  split: {
    minHeight: 0,
  },
  splitPane: {
    minHeight: 0,
    justifyContent: 'center',
  },
  narrativeColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 4,
  },
  summaryColumn: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingLeft: 4,
  },
  stacked: {
    gap: 16,
    justifyContent: 'center',
  },
});
