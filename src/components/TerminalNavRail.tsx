import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import HapticPressable from './HapticPressable';
import TerminalText from './TerminalText';
import { resolveTerminalNavItems } from '../constants/terminalNav';
import { SELECT_ACCENT } from '../constants/dossierSurface';
import { useResponsiveScale } from '../hooks/useResponsiveScale';
import { useTerminal } from '../context/TerminalContext';
import { useWorldState } from '../context/WorldStateContext';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { TerminalView } from '../types/terminalNav';
import { clearanceXpProgress } from '../data/runnerClearanceEngine';
import { getAccountProgressionProfile } from '../data/progressionDebugEngine';
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';

interface TerminalNavRailProps {
  activeView: TerminalView;
  onSelectView: (view: TerminalView) => void;
  width: number;
  contentTopInset: number;
  contentBottomInset: number;
}

/** Concept theater accent — spectral green. */
const RAIL_ACCENT = SELECT_ACCENT;
const RAIL_DIVIDER = 'rgba(255, 255, 255, 0.08)';
const LINK_GREEN = SELECT_ACCENT;

/** Vertical hub navigation — side-bracket active state, text-only (no icons). */
export default function TerminalNavRail({
  activeView,
  onSelectView,
  width,
  contentTopInset,
  contentBottomInset,
}: TerminalNavRailProps): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const { persisted } = useWorldState();
  const { scaleSpacing } = useResponsiveScale();
  const navItems = resolveTerminalNavItems();

  const contractOfferCount = persisted.contractBoard.contracts.length;
  const inventoryCount = useMemo(
    () => Object.values(account.resourceStash).reduce((sum, qty) => sum + (qty ?? 0), 0),
    [account.resourceStash],
  );
  const clearance = useMemo(
    () => clearanceXpProgress(getAccountProgressionProfile(account)),
    [account],
  );
  const runnerTag = (account.username || 'RUNNER_07').toUpperCase().replace(/\s+/g, '_');

  const resolveSubtitle = (key: TerminalView, fallback: string): string => {
    if (key === 'CONTRACTS') {
      return contractOfferCount > 0 ? `${contractOfferCount} OFFERS` : 'NO OFFERS';
    }
    if (key === 'BLACK_MARKET') {
      return `INVENTORY ${inventoryCount}`;
    }
    return fallback;
  };

  return (
    <View
      style={[
        styles.rail,
        {
          width,
          paddingTop: contentTopInset,
          paddingBottom: contentBottomInset,
          paddingHorizontal: scaleSpacing(6),
        },
      ]}
    >
      <View style={[styles.networkHeader, { paddingBottom: scaleSpacing(12), marginBottom: scaleSpacing(8) }]}>
        <TerminalText size={7} letterSpacing={1.6} style={{ color: '#E8EEEA', fontWeight: '800' }}>
          VEIL NETWORK
        </TerminalText>
        <View style={[styles.linkRow, { marginTop: scaleSpacing(4), gap: scaleSpacing(5) }]}>
          <TerminalText size={5} letterSpacing={1} style={{ color: theme.mutedColor, fontWeight: '600' }}>
            LINK: SECURE
          </TerminalText>
          <View style={[styles.linkDot, { backgroundColor: LINK_GREEN }]} />
        </View>
      </View>

      <View style={[styles.navStack, { gap: scaleSpacing(2) }]}>
        {navItems.map((item) => {
          const isActive = activeView === item.key;
          const subtitle = resolveSubtitle(item.key, item.subtitle);
          return (
            <HapticPressable
              key={item.key}
              onPress={() => onSelectView(item.key)}
              style={(state) => [
                styles.navCell,
                {
                  paddingVertical: scaleSpacing(11),
                  paddingHorizontal: scaleSpacing(10),
                  backgroundColor: isActive ? 'rgba(88, 223, 168, 0.06)' : 'transparent',
                },
                terminalHoverStyle(readPressableHover(state), state.pressed),
              ]}
            >
              {isActive ? (
                <>
                  <View style={[styles.sideBracket, styles.sideBracketLeft]} />
                  <View style={[styles.sideBracket, styles.sideBracketRight]} />
                </>
              ) : null}
              <TerminalText
                size={6.8}
                letterSpacing={1.3}
                numberOfLines={1}
                style={{
                  color: isActive ? RAIL_ACCENT : '#D6DDD8',
                  fontWeight: '800',
                }}
              >
                {item.label}
              </TerminalText>
              <TerminalText
                size={4.8}
                letterSpacing={1}
                numberOfLines={1}
                style={{
                  color: isActive ? 'rgba(88, 223, 168, 0.7)' : theme.mutedColor,
                  fontWeight: '600',
                  marginTop: scaleSpacing(3),
                }}
              >
                {subtitle}
              </TerminalText>
            </HapticPressable>
          );
        })}

        {/* Visual archive row — matches concept rail, not wired as a hub view. */}
        <View
          style={[
            styles.navCell,
            {
              paddingVertical: scaleSpacing(11),
              paddingHorizontal: scaleSpacing(10),
              opacity: 0.55,
            },
          ]}
        >
          <TerminalText size={6.8} letterSpacing={1.3} style={{ color: '#D6DDD8', fontWeight: '800' }}>
            ARCHIVE
          </TerminalText>
          <TerminalText
            size={4.8}
            letterSpacing={1}
            style={{ color: theme.mutedColor, fontWeight: '600', marginTop: scaleSpacing(3) }}
          >
            RECORDS
          </TerminalText>
        </View>
      </View>

      <View style={[styles.footer, { gap: scaleSpacing(2), paddingTop: scaleSpacing(12) }]}>
        <TerminalText size={4.4} letterSpacing={0.7} style={{ color: 'rgba(148, 163, 184, 0.55)' }}>
          {`USER: ${runnerTag}`}
        </TerminalText>
        <TerminalText size={4.4} letterSpacing={0.7} style={{ color: 'rgba(148, 163, 184, 0.55)' }}>
          {`CLEARANCE: ${clearance.rank}`}
        </TerminalText>
        <TerminalText size={4.4} letterSpacing={0.7} style={{ color: 'rgba(148, 163, 184, 0.55)' }}>
          NODE: VEIL-7A
        </TerminalText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexShrink: 0,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  networkHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RAIL_DIVIDER,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  navStack: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  navCell: {
    position: 'relative',
    overflow: 'visible',
  },
  sideBracket: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: 2,
    backgroundColor: RAIL_ACCENT,
  },
  sideBracketLeft: {
    left: 0,
  },
  sideBracketRight: {
    right: 0,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: RAIL_DIVIDER,
  },
});
