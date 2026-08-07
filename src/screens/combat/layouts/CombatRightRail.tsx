import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CombatPanel from '../../../components/combat/ui/CombatPanel';
import HapticPressable from '../../../components/HapticPressable';
import { useRun } from '../../../context/RunContext';
import { OTT } from '../../../constants/occultTacticalTerminalTheme';

interface CombatRightRailProps {
  combatLog: React.ReactNode;
  hostileIntel: React.ReactNode;
}

type DockTab = 'intel' | 'log';

/** Restrained new-event notice; long enough to read, short enough to ignore. */
const TOAST_MS = 2600;

/**
 * Right side-dock — one surface holding Enemy Intel and the Combat Log behind
 * tabs. Intel is the resting view; new combat events announce themselves with a
 * brief toast and an unread badge instead of seizing the panel.
 *
 * Both panes stay mounted at a fixed size so tab switches never resize the dock
 * or animate the log scrolling into place.
 */
export default function CombatRightRail({
  combatLog,
  hostileIntel,
}: CombatRightRailProps): React.JSX.Element {
  const { runLog } = useRun();
  const [tab, setTab] = useState<DockTab>('intel');
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const seenCount = useRef(runLog.length);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (runLog.length < seenCount.current) {
      // Log cleared between encounters.
      seenCount.current = runLog.length;
      setUnread(0);
      return;
    }
    const fresh = runLog.length - seenCount.current;
    seenCount.current = runLog.length;
    if (fresh <= 0) return;
    if (tab === 'log') return;

    setUnread((count) => count + fresh);
    const latest = runLog[runLog.length - 1];
    if (!latest) return;
    setToast(latest);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, [runLog, tab]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const selectTab = (next: DockTab) => {
    setTab(next);
    if (next === 'log') {
      setUnread(0);
      setToast(null);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    }
  };

  const renderTab = (id: DockTab, label: string, badge?: number) => {
    const active = tab === id;
    return (
      <HapticPressable
        onPress={() => selectTab(id)}
        haptic={false}
        style={[styles.tab, active ? styles.tabActive : null]}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={
          badge && badge > 0 ? `${label}, ${badge} new events` : label
        }
      >
        <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]} numberOfLines={1}>
          {badge && badge > 0 ? `${label} • ${badge}` : label}
        </Text>
      </HapticPressable>
    );
  };

  return (
    <View style={styles.host} pointerEvents="box-none">
      {toast ? (
        <View style={styles.toast} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={styles.toastText} numberOfLines={2}>{toast}</Text>
        </View>
      ) : null}
      <CombatPanel raised style={styles.dock}>
        <View style={styles.tabRow} accessibilityRole="tablist">
          {renderTab('intel', 'INTEL')}
          {renderTab('log', 'LOG', unread)}
        </View>
        <View style={styles.body}>
          <View
            style={[styles.pane, tab === 'intel' ? styles.paneActive : styles.paneIdle]}
            pointerEvents={tab === 'intel' ? 'auto' : 'none'}
            accessibilityElementsHidden={tab !== 'intel'}
            importantForAccessibility={tab === 'intel' ? 'yes' : 'no-hide-descendants'}
          >
            {hostileIntel}
          </View>
          <View
            style={[styles.pane, tab === 'log' ? styles.paneActive : styles.paneIdle]}
            pointerEvents={tab === 'log' ? 'auto' : 'none'}
            accessibilityElementsHidden={tab !== 'log'}
            importantForAccessibility={tab === 'log' ? 'yes' : 'no-hide-descendants'}
          >
            {combatLog}
          </View>
        </View>
      </CombatPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    // Vertically mid-screen on the right — clear of mission readout and console.
    top: '28%',
    height: '38%',
    right: 10,
    width: '17%',
    minWidth: 156,
    maxWidth: 220,
    zIndex: 22,
    gap: 6,
    pointerEvents: 'box-none',
    justifyContent: 'flex-start',
  },
  toast: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -40,
    flexGrow: 0,
    flexShrink: 0,
    borderLeftWidth: 2,
    borderLeftColor: OTT.cyanDim,
    backgroundColor: 'rgba(6, 10, 12, 0.9)',
    paddingHorizontal: 7,
    paddingVertical: 5,
    zIndex: 1,
  },
  toastText: {
    fontFamily: OTT.mono,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.2,
    color: OTT.textSecondary,
  },
  dock: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: OTT.panelPad,
    paddingTop: 5,
    paddingBottom: 4,
    gap: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 4,
    flexGrow: 0,
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: OTT.cyanSelect,
  },
  tabLabel: {
    fontFamily: OTT.mono,
    fontSize: OTT.headerSize,
    fontWeight: '800',
    letterSpacing: OTT.headerTracking,
    color: OTT.textMuted,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: OTT.cyanSelect,
  },
  body: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  pane: {
    ...StyleSheet.absoluteFill,
    minHeight: 0,
  },
  paneActive: {
    opacity: 1,
    zIndex: 2,
  },
  paneIdle: {
    opacity: 0,
    zIndex: 1,
  },
});
