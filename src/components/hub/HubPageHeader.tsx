import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import TerminalText from '../TerminalText';
import {
  HUB_PAGE_HEADER_COMPACT_MIN_HEIGHT,
  HUB_PAGE_HEADER_COMPACT_PADDING_H,
  HUB_PAGE_HEADER_COMPACT_PADDING_V,
  HUB_PAGE_HEADER_MIN_HEIGHT,
  HUB_PAGE_HEADER_PADDING_H,
  HUB_PAGE_HEADER_PADDING_BOTTOM,
  HUB_PAGE_HEADER_PADDING_TOP,
  hubPageEyebrowStyle,
  hubPageSubtitleStyle,
  hubPageTitleStyle,
} from '../../theme/hubPanelSurfaces';
import { VEIL } from '../../theme/veilTerminalTokens';

interface HubPageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  compact?: boolean;
  trailing?: React.ReactNode;
  /** Small bone registration mark — matches Contract Board page header. */
  showBoneMark?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Contract Board page-header hierarchy (eyebrow → title → subtitle).
 * Presentation only — does not alter navigation or data.
 */
export default function HubPageHeader({
  eyebrow,
  title,
  subtitle,
  compact = false,
  trailing,
  showBoneMark = true,
  style,
}: HubPageHeaderProps): React.JSX.Element {
  return (
    <View style={[styles.header, compact && styles.headerCompact, style]}>
      <View style={styles.titleBlock}>
        <View style={styles.eyebrowRow}>
          {showBoneMark ? <View style={styles.boneMark} /> : null}
          <TerminalText size={6.5} letterSpacing={1.05} style={hubPageEyebrowStyle()}>
            {eyebrow}
          </TerminalText>
        </View>
        <TerminalText size={22} letterSpacing={0.15} style={hubPageTitleStyle()}>
          {title}
        </TerminalText>
        {subtitle ? (
          <TerminalText size={7} letterSpacing={1} style={hubPageSubtitleStyle()}>
            {subtitle}
          </TerminalText>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 24,
    minHeight: HUB_PAGE_HEADER_MIN_HEIGHT,
    paddingHorizontal: HUB_PAGE_HEADER_PADDING_H,
    paddingTop: HUB_PAGE_HEADER_PADDING_TOP,
    paddingBottom: HUB_PAGE_HEADER_PADDING_BOTTOM,
    flexShrink: 0,
    overflow: 'hidden',
  },
  headerCompact: {
    minHeight: HUB_PAGE_HEADER_COMPACT_MIN_HEIGHT,
    paddingTop: HUB_PAGE_HEADER_COMPACT_PADDING_V,
    paddingBottom: HUB_PAGE_HEADER_COMPACT_PADDING_V,
    paddingHorizontal: HUB_PAGE_HEADER_COMPACT_PADDING_H,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  boneMark: {
    width: 8,
    height: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: VEIL.bone,
    opacity: 0.45,
  },
});
