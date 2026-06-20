import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import CraftingMenuPanel from '../components/CraftingMenuPanel';
import SafehouseBlackMarketTab from '../components/safehouse/SafehouseBlackMarketTab';
import SafehouseLoadoutTab from '../components/safehouse/SafehouseLoadoutTab';
import TerminalSafeArea from '../components/TerminalSafeArea';
import { useGameFlow } from '../context/GameFlowContext';
import { useShadowWar } from '../context/ShadowWarContext';
import { shadowWarBuffsToRunModifiers } from '../data/shadowWarBuffEngine';
import { usePlayerAccount } from '../context/PlayerAccountContext';
import { useRun } from '../context/RunContext';
import { useTerminal } from '../context/TerminalContext';

const AMBER = '#d4a574';
const SLATE = '#0a0b0d';
const RUST = '#5c3d2e';

type SafehouseTab = 'FORGE' | 'MARKET' | 'LOADOUT';

const NAV_ITEMS: Array<{ key: SafehouseTab; label: string }> = [
  { key: 'FORGE', label: 'THE FORGE' },
  { key: 'MARKET', label: 'BLACK MARKET' },
  { key: 'LOADOUT', label: 'TACTICAL LOADOUT' },
];

export default function SafehouseHubScreen(): React.JSX.Element {
  const { theme } = useTerminal();
  const { account, isHydrated, commitDescentLoadout, getStashCapacitySnapshot, appendHubLog } =
    usePlayerAccount();
  const { startNewRun } = useRun();
  const { startBoundRequisition, goToHub } = useGameFlow();
  const { activeBuffs } = useShadowWar();
  const [activeTab, setActiveTab] = useState<SafehouseTab>('FORGE');
  const [descending, setDescending] = useState(false);

  const stashCapacity = getStashCapacitySnapshot();

  const handleInitiateDescent = () => {
    if (descending || account.alignedFaction === null) return;
    setDescending(true);
    const initialCargo = commitDescentLoadout();
    const shadowWarBuffs = shadowWarBuffsToRunModifiers(activeBuffs);
    appendHubLog('>> DESCENT LOADOUT LOCKED — CARGO MANIFEST COMMITTED TO RUN STATE.');
    startNewRun({
      factionPerks: account.factionPerks,
      unlockedBiomes: account.unlockedBiomes,
      aegisLoadout: account.aegisLoadout,
      alignedFaction: account.alignedFaction,
      initialCargo,
      shadowWarBuffs,
    });
    startBoundRequisition();
    setDescending(false);
  };

  if (!isHydrated) {
    return (
      <TerminalSafeArea>
        <View style={styles.loadingRoot}>
          <ActivityIndicator color={AMBER} />
          <Text style={[styles.loadingText, { color: theme.mutedColor }]}>SAFEHOUSE SYSTEMS ONLINE...</Text>
        </View>
      </TerminalSafeArea>
    );
  }

  return (
    <TerminalSafeArea>
      <View style={[styles.root, { backgroundColor: SLATE }]}>
        <View style={[styles.header, { borderBottomColor: RUST }]}>
          <View style={styles.headerLeft}>
            <Pressable onPress={goToHub} style={[styles.backBtn, { borderColor: theme.mutedColor }]}>
              <Text style={[styles.backBtnText, { color: theme.mutedColor }]}>[ ← HUB ]</Text>
            </Pressable>
            <View>
              <Text style={[styles.headerTitle, { color: AMBER }]}>
                [ SAFEHOUSE // VEIL PREP ]
              </Text>
              <Text style={[styles.headerSub, { color: theme.mutedColor }]}>
                {`OPERATIVE ${account.username.toUpperCase()} // ${account.activeClass}`}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.creditLine, { color: AMBER }]}>
              {`${account.cabalCredits} CR`}
            </Text>
            <Text style={[styles.stashLine, { color: theme.mutedColor }]}>
              {`STASH ${stashCapacity.used}/${stashCapacity.max}`}
            </Text>
          </View>
        </View>

        <View style={[styles.navRow, { borderBottomColor: RUST }]}>
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setActiveTab(item.key)}
                style={[
                  styles.navCell,
                  {
                    borderColor: active ? AMBER : '#2a2f36',
                    backgroundColor: active ? 'rgba(212, 165, 116, 0.08)' : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.navLabel, { color: active ? AMBER : theme.mutedColor }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tabBody}>
          {activeTab === 'FORGE' && <CraftingMenuPanel embedded />}
          {activeTab === 'MARKET' && <SafehouseBlackMarketTab />}
          {activeTab === 'LOADOUT' && <SafehouseLoadoutTab />}
        </View>

        <View style={[styles.footer, { borderTopColor: RUST }]}>
          <Pressable
            disabled={descending || account.alignedFaction === null}
            onPress={handleInitiateDescent}
            style={({ pressed }) => [
              styles.descentBtn,
              {
                borderColor: AMBER,
                backgroundColor: pressed ? 'rgba(212, 165, 116, 0.15)' : 'rgba(92, 61, 46, 0.35)',
                opacity: account.alignedFaction === null ? 0.4 : 1,
              },
            ]}
          >
            <Text style={[styles.descentBtnText, { color: AMBER }]}>
              [ INITIATE DESCENT ]
            </Text>
            <Text style={[styles.descentSub, { color: theme.mutedColor }]}>
              Commit cargo grid + tactical slots → Depth 1
            </Text>
          </Pressable>
        </View>
      </View>
    </TerminalSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: 'monospace', fontSize: 9, letterSpacing: 0.8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  backBtn: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  backBtnText: { fontFamily: 'monospace', fontSize: 7, fontWeight: '700' },
  headerTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerSub: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.5, marginTop: 2 },
  creditLine: { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  stashLine: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.4 },
  navRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  navCell: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  navLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  tabBody: { flex: 1, paddingHorizontal: 10, paddingTop: 10, minHeight: 0 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  descentBtn: {
    borderWidth: 2,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  descentBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  descentSub: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
  },
});
