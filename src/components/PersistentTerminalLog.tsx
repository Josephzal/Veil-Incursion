import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MacroLogCargoButton from './MacroLogCargoButton';
import MacroLogStatusButton from './MacroLogStatusButton';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';
import { useCombatDesktopLayout } from '../hooks/useCombatDesktopLayout';
import { combatPopupFont } from '../constants/combatOverlayTypography';
import { COMBAT_HUD_TYPE } from '../constants/combatHudTypography';
import {
  OTT,
  ottLogColor,
  polishCombatFeedLines,
  resolveOttLogTone,
} from '../constants/occultTacticalTerminalTheme';

const LOG_SURFACE = OTT.bgBlack;
const MACRO_LOG_HORIZONTAL_PADDING = 12;

/** Fixed macro log height when not using fillRemaining (legacy docked mode). Combat dashboard uses fillRemaining. */
export const MACRO_LOG_BLOCK_HEIGHT = 110;
const SCROLL_CONTENT_PADDING_BOTTOM = 24;
const SCROLL_CONTENT_PADDING_BOTTOM_DASHBOARD = 2;

interface PersistentTerminalLogProps {
  visible?: boolean;
  docked?: boolean;
  /** Occupies remaining flex space in parent (combat stack) instead of fixed block height. */
  fillRemaining?: boolean;
  showCargo?: boolean;
  cargoDisabled?: boolean;
  onCargoPress?: () => void;
  showStatus?: boolean;
  onStatusPress?: () => void;
  /** Omit the top border (dashboard macro log column). */
  hideTopBorder?: boolean;
  /** Hide RUN TERMINAL header (parent rail already labels the panel). */
  hideHeader?: boolean;
}

function resolveBottomInset(insetsBottom: number): number {
  return Math.max(insetsBottom, Platform.OS === 'android' ? 4 : 0);
}

function LogLine({
  line,
  color,
  fontSize,
  lineHeight,
}: {
  line: string;
  color: string;
  fontSize: number;
  lineHeight: number;
}) {
  return (
    <View style={styles.lineRow}>
      <Text style={[styles.line, { color, fontSize, lineHeight }]}>{line}</Text>
    </View>
  );
}

