import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  NARRATIVE_BODY_LINE_HEIGHT,
  NARRATIVE_FLAVOR_GLASS,
  NARRATIVE_FLAVOR_PADDING,
} from '../../constants/narrativeLayout';

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
  return (
    <View style={styles.root}>
      <View style={styles.panel}>
        <Text style={[styles.panelLabel, { color: mutedColor }]}>FIELD REPORT // EVENT BRIEF</Text>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.flavorText, { color: primaryColor }]}>{flavorText}</Text>
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
    justifyContent: 'flex-end',
    padding: NARRATIVE_FLAVOR_PADDING,
  },
  panel: {
    flex: 1,
    minHeight: 0,
    maxHeight: '88%',
    backgroundColor: NARRATIVE_FLAVOR_GLASS,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    padding: NARRATIVE_FLAVOR_PADDING,
  },
  panelLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    letterSpacing: 1,
    marginBottom: 10,
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
    fontSize: 11,
    lineHeight: NARRATIVE_BODY_LINE_HEIGHT,
    letterSpacing: 0.25,
  },
});
