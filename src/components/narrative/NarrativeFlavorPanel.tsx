import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NARRATIVE_BODY_LINE_HEIGHT } from '../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

interface NarrativeFlavorPanelProps {
  flavorText: string;
  primaryColor?: string;
  mutedColor?: string;
}

const MUTED_WHITE = '#F8FAFC';

/**
 * Left-column field report — Terran Grid document panel over narrative art.
 */
export default function NarrativeFlavorPanel({
  flavorText,
  primaryColor = MUTED_WHITE,
  mutedColor = '#94a3b8',
}: NarrativeFlavorPanelProps): React.JSX.Element {
  const { scaleFont, scaleSpacing, fontScale } = useResponsiveLayout();
  const panelPadding = scaleSpacing(32);

  return (
    <View
      style={[
        styles.panel,
        {
          padding: panelPadding,
        },
      ]}
    >
      <Text
        style={[
          styles.panelLabel,
          {
            color: mutedColor,
            fontSize: 9 * fontScale,
            lineHeight: 13 * fontScale,
            marginBottom: scaleSpacing(12),
          },
        ]}
      >
        FIELD REPORT // EVENT BRIEF
      </Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={[
            styles.flavorText,
            {
              color: primaryColor,
              fontSize: scaleFont(11),
              lineHeight: scaleFont(NARRATIVE_BODY_LINE_HEIGHT),
            },
          ]}
        >
          {flavorText}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'flex-start',
  },
  panelLabel: {
    fontFamily: 'monospace',
    letterSpacing: 1,
    fontWeight: '700',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    flexGrow: 0,
    justifyContent: 'flex-start',
    paddingBottom: 8,
  },
  flavorText: {
    fontFamily: 'monospace',
    letterSpacing: 0.25,
  },
});
