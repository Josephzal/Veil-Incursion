import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import RunItemSlotsPanel from '../run/RunItemSlotsPanel';
import HapticPressable from '../HapticPressable';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { listHubStagedConsumables, isRunItemHubConsumable } from '../../data/hubSafehouseEngine';
import type { CargoItemId } from '../../types/cargoGrid';
import { getRunItemDefinitionByAnyId } from '../../data/runItemRegistry';
import { normalizeHubRunItemId } from '../../data/runItemInventoryEngine';

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
      <TerminalText variant="section" letterSpacing={1} style={{ color: accent, marginBottom: 4 }}>
        [ RUN ITEM LOADOUT ]
      </TerminalText>
      <TerminalText variant="caption" style={{ color: muted, marginBottom: 8 }}>
        One-use combat consumables and field tools — separate from the cargo grid. Select a slot, then tap a staged item.
      </TerminalText>

      <RunItemSlotsPanel
        slots={account.runItemLoadout}
        accentColor={accent}
        mutedColor={muted}
        title="DESCENT SLOTS"
        onSelectCombatSlot={setSelectedCombatSlot}
        onSelectFieldSlot={setSelectedFieldSlot}
        onClearCombatSlot={(slotIndex) => clearRunItemLoadoutSlot('COMBAT', slotIndex)}
        onClearFieldSlot={(slotIndex) => clearRunItemLoadoutSlot('FIELD', slotIndex)}
        selectedCombatSlot={selectedCombatSlot}
        selectedFieldSlot={selectedFieldSlot}
      />

      <TerminalText variant="caption" style={{ color: muted, marginTop: 12, marginBottom: 6 }}>
        STAGED RUN ITEMS
      </TerminalText>
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
                    borderColor: accent,
                    opacity: pressed ? 0.82 : 1,
                  },
                ]}
              >
                <TerminalText variant="body" style={{ color: accent, fontWeight: '700' }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 4,
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
