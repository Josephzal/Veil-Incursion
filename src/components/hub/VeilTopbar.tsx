import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import TerminalText from '../TerminalText';
import { resolveTerminalNavItems } from '../../constants/terminalNav';
import { useWorldState } from '../../context/WorldStateContext';
import { useBreachWindowCountdown } from '../../hooks/useBreachWindowCountdown';
import { useResponsiveScale } from '../../hooks/useResponsiveScale';
import { readPressableHover } from '../../utils/terminalHoverStyle';
import type { TerminalView } from '../../types/terminalNav';

interface VeilTopbarProps {
  activeView: TerminalView;
  onSelectView: (view: TerminalView) => void;
}

const TERMINAL = '#69c8ad';
const TERMINAL_BRIGHT = '#8ee0c6';
const BRAND = '#d9e2df';
const MUTED = '#8fa39f';
const NAV_IDLE = '#8d9c99';
const NAV_HOVER = '#d0d9d6';
const NAV_ACTIVE = '#86d8be';
const TIMER = '#d8e2df';

/**
 * Global hub top bar — brand identity, centered terminal tabs, breach-window status.
 * Replaces the former full-height left navigation rail.
 */
export default function VeilTopbar({
  activeView,
  onSelectView,
}: VeilTopbarProps): React.JSX.Element {
  const { persisted } = useWorldState();
  const { screenWidth } = useResponsiveScale();
  const breachWindowLabel = useBreachWindowCountdown();
  const navItems = resolveTerminalNavItems();
  const contractOfferCount = persisted.contractBoard.contracts.length;
  const compactNav = screenWidth <= 1500;
  const hideConnection = screenWidth <= 1250;
  const navPadH = screenWidth <= 1250 ? 9 : compactNav ? 13 : 18;

  return (
    <View
      style={[
        styles.topbar,
        screenWidth <= 1250 ? styles.topbarNarrow : null,
      ]}
      accessibilityRole="header"
    >
      <View style={styles.identity}>
        <TerminalText size={8.5} letterSpacing={1.4} style={styles.brand}>
          VEIL NETWORK
        </TerminalText>
        {!hideConnection ? (
          <View style={styles.connection}>
            <TerminalText size={6.7} letterSpacing={1} style={styles.connectionText}>
              LINK: SECURE
            </TerminalText>
            <View style={styles.connectionDot} />
          </View>
        ) : null}
      </View>

      <View
        style={styles.nav}
        accessibilityLabel="Primary navigation"
        {...(Platform.OS === 'web' ? ({ role: 'navigation' } as object) : {})}
      >
        {navItems.map((item) => {
          const isActive = activeView === item.key;
          const showBadge = item.key === 'CONTRACTS' && contractOfferCount > 0;
          return (
            <HapticPressable
              key={item.key}
              onPress={() => onSelectView(item.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              {...(Platform.OS === 'web'
                ? ({
                    'aria-current': isActive ? 'page' : undefined,
                  } as object)
                : {})}
              style={(state) => ([
                styles.navItem,
                { paddingHorizontal: navPadH },
                isActive && styles.navItemActive,
                !isActive && (readPressableHover(state) || state.pressed)
                  ? styles.navItemHover
                  : null,
              ])}
            >
              <View style={styles.navItemInner}>
                <TerminalText
                  size={screenWidth <= 1250 ? 7.5 : 8}
                  letterSpacing={screenWidth <= 1250 ? 0.7 : 0.9}
                  numberOfLines={1}
                  style={{
                    color: isActive ? NAV_ACTIVE : NAV_IDLE,
                    fontWeight: '700',
                  }}
                >
                  {item.label}
                </TerminalText>
                {showBadge ? (
                  <View style={styles.navBadge}>
                    <TerminalText size={6.2} style={styles.navBadgeText}>
                      {String(contractOfferCount)}
                    </TerminalText>
                  </View>
                ) : null}
              </View>
              <View style={[styles.navIndicator, isActive && styles.navIndicatorActive]} />
            </HapticPressable>
          );
        })}

        <View
          style={[styles.navItem, { paddingHorizontal: navPadH, opacity: 0.45 }]}
          accessibilityState={{ disabled: true }}
        >
          <View style={styles.navItemInner}>
            <TerminalText
              size={screenWidth <= 1250 ? 7.5 : 8}
              letterSpacing={screenWidth <= 1250 ? 0.7 : 0.9}
              style={{ color: NAV_IDLE, fontWeight: '700' }}
            >
              ARCHIVE
            </TerminalText>
          </View>
        </View>
      </View>

      <View style={styles.status}>
        <TerminalText size={6.7} letterSpacing={1.1} style={styles.statusLabel}>
          BREACH WINDOW OPEN
        </TerminalText>
        <TerminalText size={8.5} letterSpacing={1} style={styles.statusTime}>
          {breachWindowLabel}
        </TerminalText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    flexShrink: 0,
    minWidth: 0,
    height: 68,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 190, 179, 0.18)',
    backgroundColor: 'rgba(2, 5, 5, 0.98)',
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(180deg, rgba(9, 17, 16, 0.72), rgba(2, 5, 5, 0.98))',
        display: 'grid',
        gridTemplateColumns: 'minmax(190px, 1fr) auto minmax(190px, 1fr)',
        alignItems: 'center',
      } as object,
      default: {},
    }),
  },
  topbarNarrow: {
    ...Platform.select({
      web: {
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        columnGap: 12,
      } as object,
      default: { gap: 12 },
    }),
  },
  identity: {
    justifyContent: 'center',
    minWidth: 0,
    ...Platform.select({
      web: { justifySelf: 'start' } as object,
      default: { flex: 1 },
    }),
  },
  brand: {
    color: BRAND,
    fontWeight: '800',
    lineHeight: 16,
  },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 6,
  },
  connectionText: {
    color: MUTED,
    fontWeight: '700',
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TERMINAL,
    ...Platform.select({
      web: { boxShadow: '0 0 7px rgba(105, 200, 173, 0.38)' } as object,
      default: {},
    }),
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    height: '100%',
    gap: 2,
    minWidth: 0,
    ...Platform.select({
      web: { justifySelf: 'center' } as object,
      default: { flexShrink: 1 },
    }),
  },
  navItem: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    backgroundColor: 'transparent',
    ...Platform.select({
      web: { cursor: 'pointer', outlineStyle: 'none' } as object,
      default: {},
    }),
  },
  navItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navItemHover: {
    backgroundColor: 'rgba(105, 200, 173, 0.025)',
  },
  navItemActive: {
    backgroundColor: 'rgba(105, 200, 173, 0.05)',
  },
  navIndicator: {
    position: 'absolute',
    right: 14,
    bottom: 0,
    left: 14,
    height: 2,
    backgroundColor: 'transparent',
  },
  navIndicatorActive: {
    backgroundColor: TERMINAL,
  },
  navBadge: {
    minWidth: 19,
    height: 18,
    marginLeft: 7,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(105, 200, 173, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.2)',
  },
  navBadgeText: {
    color: '#9edcc9',
    fontWeight: '700',
  },
  status: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 0,
    ...Platform.select({
      web: { justifySelf: 'end' } as object,
      default: { flex: 1 },
    }),
  },
  statusLabel: {
    color: TERMINAL,
    fontWeight: '800',
    textAlign: 'right',
  },
  statusTime: {
    marginTop: 2,
    color: TIMER,
    fontWeight: '800',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
