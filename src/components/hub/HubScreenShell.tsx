import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import TerminalText from '../TerminalText';
import {
  resolveFactionSlateBackground,
  resolveFactionSlateInnerBorder,
} from '../../constants/hubAtmosphere';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useResponsiveScale } from '../../hooks/useResponsiveScale';
import { formatBracketHeader } from '../../styles/hubTerminalUi';

interface HubScreenShellProps {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Shared hub viewport — screen title + faction glass data slate. */
export default function HubScreenShell({
  title,
  subtitle,
  headerRight,
  children,
  scrollable = false,
  contentStyle,
}: HubScreenShellProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const { scaleSpacing } = useResponsiveScale();
  const slateBg = resolveFactionSlateBackground(account.alignedFaction);
  const slateInnerBorder = resolveFactionSlateInnerBorder(account.alignedFaction);
  const headerColor = theme.statusColor;

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

  return (
    <View style={styles.root}>
      <View style={[styles.slateOuter, { backgroundColor: slateBg }]}>
        <View
          style={[
            styles.slateInner,
            {
              borderColor: slateInnerBorder,
              paddingHorizontal: scaleSpacing(10),
              paddingVertical: scaleSpacing(8),
              gap: scaleSpacing(6),
            },
          ]}
        >
          <View style={[styles.headerRow, { gap: scaleSpacing(8), marginBottom: scaleSpacing(4) }]}>
            <View style={styles.headerText}>
              <TerminalText size={10} letterSpacing={1.2} style={[styles.screenTitle, { color: headerColor }]}>
                {formatBracketHeader(title)}
              </TerminalText>
              {subtitle ? (
                <TerminalText
                  size={7}
                  lineHeight={10}
                  letterSpacing={0.5}
                  style={[styles.screenSubtitle, { color: hubKeyColorFromTheme(theme.mutedColor), marginTop: scaleSpacing(2) }]}
                >
                  {subtitle}
                </TerminalText>
              ) : null}
            </View>
            {headerRight ? <View style={[styles.headerRight, { gap: scaleSpacing(2) }]}>{headerRight}</View> : null}
          </View>
          {body}
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
  const { scaleSpacing } = useResponsiveScale();

  return (
    <TerminalText
      size={size}
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexShrink: 0,
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
  },
  slateInner: {
    flex: 1,
    minHeight: 0,
    borderWidth: 1,
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
});
