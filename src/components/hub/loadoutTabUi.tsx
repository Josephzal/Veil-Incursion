import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import TerminalText from '../TerminalText';
import { VEIL } from '../../theme/veilTerminalTokens';

/** Small pale-gray section header — brackets are reserved for the main tab title. */
export const LOADOUT_SECTION_HEADER_COLOR = VEIL.textSoft;
/** One-line subtitle color — quieter secondary. */
export const LOADOUT_SUBTITLE_COLOR = VEIL.textMuted;
/** Fixed gap between a section label and the card/container below it. */
export const LOADOUT_LABEL_TO_CARD_GAP = 10;
/** Fixed gap between major sections (Equipped → Available, Slots → Pool, etc.). */
export const LOADOUT_SECTION_GAP = 16;

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

/**
 * Section label + body with a locked label-to-card gap.
 * Use this for every first container under CURRENTLY EQUIPPED / ACTIVE SLOTS / etc.
 */
export function LoadoutSectionBlock({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View style={[styles.sectionBlock, style]}>
      <LoadoutSectionHeader label={label} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 3,
    marginBottom: 8,
  },
  title: {
    color: VEIL.bone,
    fontWeight: '800',
  },
  subtitle: {
    color: LOADOUT_SUBTITLE_COLOR,
  },
  sectionHeader: {
    color: LOADOUT_SECTION_HEADER_COLOR,
    fontWeight: '700',
  },
  sectionBlock: {
    gap: LOADOUT_LABEL_TO_CARD_GAP,
  },
});
