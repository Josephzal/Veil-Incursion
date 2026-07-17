import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import RunItemSlotChip from '../run/RunItemSlotChip';
import HapticPressable from '../HapticPressable';
import DossierCardShell from './DossierCardShell';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { listHubStagedConsumables, isRunItemHubConsumable } from '../../data/hubSafehouseEngine';
import type { CargoItemId } from '../../types/cargoGrid';
import { getRunItemDefinitionByAnyId } from '../../data/runItemRegistry';
import { normalizeHubRunItemId } from '../../data/runItemInventoryEngine';
import { formatRunItemSlotLabel } from '../../data/runItemUseEngine';
import { LOADOUT_SECTION_GAP, LoadoutSectionBlock } from './loadoutTabUi';

interface RunItemLoadoutPanelProps {
  accent: string;
  muted: string;
}

export default function RunItemLoadoutPanel({
  accent,
  muted,
}: RunItemLoadoutPanelProps): React.JSX.Element {
  const { account, equipRunItemLoadoutSlot, clearRunItemLoadoutSlot, appendHubLog } = usePlayerAccount();
  const [selectedCombatSlot, setSelectedCombatSlot] = useState<0 | 1 | null>(null);
  const [selectedFieldSlot, setSelectedFieldSlot] = useState<0 | 1 | null>(null);

  const stagedRunItems = useMemo(
    () => listHubStagedConsumables(account.hubCraftedConsumables).filter((entry) => (
      isRunItemHubConsumable(entry.itemId)
    )),
    [account.hubCraftedConsumables],
  );

  const handleEquip = useCallback((itemId: CargoItemId) => {
    const def = getRunItemDefinitionByAnyId(itemId);
    if (!def) return;
    const slotType = def.slotType;
    const selectedSlot = slotType === 'COMBAT' ? selectedCombatSlot : selectedFieldSlot;
    if (selectedSlot == null) {
      appendHubLog(`>> SELECT A ${slotType} SLOT BEFORE EQUIPPING ${def.shortName.toUpperCase()}.`);
      return;
    }
    const result = equipRunItemLoadoutSlot(slotType, selectedSlot, itemId);
    appendHubLog(result.logLine);
    if (result.success) {
      if (slotType === 'COMBAT') setSelectedCombatSlot(null);
      else setSelectedFieldSlot(null);
    }
  }, [
    appendHubLog,
    equipRunItemLoadoutSlot,
    selectedCombatSlot,
    selectedFieldSlot,
  ]);

  return (
    <View style={styles.root}>
      <LoadoutSectionBlock label="Combat Consumables">
        <DossierCardShell padding={10} contentStyle={styles.slotShell}>
          <View style={styles.row}>
            {account.runItemLoadout.combatSlots.map((itemId, index) => {
              const slotIndex = index as 0 | 1;
              return (
                <View key={`combat-${index}`} style={styles.cell}>
                  <RunItemSlotChip
                    itemId={itemId}
                    label={formatRunItemSlotLabel('COMBAT', index)}
                    accentColor={accent}
                    mutedColor={muted}
                    selected={selectedCombatSlot === slotIndex}
                    onPress={() => setSelectedCombatSlot(slotIndex)}
                    onClear={itemId ? () => clearRunItemLoadoutSlot('COMBAT', slotIndex) : undefined}
                  />
                </View>
              );
            })}
          </View>
        </DossierCardShell>
      </LoadoutSectionBlock>

      <LoadoutSectionBlock label="Field Tools">
        <DossierCardShell padding={10} contentStyle={styles.slotShell}>
          <View style={styles.row}>
            {account.runItemLoadout.fieldSlots.map((itemId, index) => {
              const slotIndex = index as 0 | 1;
              return (
                <View key={`field-${index}`} style={styles.cell}>
                  <RunItemSlotChip
                    itemId={itemId}
                    label={formatRunItemSlotLabel('FIELD', index)}
                    accentColor={accent}
                    mutedColor={muted}
                    selected={selectedFieldSlot === slotIndex}
                    onPress={() => setSelectedFieldSlot(slotIndex)}
                    onClear={itemId ? () => clearRunItemLoadoutSlot('FIELD', slotIndex) : undefined}
                  />
                </View>
              );
            })}
          </View>
        </DossierCardShell>
      </LoadoutSectionBlock>

      <LoadoutSectionBlock label="Staged Items">
        <View style={styles.stashList}>
          {stagedRunItems.length === 0 ? (
            <TerminalText variant="caption" style={{ color: muted }}>
              Craft consumables at the Fabrication Matrix to stage run items here.
            </TerminalText>
          ) : (
            stagedRunItems.map((entry) => {
              const def = getRunItemDefinitionByAnyId(entry.itemId);
              const normalized = normalizeHubRunItemId(entry.itemId);
              return (
                <HapticPressable
                  key={entry.itemId}
                  onPress={() => handleEquip(entry.itemId)}
                  style={({ pressed }) => [
                    styles.stashRow,
                    {
                      borderColor: muted,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <TerminalText variant="body" style={{ color: '#d8e2dc', fontWeight: '700' }}>
                    {`${entry.name.toUpperCase()} ×${entry.quantity}`}
                  </TerminalText>
                  <TerminalText variant="caption" style={{ color: muted, marginTop: 2 }}>
                    {def?.effectSummary ?? normalized ?? entry.itemId}
                  </TerminalText>
                </HapticPressable>
              );
            })
          )}
        </View>
      </LoadoutSectionBlock>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: LOADOUT_SECTION_GAP,
  },
  slotShell: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  stashList: {
    gap: 8,
  },
  stashRow: {
    borderWidth: 1,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
