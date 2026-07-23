import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import DossierCardShell from '../hub/DossierCardShell';
import { NARRATIVE_BODY_LINE_HEIGHT, NARRATIVE_UNIFIED_PANEL_PADDING } from '../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { VEIL } from '../../theme/veilTerminalTokens';

interface NarrativeFlavorPanelProps {
  flavorText: string;
  primaryColor?: string;
  mutedColor?: string;
}

const MUTED_WHITE = '#F8FAFC';

/**
 * Left-column field report — dossier panel over narrative art.
 */
export default function NarrativeFlavorPanel({
  flavorText,
  primaryColor = MUTED_WHITE,
  mutedColor = VEIL.textMuted,
}: NarrativeFlavorPanelProps): React.JSX.Element {
  const { scaleFont, scaleSpacing, fontScale } = useResponsiveLayout();
  const panelPadding = scaleSpacing(NARRATIVE_UNIFIED_PANEL_PADDING);

  return (
    <DossierCardShell
      fillHeight
      padding={panelPadding}
      style={styles.panelShell}
      contentStyle={styles.panelContent}
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
    </DossierCardShell>
  );
}

const styles = StyleSheet.create({
  panelShell: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  panelContent: {
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-start',
  },
  panelLabel: {
    fontFamily: 'monospace',
    letterSpacing: 1,
    fontWeight: '700',
    flexShrink: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 8,
  },
  flavorText: {
    fontFamily: 'monospace',
    letterSpacing: 0.25,
  },
});
