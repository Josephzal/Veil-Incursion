import React from 'react';
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  resolveFactionSlateBackground,
  resolveFactionSlateInnerBorder,
} from '../../constants/hubAtmosphere';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
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
  const slateBg = resolveFactionSlateBackground(account.alignedFaction);
  const slateInnerBorder = resolveFactionSlateInnerBorder(account.alignedFaction);
  const headerColor = theme.statusColor;

  const body = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
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
        <View style={[styles.slateInner, { borderColor: slateInnerBorder }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={[styles.screenTitle, { color: headerColor }]}>
                {formatBracketHeader(title)}
              </Text>
              {subtitle ? (
                <Text style={[styles.screenSubtitle, { color: hubKeyColorFromTheme(theme.mutedColor) }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {headerRight ? <View style={styles.headerRight}>{headerRight}</View> : null}
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
}: {
  title: string;
  color: string;
}): React.JSX.Element {
  return (
    <Text style={[styles.sectionHeader, { color }]}>
      {formatBracketHeader(title)}
    </Text>
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
    gap: 8,
    marginBottom: 4,
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 2,
    maxWidth: '42%',
  },
  screenTitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    flexShrink: 0,
  },
  screenSubtitle: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.5,
    lineHeight: 10,
    marginTop: 2,
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
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
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
    paddingBottom: 8,
    gap: 8,
  },
  sectionHeader: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 6,
    flexShrink: 0,
  },
});
