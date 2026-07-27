import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import FieldPlate from '../runField/FieldPlate';
import { NARRATIVE_BODY_LINE_HEIGHT, NARRATIVE_UNIFIED_PANEL_PADDING } from '../../constants/narrativeLayout';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { RUN_FIELD } from '../../theme/runFieldTokens';

interface NarrativeFlavorPanelProps {
  flavorText: string;
  primaryColor?: string;
  mutedColor?: string;
}

/** Strips DevTest-only preamble (e.g. "DEV SANDBOX — ...") from player-facing flavor text. */
function sanitizeFlavorText(text: string): string {
  const withoutLeadingSandbox = text.replace(/^\s*(?:>>\s*)?DEV SANDBOX\b[^.]*\.\s*/i, '');
  return withoutLeadingSandbox
    .split('\n')
    .filter((line) => !/^\s*(?:>>\s*)?DEV SANDBOX\b/i.test(line.trim()))
    .join('\n')
    .trim();
}

/**
 * Field-report plate — a medium, translucent card over the narrative art.
 * Never opaque enough to fully hide the environment behind it.
 */
export default function NarrativeFlavorPanel({
  flavorText,
  primaryColor = RUN_FIELD.text,
  mutedColor = RUN_FIELD.textSecondary,
}: NarrativeFlavorPanelProps): React.JSX.Element {
  const { scaleFont, scaleSpacing, fontScale } = useResponsiveLayout();
  const panelPadding = scaleSpacing(NARRATIVE_UNIFIED_PANEL_PADDING * 0.6);
  const displayText = useMemo(() => sanitizeFlavorText(flavorText), [flavorText]);

  return (
    <FieldPlate
      density="light"
      brackets={false}
      style={styles.panelShell}
      contentStyle={[styles.panelContent, { padding: panelPadding }]}
    >
      <Text
        style={[
          styles.panelLabel,
          {
            color: mutedColor,
            fontSize: 10 * fontScale,
            lineHeight: 14 * fontScale,
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
              fontSize: scaleFont(12),
              lineHeight: scaleFont(NARRATIVE_BODY_LINE_HEIGHT),
            },
          ]}
        >
          {displayText}
        </Text>
      </ScrollView>
    </FieldPlate>
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
    fontFamily: RUN_FIELD.mono,
    letterSpacing: 1.6,
    fontWeight: '700',
    textTransform: 'uppercase',
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
    fontFamily: RUN_FIELD.mono,
    letterSpacing: 0.25,
  },
});
