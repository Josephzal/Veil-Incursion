import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import CraftingMenuPanel from '../CraftingMenuPanel';
import SafehouseAbilitiesTab from './SafehouseAbilitiesTab';
import SafehouseBlackMarketTab from './SafehouseBlackMarketTab';
import SafehouseLoadoutTab from './SafehouseLoadoutTab';
import HubScreenShell from '../hub/HubScreenShell';
import { hubKeyColor } from '../../constants/hubAtmosphere';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';

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
  const [activeTab, setActiveTab] = useState<SafehouseTab>('FORGE');

  const accent = theme.statusColor;
  const keyColor = hubKeyColor(theme.mutedColor);

  const headerHud = (
    <>
      <Text style={[styles.hudCredits, { color: accent }]}>
        {`${account.cabalCredits} CR`}
      </Text>
      <Text style={[styles.hudResidue, { color: theme.statusColor }]}>
        {`${account.veilResidueBalance} VEIL RESIDUE`}
      </Text>
    </>
  );

  return (
    <HubScreenShell
      title="SAFEHOUSE // VEIL PREP"
      subtitle={`OPERATIVE ${account.username.toUpperCase()} // ${account.activeClass}`}
      headerRight={headerHud}
    >
      <View style={styles.stickyNav}>
        <View style={styles.navRow}>
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.key;
            return (
              <HapticPressable
                key={item.key}
                onPress={() => setActiveTab(item.key)}
                style={[
                  styles.navCell,
                  active
                    ? { borderColor: accent, backgroundColor: `${accent}22` }
                    : styles.navCellInactive,
                ]}
              >
                <Text style={[styles.navLabel, { color: active ? accent : keyColor }]}>
                  {item.label}
                </Text>
              </HapticPressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.tabScroll}
        contentContainerStyle={styles.tabScrollContent}
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
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  hudResidue: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  stickyNav: {
    flexShrink: 0,
    zIndex: 2,
    marginBottom: 8,
  },
  navRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  navCell: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 72,
    alignItems: 'center',
  },
  navCellInactive: {
    backgroundColor: 'rgba(20, 20, 25, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  navLabel: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tabScroll: {
    flex: 1,
    minHeight: 0,
  },
  tabScrollContent: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  tabBody: {
    flexGrow: 1,
    minHeight: 240,
  },
});
