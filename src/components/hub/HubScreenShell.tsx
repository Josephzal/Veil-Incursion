import React from 'react';
import { Platform, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import TerminalText from '../TerminalText';
import {
  resolveFactionSlateBackground,
  resolveFactionSlateInnerBorder,
} from '../../constants/hubAtmosphere';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useHubLayout } from '../../context/HubLayoutContext';
import { formatBracketHeader } from '../../styles/hubTerminalUi';
import { VEIL } from '../../theme/veilTerminalTokens';

interface HubScreenShellProps {
  title: string;
  subtitle?: string;
  /** When false, title is rendered without `[ … ]` brackets. Default true. */
  bracketTitle?: boolean;
  /** Render subtitle above the title. */
  subtitleFirst?: boolean;
  /** Override screen title color (defaults to theme status). */
  titleColor?: string;
  /** Thin dark theater chrome instead of faction-tinted slate. */
  theaterChrome?: boolean;
  /** Compact local stage header (~58–64px) for Veil Front. */
  compactTheaterHeader?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Optional shared bottom command bar pinned below the body. */
  footer?: React.ReactNode;
}

/** Shared hub viewport — screen title + faction glass data slate. */
export default function HubScreenShell({
  title,
  subtitle,
  bracketTitle = true,
  subtitleFirst = false,
  titleColor,
  theaterChrome = false,
  compactTheaterHeader = false,
  headerRight,
  children,
  scrollable = false,
  contentStyle,
  footer,
}: HubScreenShellProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const { scaleSpacing } = useHubLayout();
  const slateBg = theaterChrome
    ? VEIL.bgSoft
    : resolveFactionSlateBackground(account.alignedFaction);
  const slateInnerBorder = theaterChrome
    ? VEIL.lineFaint
    : resolveFactionSlateInnerBorder(account.alignedFaction);
  const headerColor = titleColor ?? (theaterChrome ? VEIL.bone : theme.statusColor);
  const resolvedTitle = bracketTitle ? formatBracketHeader(title) : title.toUpperCase();
  const breadcrumbColor = theaterChrome
    ? VEIL.textMuted
    : hubKeyColorFromTheme(theme.mutedColor);
  const compactHeader = theaterChrome && compactTheaterHeader;

  const body = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { gap: scaleSpacing(8), paddingBottom: scaleSpacing(8) }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.slateBody, contentStyle]}>{children}</View>
  );

  const titleNode = (
    <TerminalText
      size={compactHeader ? 13.5 : undefined}
      variant={compactHeader ? undefined : 'screenTitle'}
      letterSpacing={compactHeader ? 0.8 : 1.4}
      style={[styles.screenTitle, { color: headerColor }]}
    >
      {resolvedTitle}
    </TerminalText>
  );
  const subtitleNode = subtitle ? (
    <TerminalText
      size={compactHeader ? 7.5 : undefined}
      variant={compactHeader ? undefined : 'caption'}
      letterSpacing={compactHeader ? 0.8 : 0.8}
      style={[
        styles.screenSubtitle,
        {
          color: breadcrumbColor,
          marginTop: subtitleFirst ? 0 : scaleSpacing(2),
          marginBottom: subtitleFirst ? scaleSpacing(compactHeader ? 2 : 3) : 0,
        },
      ]}
    >
      {subtitle}
    </TerminalText>
  ) : null;

  return (
    <View
      style={[
        styles.root,
        theaterChrome && Platform.OS === 'web'
          ? ({ height: '100%', maxHeight: '100%' } as object)
          : null,
      ]}
    >
      <View style={[styles.slateOuter, { backgroundColor: slateBg }]}>
        <View
          style={[
            styles.slateInner,
            theaterChrome ? styles.slateInnerTheater : null,
            {
              borderColor: slateInnerBorder,
              borderWidth: theaterChrome ? 0 : 1,
              paddingHorizontal: scaleSpacing(theaterChrome ? (compactHeader ? 4 : 6) : 10),
              paddingVertical: scaleSpacing(theaterChrome ? (compactHeader ? 4 : 6) : 8),
              gap: scaleSpacing(theaterChrome ? (compactHeader ? 2 : 4) : 6),
            },
          ]}
        >
          <View
            style={[
              styles.headerRow,
              compactHeader ? styles.headerRowCompact : null,
              {
                gap: scaleSpacing(8),
                marginBottom: scaleSpacing(compactHeader ? 2 : 4),
              },
            ]}
          >
            <View style={styles.headerText}>
              {subtitleFirst ? (
                <>
                  {subtitleNode}
                  {titleNode}
                </>
              ) : (
                <>
                  {titleNode}
                  {subtitleNode}
                </>
              )}
            </View>
            {headerRight ? <View style={[styles.headerRight, { gap: scaleSpacing(2) }]}>{headerRight}</View> : null}
          </View>
          {body}
          {footer ? <View style={[styles.footerBar, { marginTop: scaleSpacing(6) }]}>{footer}</View> : null}
        </View>
      </View>
    </View>
  );
}

function hubKeyColorFromTheme(mutedColor: string): string {
  if (mutedColor.startsWith('#') && mutedColor.length >= 7) {
    return `${mutedColor.slice(0, 7)}99`;
  }
  return 'rgba(148, 163, 184, 0.6)';
}

export function HubSectionHeader({
  title,
  color,
  size = 9,
}: {
  title: string;
  color: string;
  size?: number;
}): React.JSX.Element {
  const { scaleSpacing } = useHubLayout();

  return (
    <TerminalText
      {...(size != null ? { size } : { variant: 'section' as const })}
      letterSpacing={1.1}
      style={[styles.sectionHeader, { color, marginBottom: scaleSpacing(6) }]}
    >
      {formatBracketHeader(title)}
    </TerminalText>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerRowCompact: {
    minHeight: 58,
    maxHeight: 64,
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
    maxWidth: '42%',
  },
  screenTitle: {
    fontWeight: '800',
    flexShrink: 0,
  },
  screenSubtitle: {
    flexShrink: 0,
  },
  slateOuter: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  slateInner: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
  },
  slateInnerTheater: {
    // header / body / footer rows — body gets remaining height
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  slateBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  sectionHeader: {
    fontWeight: '800',
    flexShrink: 0,
  },
  footerBar: {
    flexShrink: 0,
  },
});
