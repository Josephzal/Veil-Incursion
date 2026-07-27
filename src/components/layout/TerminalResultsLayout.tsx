import React from 'react';
import { Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  LANDSCAPE_PANEL_PADDING,
  META_RESULTS_CARD_MAX_WIDTH,
  META_RESULTS_CARD_MAX_WIDTH_WIDE,
  META_RESULTS_CARD_VIEWPORT_MARGIN,
  META_RESULTS_PRIMARY_RATIO,
} from '../../constants/landscapeLayout';
import { useLandscapeMetrics } from '../../hooks/useLandscapeMetrics';
import LandscapeSplitPane from './LandscapeSplitPane';
import { VEIL } from '../../theme/veilTerminalTokens';

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

function resolveCardWidthStyle(breakpoint: 'compact' | 'standard' | 'wide'): ViewStyle {
  const tokenMax = breakpoint === 'wide'
    ? META_RESULTS_CARD_MAX_WIDTH_WIDE
    : META_RESULTS_CARD_MAX_WIDTH;

  if (Platform.OS === 'web') {
    return {
      width: '100%',
      maxWidth: `min(${tokenMax}px, calc(100vw - ${META_RESULTS_CARD_VIEWPORT_MARGIN}px))`,
    } as unknown as ViewStyle;
  }

  return {
    width: '100%',
    maxWidth: tokenMax,
  };
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
  accentBorderColor = VEIL.line,
}: TerminalResultsLayoutProps): React.JSX.Element {
  const { useHorizontalSplit, breakpoint } = useLandscapeMetrics();
  const cardWidthStyle = resolveCardWidthStyle(breakpoint);

  const summaryColumn = (
    <View style={styles.summaryColumn}>
      <ScrollView
        style={styles.summaryScroll}
        contentContainerStyle={styles.summaryScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {summary}
      </ScrollView>
      <View style={styles.footerSlot}>{footer}</View>
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
      <ScrollView
        style={styles.compactSummaryScroll}
        contentContainerStyle={styles.compactSummaryScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {summary}
      </ScrollView>
      {footer}
    </View>
  );

  if (useHorizontalSplit) {
    return (
      <View style={[styles.root, style]}>
        <View style={styles.desktopWorkspace}>
          <View
            style={[
              styles.card,
              styles.cardDesktop,
              cardWidthStyle,
              { borderColor: accentBorderColor },
            ]}
          >
            {body}
          </View>
        </View>
      </View>
    );
  }

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
            cardWidthStyle,
            { borderColor: accentBorderColor },
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
  desktopWorkspace: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: LANDSCAPE_PANEL_PADDING,
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
  cardDesktop: {
    flex: 1,
    maxHeight: '94%',
    minHeight: 0,
    minWidth: 0,
  },
  split: {
    flex: 1,
    minHeight: 0,
  },
  splitPane: {
    minHeight: 0,
  },
  narrativeColumn: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 8,
    minHeight: 0,
  },
  summaryColumn: {
    flex: 1,
    minHeight: 0,
    gap: 12,
    paddingLeft: 8,
  },
  summaryScroll: {
    flex: 1,
    minHeight: 0,
  },
  summaryScrollContent: {
    flexGrow: 1,
    gap: 4,
    paddingBottom: 4,
  },
  footerSlot: {
    flexShrink: 0,
  },
  compactSummaryScroll: {
    maxHeight: 360,
    flexGrow: 0,
  },
  compactSummaryScrollContent: {
    gap: 4,
  },
  stacked: {
    gap: 16,
    justifyContent: 'center',
  },
});
