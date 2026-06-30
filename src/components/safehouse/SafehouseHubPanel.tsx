import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import CraftingMenuPanel from '../CraftingMenuPanel';
import HapticPressable from '../HapticPressable';
import HubScreenShell from '../hub/HubScreenShell';
import TerminalGlitchTransition from '../ui/TerminalGlitchTransition';
import TerminalText from '../TerminalText';
import SafehouseAbilitiesTab from './SafehouseAbilitiesTab';
import SafehouseBlackMarketTab from './SafehouseBlackMarketTab';
import SafehouseLoadoutTab from './SafehouseLoadoutTab';
import { resolveFactionSlateBackground } from '../../constants/hubAtmosphere';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { getFactionAccent } from '../../data/factions';
import { useHubLayout } from '../../context/HubLayoutContext';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

export type SafehouseTab = 'FORGE' | 'MARKET' | 'LOADOUT' | 'ABILITIES';

const NAV_ITEMS: Array<{ key: SafehouseTab; label: string }> = [
  { key: 'FORGE', label: 'FORGE' },
  { key: 'MARKET', label: 'MARKET' },
  { key: 'LOADOUT', label: 'LOADOUT' },
  { key: 'ABILITIES', label: 'ABILITIES' },
];

export default function SafehouseHubPanel(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account } = usePlayerAccount();
  const { isDesktop, scaleSpacing } = useHubLayout();
  const [activeTab, setActiveTab] = useState<SafehouseTab>('FORGE');

  const accent = theme.statusColor;
  const factionAccent = getFactionAccent(account.alignedFaction);
  const panelBg = resolveFactionSlateBackground(account.alignedFaction);

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
      title="SAFEHOUSE // VEIL PREP"
      subtitle={`OPERATIVE ${account.username.toUpperCase()} // ${account.activeClass}`}
      headerRight={headerHud}
      contentStyle={styles.shellBody}
    >
      <View style={styles.safehouseStage}>
        <View style={styles.masterContent}>
          <View
            style={[
              styles.stickyNav,
              {
                borderBottomColor: theme.borderColor,
                backgroundColor: panelBg,
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
                        borderBottomColor: active ? factionAccent : 'transparent',
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

          {activeTab === 'LOADOUT' || activeTab === 'MARKET' ? (
            <View style={styles.tabBodyFixed}>
              <TerminalGlitchTransition transitionKey={activeTab} style={styles.tabBodyFill}>
                {activeTab === 'LOADOUT' && <SafehouseLoadoutTab />}
                {activeTab === 'MARKET' && <SafehouseBlackMarketTab />}
              </TerminalGlitchTransition>
            </View>
          ) : (
            <ScrollView
              style={styles.tabScroll}
              contentContainerStyle={[styles.tabScrollContent, { paddingBottom: scaleSpacing(8) }]}
              showsVerticalScrollIndicator={Platform.OS === 'web'}
              keyboardShouldPersistTaps="handled"
            >
              <TerminalGlitchTransition transitionKey={activeTab} style={styles.tabBody}>
                {activeTab === 'FORGE' && <CraftingMenuPanel embedded />}
                {activeTab === 'ABILITIES' && <SafehouseAbilitiesTab />}
              </TerminalGlitchTransition>
            </ScrollView>
          )}
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
  safehouseStage: {
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
    borderBottomWidth: 1,
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
    borderBottomWidth: 2,
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
  tabScroll: {
    flex: 1,
    minHeight: 0,
  },
  tabScrollContent: {
    flexGrow: 1,
  },
  tabBody: {
    flexGrow: 1,
    minHeight: 0,
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
