import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import TacticalButton from '../TacticalButton';
import TerminalText from '../TerminalText';
import CraftingMenuPanel from '../CraftingMenuPanel';
import SafehouseAbilitiesTab from './SafehouseAbilitiesTab';
import SafehouseBlackMarketTab from './SafehouseBlackMarketTab';
import SafehouseLoadoutTab from './SafehouseLoadoutTab';
import HubScreenShell from '../hub/HubScreenShell';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { useResponsiveScale } from '../../hooks/useResponsiveScale';

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
  const { scaleSpacing } = useResponsiveScale();
  const [activeTab, setActiveTab] = useState<SafehouseTab>('FORGE');

  const accent = theme.statusColor;

  const headerHud = (
    <>
      <TerminalText size={10} letterSpacing={0.6} style={[styles.hudCredits, { color: accent }]}>
        {`${account.cabalCredits} CR`}
      </TerminalText>
      <TerminalText size={7} letterSpacing={0.5} style={[styles.hudResidue, { color: theme.statusColor }]}>
        {`${account.veilResidueBalance} VEIL RESIDUE`}
      </TerminalText>
    </>
  );

  return (
    <HubScreenShell
      title="SAFEHOUSE // VEIL PREP"
      subtitle={`OPERATIVE ${account.username.toUpperCase()} // ${account.activeClass}`}
      headerRight={headerHud}
    >
      <View style={[styles.stickyNav, { marginBottom: scaleSpacing(8) }]}>
        <View style={[styles.navRow, { gap: scaleSpacing(6) }]}>
          {NAV_ITEMS.map((item) => (
            <TacticalButton
              key={item.key}
              label={item.label}
              active={activeTab === item.key}
              onPress={() => setActiveTab(item.key)}
              accentColor={accent}
              mutedColor={theme.mutedColor}
              variant="inline"
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={[styles.tabScrollContent, { paddingBottom: scaleSpacing(8) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tabBody}>
          {activeTab === 'FORGE' && <CraftingMenuPanel embedded />}
          {activeTab === 'MARKET' && <SafehouseBlackMarketTab />}
          {activeTab === 'LOADOUT' && <SafehouseLoadoutTab />}
          {activeTab === 'ABILITIES' && <SafehouseAbilitiesTab />}
        </View>
      </ScrollView>
    </HubScreenShell>
  );
}

const styles = StyleSheet.create({
  hudCredits: {
    fontWeight: '800',
    textAlign: 'right',
  },
  hudResidue: {
    fontWeight: '700',
    textAlign: 'right',
  },
  stickyNav: {
    flexShrink: 0,
    zIndex: 2,
  },
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
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
    minHeight: 240,
  },
});