export default function PersistentTerminalLog({
  visible = true,
  docked = false,
  fillRemaining = false,
  showCargo = false,
  cargoDisabled = false,
  onCargoPress,
  showStatus = false,
  onStatusPress,
  hideTopBorder = false,
  hideHeader = false,
}: PersistentTerminalLogProps): React.JSX.Element | null {
  const { runLog } = useRun();
  const { theme } = useTerminal();
  const { isCombatDesktop, scaleCombatFont } = useCombatDesktopLayout();
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const [scrollHeight, setScrollHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const railModeEarly = hideHeader && fillRemaining;
  /** Combat rail feed reads top-down; only legacy docked logs pin short content to the bottom. */
  const contentPinsToBottom =
    fillRemaining
    && !railModeEarly
    && contentHeight > 0
    && contentHeight <= scrollHeight;

  useEffect(() => {
    if (runLog.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [runLog.length]);

  if (!visible) return null;
  if (!fillRemaining && !showCargo && !showStatus && runLog.length === 0) return null;

  const bottomInset = docked ? resolveBottomInset(insets.bottom) : 0;
  const dashboardPaddingBottom = hideTopBorder
    ? SCROLL_CONTENT_PADDING_BOTTOM_DASHBOARD
    : SCROLL_CONTENT_PADDING_BOTTOM;

  const dashboardMode = hideTopBorder && fillRemaining;
  const railMode = railModeEarly;
  const logFontSize = railMode
    ? COMBAT_HUD_TYPE.label
    : dashboardMode && isCombatDesktop
      ? scaleCombatFont(COMBAT_HUD_TYPE.title)
      : COMBAT_HUD_TYPE.title;
  const logLineHeight = railMode
    ? COMBAT_HUD_TYPE.lineLabel
    : dashboardMode && isCombatDesktop
      ? scaleCombatFont(18)
      : 17;
  const chromeButtonFontSize = dashboardMode && isCombatDesktop ? combatPopupFont(7) : undefined;
  const feedLines = railMode ? polishCombatFeedLines(runLog, 8) : runLog;

  const logBlock = (
    <View
      style={[
        styles.container,
        fillRemaining ? styles.containerFill : null,
        hideTopBorder ? styles.containerDashboard : null,
        {
          borderColor: theme.borderColor,
          backgroundColor: railMode ? 'transparent' : LOG_SURFACE,
          ...(fillRemaining ? {} : { height: MACRO_LOG_BLOCK_HEIGHT }),
        },
      ]}
    >
      {hideHeader ? null : (
        <View style={[styles.headerRow, hideTopBorder ? styles.headerRowDashboard : null]}>
          <Text style={[
            styles.header,
            {
              color: OTT.terminalGreenMuted,
              ...(dashboardMode && isCombatDesktop ? { fontSize: scaleCombatFont(9) } : null),
            },
          ]}>RUN TERMINAL</Text>
          <View style={styles.headerActions}>
            {showStatus && onStatusPress ? (
              <MacroLogStatusButton onPress={onStatusPress} fontSize={chromeButtonFontSize} />
            ) : null}
            {showCargo && onCargoPress ? (
              <MacroLogCargoButton disabled={cargoDisabled} onPress={onCargoPress} fontSize={chromeButtonFontSize} />
            ) : null}
          </View>
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        onLayout={(event) => setScrollHeight(event.nativeEvent.layout.height)}
        contentContainerStyle={[
          styles.scrollContent,
          fillRemaining ? styles.scrollContentFill : null,
          contentPinsToBottom ? styles.scrollContentPinned : null,
          !contentPinsToBottom && fillRemaining ? styles.scrollContentScrollable : null,
          { paddingBottom: fillRemaining ? dashboardPaddingBottom : SCROLL_CONTENT_PADDING_BOTTOM },
        ]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_width, height) => setContentHeight(height)}
      >
        {feedLines.map((line, idx) => {
          const age = feedLines.length - 1 - idx;
          const fade = age <= 0 ? 1 : age === 1 ? 0.82 : age === 2 ? 0.68 : age === 3 ? 0.55 : 0.42;
          return (
            <View key={`${idx}-${line.slice(0, 16)}`} style={{ opacity: fade }}>
              <LogLine
                line={line}
                color={ottLogColor(resolveOttLogTone(line))}
                fontSize={logFontSize}
                lineHeight={logLineHeight}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  if (!docked) {
    return logBlock;
  }

  return (
    <View
      style={[
        styles.dockShell,
        fillRemaining ? styles.dockShellFill : null,
        {
          paddingBottom: bottomInset,
          backgroundColor: LOG_SURFACE,
        },
      ]}
    >
      {logBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  dockShell: {
    width: '100%',
    flexShrink: 0,
    flexGrow: 0,
  },
  dockShellFill: {
    flex: 1,
    minHeight: 0,
    flexShrink: 1,
  },
  container: {
    width: '100%',
    borderTopWidth: 1,
    paddingHorizontal: MACRO_LOG_HORIZONTAL_PADDING,
    paddingTop: 8,
    flexShrink: 0,
    flexGrow: 0,
    overflow: 'hidden',
  },
  containerFill: {
    flex: 1,
    minHeight: 0,
    flexShrink: 1,
    flexGrow: 1,
  },
  containerDashboard: {
    borderTopWidth: 0,
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
    flexShrink: 0,
  },
  headerRowDashboard: {
    marginBottom: 10,
    marginTop: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  header: {
    fontFamily: 'monospace',
    fontSize: COMBAT_HUD_TYPE.label,
    letterSpacing: 1,
    flex: 1,
    minWidth: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 2,
    paddingTop: 4,
    flexGrow: 1,
  },
  scrollContentFill: {
    flexGrow: 1,
  },
  scrollContentPinned: {
    justifyContent: 'flex-end',
  },
  scrollContentScrollable: {
    justifyContent: 'flex-start',
    flexGrow: 0,
  },
  lineRow: {
    flexDirection: 'row',
    width: '100%',
  },
  line: {
    fontFamily: 'monospace',
    marginBottom: 3,
    flexShrink: 1,
    flexWrap: 'wrap',
    width: '100%',
  },
});
