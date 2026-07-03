import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import CraftingMenuPanel from '../CraftingMenuPanel';
import HapticPressable from '../HapticPressable';
import HubScreenShell from './HubScreenShell';
import TerminalGlitchTransition from '../ui/TerminalGlitchTransition';
import TerminalText from '../TerminalText';
import SafehouseBlackMarketTab from '../safehouse/SafehouseBlackMarketTab';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { getFactionAccent } from '../../data/factions';
import { useHubLayout } from '../../context/HubLayoutContext';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

export type BlackMarketTab = 'FORGE' | 'VENDOR';

const NAV_ITEMS: Array<{ key: BlackMarketTab; label: string }> = [
  { key: 'FORGE', label: 'FORGE' },
  { key: 'VENDOR', label: 'VENDOR' },
];

export default function BlackMarketHubPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const { isDesktop, scaleSpacing } = useHubLayout();
  const [activeTab, setActiveTab] = useState<BlackMarketTab>('FORGE');

  const accent = theme.statusColor;
  const factionAccent = getFactionAccent(account.alignedFaction);

  const headerHud = (
    <>
      <TerminalText variant="body" letterSpacing={0.6} style={[styles.hudCredits, { color: accent, fontWeight: '700' }]}>
        {`${account.cabalCredits} CR`}
      </TerminalText>
      <TerminalText variant="caption" letterSpacing={0.5} style={[styles.hudResidue, { color: theme.statusColor }]}>
        {`${account.veilResidueBalance} VEIL RESIDUE`}
      </TerminalText>
    </>
  );

  return (
    <HubScreenShell
      title="BLACK MARKET // CONTRABAND LANE"
      subtitle={`OPERATIVE ${account.username.toUpperCase()} // FABRICATION & PROCUREMENT`}
      headerRight={headerHud}
      contentStyle={styles.shellBody}
    >
      <View style={styles.stage}>
        <View style={styles.masterContent}>
          <View
            style={[
              styles.stickyNav,
              {
                marginBottom: scaleSpacing(8),
                paddingVertical: scaleSpacing(4),
              },
            ]}
          >
            <View style={[styles.navRow, isDesktop && styles.navRowDesktop, { gap: scaleSpacing(isDesktop ? 8 : 6) }]}>
              {NAV_ITEMS.map((item) => {
                const active = activeTab === item.key;
                return (
                  <HapticPressable
                    key={item.key}
                    onPress={() => setActiveTab(item.key)}
                    style={(state) => [
                      styles.hardwareTab,
                      isDesktop && styles.hardwareTabDesktop,
                      {
                        borderColor: active ? factionAccent : theme.borderColor,
                        backgroundColor: active ? `${factionAccent}14` : 'rgba(0, 0, 0, 0.35)',
                      },
                      terminalHoverStyle(readPressableHover(state), state.pressed),
                    ]}
                  >
                    <TerminalText
                      variant="body"
                      letterSpacing={1}
                      style={{ color: active ? factionAccent : theme.mutedColor, fontWeight: '700' }}
                    >
                      {item.label}
                    </TerminalText>
                  </HapticPressable>
                );
              })}
            </View>
          </View>

          <View style={styles.tabBodyFixed}>
            <TerminalGlitchTransition transitionKey={activeTab} style={styles.tabBodyFill}>
              {activeTab === 'FORGE' && <CraftingMenuPanel embedded />}
              {activeTab === 'VENDOR' && <SafehouseBlackMarketTab />}
            </TerminalGlitchTransition>
          </View>
        </View>
      </View>
    </HubScreenShell>
  );
}

const styles = StyleSheet.create({
  shellBody: {
    flex: 1,
    minHeight: 0,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  masterContent: {
    flex: 1,
    minHeight: 0,
    zIndex: 1,
    width: '100%',
  },
  hudCredits: {
    fontWeight: '700',
    textAlign: 'right',
  },
  hudResidue: {
    textAlign: 'right',
    marginTop: 2,
  },
  stickyNav: {
    zIndex: 2,
  },
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  navRowDesktop: {
    gap: 8,
  },
  hardwareTab: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hardwareTabDesktop: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    minWidth: 96,
  },
  tabBodyFixed: {
    flex: 1,
    minHeight: 0,
  },
  tabBodyFill: {
    flex: 1,
    minHeight: 0,
  },
});
