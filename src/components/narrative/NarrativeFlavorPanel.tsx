import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NARRATIVE_BODY_LINE_HEIGHT } from '../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';

interface NarrativeFlavorPanelProps {
  flavorText: string;
  primaryColor?: string;
  mutedColor?: string;
}

/**
 * Left-column event brief — narrative flavor over the background art,
 * separate from the right-side expedition resolver terminal.
 */
export default function NarrativeFlavorPanel({
  flavorText,
  primaryColor = '#f8fafc',
  mutedColor = '#94a3b8',
}: NarrativeFlavorPanelProps): React.JSX.Element {
  const { scaleFont, scaleSpacing, isDesktop } = useResponsiveLayout();
  const panelPadding = isDesktop ? scaleSpacing(24) : scaleSpacing(16);

  return (
    <View style={[styles.root, { padding: panelPadding }]}>
      <View
        style={[
          styles.panel,
          {
            padding: panelPadding,
            maxHeight: isDesktop ? '72%' : '88%',
          },
        ]}
      >
        <Text
          style={[
            styles.panelLabel,
            {
              color: mutedColor,
              fontSize: scaleFont(8),
              lineHeight: scaleFont(11),
              marginBottom: scaleSpacing(10),
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  panelLabel: {
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  flavorText: {
    fontFamily: 'monospace',
    letterSpacing: 0.25,
  },
});
