import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import TerminalText from '../TerminalText';
import { SELECT_ACCENT } from '../../constants/dossierSurface';

/** Small pale-gray section header — brackets are reserved for the main tab title. */
export const LOADOUT_SECTION_HEADER_COLOR = '#9aa6b2';
/** One-line subtitle color — desaturated blue-gray. */
export const LOADOUT_SUBTITLE_COLOR = '#7f8c9b';

/**
 * Standard loadout tab header: amber bracketed title + a single muted subtitle.
 * Every tab uses the same rhythm: Header → Summary → Options.
 */
export function LoadoutTabHeader({
  title,
  subtitle,
  style,
}: {
  title: string;
  subtitle: string;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View style={[styles.header, style]}>
      <TerminalText variant="section" letterSpacing={1.1} style={styles.title}>
        {`[ ${title.toUpperCase()} ]`}
      </TerminalText>
      <TerminalText variant="caption" style={styles.subtitle}>
        {subtitle}
      </TerminalText>
    </View>
  );
}

/** Plain small section header (CURRENTLY EQUIPPED / AVAILABLE / ACTIVE SLOTS / POOL). */
export function LoadoutSectionHeader({
  label,
  style,
}: {
  label: string;
  style?: StyleProp<TextStyle>;
}): React.JSX.Element {
  return (
    <TerminalText variant="caption" letterSpacing={1} style={[styles.sectionHeader, style]}>
      {label.toUpperCase()}
    </TerminalText>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 3,
    marginBottom: 8,
  },
  title: {
    color: SELECT_ACCENT,
    fontWeight: '800',
  },
  subtitle: {
    color: LOADOUT_SUBTITLE_COLOR,
  },
  sectionHeader: {
    color: LOADOUT_SECTION_HEADER_COLOR,
    fontWeight: '700',
  },
});
