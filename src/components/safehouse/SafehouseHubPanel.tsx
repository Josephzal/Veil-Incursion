import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from '../HapticPressable';
import CraftingMenuPanel from '../CraftingMenuPanel';
import SafehouseAbilitiesTab from './SafehouseAbilitiesTab';
import SafehouseBlackMarketTab from './SafehouseBlackMarketTab';
import SafehouseLoadoutTab from './SafehouseLoadoutTab';
import { formatBracketHeader, hubTerminalUi } from '../../styles/hubTerminalUi';
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
  const { account, getStashCapacitySnapshot } = usePlayerAccount();
  const [activeTab, setActiveTab] = useState<SafehouseTab>('FORGE');

  const stashCapacity = getStashCapacitySnapshot();
  const accent = theme.statusColor;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { borderBottomColor: theme.borderColor }]}>
        <View style={styles.headerLeft}>
          <Text style={[hubTerminalUi.sectionHeaderLg, { color: theme.mutedColor }]}>
            {formatBracketHeader('SAFEHOUSE // VEIL PREP')}
          </Text>
          <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
            {`OPERATIVE ${account.username.toUpperCase()} // ${account.activeClass}`}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.creditLine, { color: accent }]}>
            {`${account.cabalCredits} CR`}
          </Text>
          <Text style={[styles.stashLine, { color: theme.mutedColor }]}>
            {`STASH ${stashCapacity.used}/${stashCapacity.max}`}
          </Text>
        </View>
      </View>

      <View style={[styles.navRow, { borderBottomColor: theme.borderColor }]}>
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.key;
          return (
            <HapticPressable
              key={item.key}
              onPress={() => setActiveTab(item.key)}
              style={[
                styles.navCell,
                {
                  borderColor: active ? accent : theme.borderColor,
                  backgroundColor: active ? `${theme.primaryColor}14` : 'transparent',
                },
              ]}
            >
              <Text style={[styles.navLabel, { color: active ? accent : theme.mutedColor }]}>
                {item.label}
              </Text>
            </HapticPressable>
          );
        })}
      </View>

      <View style={styles.tabBody}>
        {activeTab === 'FORGE' && <CraftingMenuPanel embedded />}
        {activeTab === 'MARKET' && <SafehouseBlackMarketTab />}
        {activeTab === 'LOADOUT' && <SafehouseLoadoutTab />}
        {activeTab === 'ABILITIES' && <SafehouseAbilitiesTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  headerLeft: { flex: 1, gap: 2 },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  headerSub: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.5 },
  creditLine: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  stashLine: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.4 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    marginBottom: 8,
    paddingBottom: 8,
  },
  navCell: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 72,
    alignItems: 'center',
  },
  navLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tabBody: { flex: 1, minHeight: 0 },
});
