import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { AEGIS_ABILITY_CATALOG } from '../data/aegisAbilities';
import {
  canAffordAbilityUnlock,
  formatAbilityTags,
  formatAbilityUnlockCost,
  getAssignableAbilities,
  isAbilityUnlocked,
} from '../data/aegisAbilityUnlockEngine';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../styles/hubTerminalUi';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { ResourceQuantity } from '../types/resourceItem';

const MONO = 'monospace';

export interface AegisLoadoutEditorTheme {
  accentColor: string;
  borderColor: string;
  mutedColor: string;
  textColor?: string;
  panelBg?: string;
}

interface AegisLoadoutEditorProps {
  draft: readonly AegisAbilityId[];
  selectedSlot: 0 | 1 | 2 | 3;
  onSelectSlot: (slot: 0 | 1 | 2 | 3) => void;
  onAssignAbility: (abilityId: AegisAbilityId) => void;
  onCommit: () => void;
  theme: AegisLoadoutEditorTheme;
  unlockedAbilities: readonly AegisAbilityId[];
  resourceStash?: ResourceQuantity;
  onUnlockAbility?: (abilityId: AegisAbilityId) => void;
  title?: string;
  hint?: string;
  commitLabel?: string;
  statusMessage?: string | null;
}

export default function AegisLoadoutEditor({
  draft,
  selectedSlot,
  onSelectSlot,
  onAssignAbility,
  onCommit,
  theme,
  unlockedAbilities,
  resourceStash = {},
  onUnlockAbility,
  title = 'AEGIS COMBAT LOADOUT // 4 ACTIVE SLOTS',
  hint = 'Select a slot, then tap an unlocked ability. Locked protocols can be decrypted with hub resources.',
  commitLabel = '[ COMMIT LOADOUT ]',
  statusMessage = null,
}: AegisLoadoutEditorProps): React.JSX.Element {
  const textColor = theme.textColor ?? '#d8e2dc';

  const handleAbilityPress = (abilityId: AegisAbilityId) => {
    const unlocked = isAbilityUnlocked(unlockedAbilities, abilityId);
    if (unlocked) {
      onAssignAbility(abilityId);
      return;
    }
    onUnlockAbility?.(abilityId);
  };

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: theme.mutedColor }]}>{title}</Text>
      <Text style={[styles.hint, { color: theme.mutedColor }]}>{hint}</Text>

      <View style={styles.slotRow}>
        {draft.map((abilityId, index) => {
          const isSelected = selectedSlot === index;
          const def = AEGIS_ABILITY_CATALOG[abilityId];
          return (
            <HapticPressable
              key={`slot-${index}`}
              onPress={() => onSelectSlot(index as 0 | 1 | 2 | 3)}
              style={({ pressed }) => [
                getInteractiveButtonStyle(theme.accentColor, { pressed, size: 'sm' }),
                styles.slot,
                !isSelected && { borderColor: theme.borderColor },
              ]}
            >
              <Text style={[styles.slotLabel, { color: theme.mutedColor }]}>{`S${index + 1}`}</Text>
              <Text style={[styles.slotAbility, { color: textColor }]} numberOfLines={2}>
                {def.label}
              </Text>
              <Text
                style={[styles.tagLine, { color: theme.mutedColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {formatAbilityTags(abilityId)}
              </Text>
              <Text
                style={[styles.slotMeta, { color: theme.mutedColor }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {def.description}
              </Text>
            </HapticPressable>
          );
        })}
      </View>

      <Text style={[styles.poolLabel, { color: theme.mutedColor }]}>ABILITY POOL // TAP TO ASSIGN OR UNLOCK</Text>
      <View style={styles.pool}>
        {getAssignableAbilities().map((abilityId) => {
          const def = AEGIS_ABILITY_CATALOG[abilityId];
          const assigned = draft.indexOf(abilityId);
          const isSelected = draft[selectedSlot] === abilityId;
          const unlocked = isAbilityUnlocked(unlockedAbilities, abilityId);
          const affordable = unlocked || canAffordAbilityUnlock(resourceStash, def.unlockCost);
          return (
            <HapticPressable
              key={abilityId}
              onPress={() => handleAbilityPress(abilityId)}
              style={({ pressed }) => [
                getInteractiveButtonStyle(theme.accentColor, { pressed, size: 'sm' }),
                styles.chip,
                !isSelected && { borderColor: theme.borderColor },
                !unlocked && !affordable && styles.chipLocked,
                !unlocked && affordable && styles.chipUnlockable,
              ]}
            >
              <Text style={[styles.chipLabel, { color: isSelected ? theme.accentColor : textColor }]}>
                {def.label}
              </Text>
              {!unlocked ? (
                <Text
                  style={[
                    styles.chipCost,
                    { color: affordable ? '#4ade80' : '#f87171' },
                  ]}
                >
                  {`LOCKED // ${formatAbilityUnlockCost(def.unlockCost)}`}
                </Text>
              ) : null}
              <Text
                style={[styles.chipTags, { color: theme.mutedColor }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {formatAbilityTags(abilityId)}
              </Text>
              {assigned >= 0 ? (
                <Text style={[styles.chipSlot, { color: theme.mutedColor }]}>{`S${assigned + 1}`}</Text>
              ) : null}
            </HapticPressable>
          );
        })}
      </View>

      {statusMessage ? (
        <Text style={[styles.status, { color: theme.mutedColor }]}>{statusMessage}</Text>
      ) : null}

      <HapticPressable
        onPress={onCommit}
        style={({ pressed }) => [
          getInteractiveButtonStyle(theme.accentColor, { pressed, size: 'md' }),
          styles.commitBtn,
        ]}
      >
        <Text style={[getInteractiveButtonTextStyle('md'), { color: theme.accentColor }]}>
          {commitLabel}
        </Text>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  title: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  hint: {
    fontFamily: MONO,
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.4,
  },
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'flex-start',
    gap: 4,
    minHeight: 72,
  },
  slotLabel: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.6,
  },
  slotAbility: {
    fontFamily: MONO,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '700',
  },
  tagLine: {
    fontFamily: MONO,
    fontSize: 6,
    lineHeight: 8,
    letterSpacing: 0.3,
  },
  slotMeta: {
    fontFamily: MONO,
    fontSize: 6,
    lineHeight: 9,
  },
  poolLabel: {
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  pool: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    alignItems: 'flex-start',
    gap: 2,
    minWidth: '30%',
    flexGrow: 1,
  },
  chipLocked: {
    opacity: 0.55,
  },
  chipUnlockable: {
    borderStyle: 'dashed',
  },
  chipLabel: {
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.4,
  },
  chipCost: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.4,
    lineHeight: 9,
  },
  chipTags: {
    fontFamily: MONO,
    fontSize: 5,
    lineHeight: 7,
    letterSpacing: 0.3,
  },
  chipSlot: {
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.5,
  },
  status: {
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  commitBtn: { marginTop: 4 },
});
