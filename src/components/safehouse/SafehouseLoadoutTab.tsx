import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CargoPackingPanel from '../CargoPackingPanel';
import {
  isHubCraftableConsumable,
  listHubStagedConsumables,
} from '../../data/hubSafehouseEngine';
import { RESOURCE_REGISTRY } from '../../data/resourceRegistry';
import { ALL_RESOURCE_ITEM_IDS } from '../../data/resourceRegistry';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import type { CargoItemId } from '../../types/cargoGrid';
import { CARGO_ITEM_CATALOG } from '../../types/cargoGrid';
import type { ResourceItemId } from '../../types/resourceItem';
import { isResourceItemId } from '../../data/resourceRegistry';

const AMBER = '#d4a574';
const SLATE = '#1a1d22';

export default function SafehouseLoadoutTab(): React.JSX.Element {
  const { theme } = useTerminal();
  const {
    account,
    relocatePreRunCargoItem,
    loadStashResourceToCargo,
    returnPreRunCargoToStash,
    equipTacticalSlot,
    clearTacticalSlot,
    appendHubLog,
  } = usePlayerAccount();
  const [selectedTacticalSlot, setSelectedTacticalSlot] = useState<0 | 1 | 2>(0);
  const [selectedConsumableId, setSelectedConsumableId] = useState<CargoItemId | null>(null);

  const stagedConsumables = listHubStagedConsumables(account.hubCraftedConsumables);
  const stashResources = ALL_RESOURCE_ITEM_IDS.filter(
    (id) => (account.resourceStash[id] ?? 0) > 0,
  );

  const handleLoadResource = (resourceId: ResourceItemId) => {
    const result = loadStashResourceToCargo(resourceId);
    appendHubLog(result.logLine);
  };

  const handleReturnCargo = (instanceId: string) => {
    const result = returnPreRunCargoToStash(instanceId);
    appendHubLog(result.logLine);
  };

  const handleEquipTactical = () => {
    if (!selectedConsumableId) return;
    const result = equipTacticalSlot(selectedTacticalSlot, selectedConsumableId);
    appendHubLog(result.logLine);
    if (result.success) setSelectedConsumableId(null);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.split}>
        <View style={[styles.stashPanel, { borderColor: '#3a3028' }]}>
          <Text style={[styles.sectionTitle, { color: AMBER }]}>HOME STASH</Text>
          <Text style={[styles.sectionSub, { color: theme.mutedColor }]}>
            Abstract salvage vault — load resources into cargo grid.
          </Text>
          {stashResources.length === 0 ? (
            <Text style={[styles.empty, { color: theme.mutedColor }]}>STASH EMPTY</Text>
          ) : (
            stashResources.map((resourceId) => (
              <View key={resourceId} style={styles.stashRow}>
                <Text style={[styles.stashLabel, { color: theme.textColor }]}>
                  {`${account.resourceStash[resourceId]}× ${RESOURCE_REGISTRY[resourceId].name}`}
                </Text>
                <Pressable
                  onPress={() => handleLoadResource(resourceId)}
                  style={[styles.miniBtn, { borderColor: AMBER }]}
                >
                  <Text style={[styles.miniBtnText, { color: AMBER }]}>→ CARGO</Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={[styles.sectionTitle, styles.sectionGap, { color: AMBER }]}>
            STAGED CONSUMABLES
          </Text>
          {stagedConsumables.length === 0 ? (
            <Text style={[styles.empty, { color: theme.mutedColor }]}>CRAFT OR BUY CONSUMABLES</Text>
          ) : (
            stagedConsumables.map((entry) => (
              <Pressable
                key={entry.itemId}
                onPress={() => setSelectedConsumableId(entry.itemId)}
                style={[
                  styles.stashRow,
                  selectedConsumableId === entry.itemId ? styles.stashRowSelected : null,
                ]}
              >
                <Text style={[styles.stashLabel, { color: theme.textColor }]}>
                  {`${entry.quantity}× ${entry.name}`}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.cargoColumn}>
          <Text style={[styles.sectionTitle, { color: AMBER }]}>CARGO GRID // DEPLOYMENT PACK</Text>
          <CargoPackingPanel
            cargo={account.preRunCargo}
            theme={theme}
            accentColor={AMBER}
            onRelocateItem={relocatePreRunCargoItem}
            onDiscardItem={(instanceId) => {
              const item = account.preRunCargo.grid.placed.find((entry) => entry.instanceId === instanceId);
              if (item && isResourceItemId(item.itemId)) {
                handleReturnCargo(instanceId);
                return true;
              }
              return false;
            }}
            hideContinueButton
          />
          <View style={styles.placedResources}>
            {account.preRunCargo.grid.placed
              .filter((item) => isResourceItemId(item.itemId))
              .map((item) => (
                <Pressable
                  key={item.instanceId}
                  onPress={() => handleReturnCargo(item.instanceId)}
                  style={[styles.returnBtn, { borderColor: theme.mutedColor }]}
                >
                  <Text style={[styles.returnBtnText, { color: theme.mutedColor }]}>
                    {`← STASH ${RESOURCE_REGISTRY[item.itemId as ResourceItemId]?.name ?? item.itemId}`}
                  </Text>
                </Pressable>
              ))}
          </View>
        </View>
      </View>

      <View style={[styles.tacticalBlock, { borderColor: '#3a3028' }]}>
        <Text style={[styles.sectionTitle, { color: AMBER }]}>TACTICAL CONSUMABLE SLOTS</Text>
        <View style={styles.tacticalRow}>
          {account.tacticalLoadout.map((itemId, index) => {
            const slot = index as 0 | 1 | 2;
            const active = selectedTacticalSlot === slot;
            return (
              <Pressable
                key={`tactical-${index}`}
                onPress={() => setSelectedTacticalSlot(slot)}
                style={[
                  styles.tacticalSlot,
                  { borderColor: active ? AMBER : '#3a3028', backgroundColor: SLATE },
                ]}
              >
                <Text style={[styles.slotLabel, { color: theme.mutedColor }]}>{`SLOT ${index + 1}`}</Text>
                <Text style={[styles.slotValue, { color: itemId ? AMBER : theme.mutedColor }]}>
                  {itemId ? CARGO_ITEM_CATALOG[itemId]?.name.toUpperCase() : 'EMPTY'}
                </Text>
                {itemId ? (
                  <Pressable onPress={() => clearTacticalSlot(slot)} style={styles.clearLink}>
                    <Text style={[styles.clearLinkText, { color: '#ef4444' }]}>[ CLEAR ]</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable
          disabled={!selectedConsumableId || !isHubCraftableConsumable(selectedConsumableId)}
          onPress={handleEquipTactical}
          style={[
            styles.equipBtn,
            {
              borderColor: selectedConsumableId ? AMBER : '#3a3028',
              opacity: selectedConsumableId ? 1 : 0.45,
            },
          ]}
        >
          <Text style={[styles.equipBtnText, { color: AMBER }]}>
            {`[ ARM SLOT ${selectedTacticalSlot + 1} ]`}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 24, gap: 12 },
  split: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stashPanel: {
    width: 160,
    borderWidth: 1,
    backgroundColor: SLATE,
    padding: 8,
    gap: 6,
  },
  cargoColumn: { flex: 1, gap: 8, alignItems: 'center' },
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sectionSub: { fontFamily: 'monospace', fontSize: 7, lineHeight: 10 },
  sectionGap: { marginTop: 8 },
  empty: { fontFamily: 'monospace', fontSize: 7 },
  stashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingVertical: 4,
  },
  stashRowSelected: { backgroundColor: 'rgba(212, 165, 116, 0.12)' },
  stashLabel: { fontFamily: 'monospace', fontSize: 7, flex: 1 },
  miniBtn: { borderWidth: 1, paddingHorizontal: 4, paddingVertical: 2 },
  miniBtnText: { fontFamily: 'monospace', fontSize: 6, fontWeight: '700' },
  placedResources: { width: '100%', gap: 4, paddingHorizontal: 8 },
  returnBtn: { borderWidth: 1, padding: 6, alignItems: 'center' },
  returnBtnText: { fontFamily: 'monospace', fontSize: 7 },
  tacticalBlock: {
    borderWidth: 1,
    backgroundColor: SLATE,
    padding: 10,
    gap: 8,
  },
  tacticalRow: { flexDirection: 'row', gap: 8 },
  tacticalSlot: {
    flex: 1,
    borderWidth: 1,
    padding: 8,
    gap: 4,
    minHeight: 72,
  },
  slotLabel: { fontFamily: 'monospace', fontSize: 7, letterSpacing: 0.5 },
  slotValue: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
  clearLink: { marginTop: 4 },
  clearLinkText: { fontFamily: 'monospace', fontSize: 7 },
  equipBtn: { borderWidth: 1, paddingVertical: 8, alignItems: 'center' },
  equipBtnText: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700' },
});
