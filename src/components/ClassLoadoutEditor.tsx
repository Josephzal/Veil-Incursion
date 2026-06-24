import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import type { AbilityUnlockCost } from '../types/aegisCombat';
import {
  canAffordAbilityUnlock,
  formatAbilityUnlockCost,
} from '../data/classAbilityUnlockEngine';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../styles/hubTerminalUi';
import type { ResourceQuantity } from '../types/resourceItem';

const MONO = 'monospace';

export interface ClassAbilityCatalogEntry {
  label: string;
  description: string;
  unlockCost: AbilityUnlockCost;
  tagsLine: string;
}

export interface ClassLoadoutEditorTheme {
  accentColor: string;
  borderColor: string;
  mutedColor: string;
  textColor?: string;
}

interface ClassLoadoutEditorProps<T extends string> {
  draft: readonly T[];
  anchorId: T;
  anchorLabel: string;
  assignableIds: readonly T[];
  catalog: Record<string, ClassAbilityCatalogEntry>;
  selectedSlot: 1 | 2 | 3;
  onSelectSlot: (slot: 1 | 2 | 3) => void;
  onAssignAbility: (abilityId: T) => void;
  onCommit: () => void;
  theme: ClassLoadoutEditorTheme;
  unlockedAbilities: readonly T[];
  isUnlocked: (abilityId: T) => boolean;
  resourceStash?: ResourceQuantity;
  onUnlockAbility?: (abilityId: T) => void;
  title?: string;
  hint?: string;
  commitLabel?: string;
  statusMessage?: string | null;
}

export default function ClassLoadoutEditor<T extends string>({
  draft,
  anchorId,
  anchorLabel,
  assignableIds,
  catalog,
  selectedSlot,
  onSelectSlot,
  onAssignAbility,
  onCommit,
  theme,
  isUnlocked,
  resourceStash = {},
  onUnlockAbility,
  title = 'COMBAT LOADOUT // 4 ACTIVE SLOTS',
  hint = 'Slot 1 is your anchor ability. Select slots 2–4, then tap an ability to assign or unlock.',
  commitLabel = '[ COMMIT LOADOUT ]',
  statusMessage = null,
}: ClassLoadoutEditorProps<T>): React.JSX.Element {
  const textColor = theme.textColor ?? '#d8e2dc';

  const handleAbilityPress = (abilityId: T) => {
    const unlocked = isUnlocked(abilityId);
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
        <View
          style={[
            getInteractiveButtonStyle(theme.accentColor, { pressed: false, size: 'sm' }),
            styles.slot,
            styles.anchorSlot,
            { borderColor: theme.accentColor },
          ]}
        >
          <Text style={[styles.slotLabel, { color: theme.mutedColor }]}>S1 // ANCHOR</Text>
          <Text style={[styles.slotAbility, { color: textColor }]} numberOfLines={2}>
            {anchorLabel}
          </Text>
          <Text style={[styles.slotMeta, { color: theme.mutedColor }]} numberOfLines={2}>
            {catalog[anchorId]?.description ?? 'Class anchor — fixed.'}
          </Text>
        </View>

        {([1, 2, 3] as const).map((slotIndex) => {
          const abilityId = draft[slotIndex];
          const def = catalog[abilityId];
          const isSelected = selectedSlot === slotIndex;
          return (
            <HapticPressable
              key={`slot-${slotIndex}`}
              onPress={() => onSelectSlot(slotIndex)}
              style={({ pressed }) => [
                getInteractiveButtonStyle(theme.accentColor, { pressed, size: 'sm' }),
                styles.slot,
                !isSelected && { borderColor: theme.borderColor },
              ]}
            >
              <Text style={[styles.slotLabel, { color: theme.mutedColor }]}>{`S${slotIndex + 1}`}</Text>
              <Text style={[styles.slotAbility, { color: textColor }]} numberOfLines={2}>
                {def?.label ?? abilityId}
              </Text>
              <Text
                style={[styles.tagLine, { color: theme.mutedColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {def?.tagsLine ?? ''}
              </Text>
              <Text
                style={[styles.slotMeta, { color: theme.mutedColor }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {def?.description ?? ''}
              </Text>
            </HapticPressable>
          );
        })}
      </View>

      <Text style={[styles.poolLabel, { color: theme.mutedColor }]}>
        ABILITY POOL // TAP TO ASSIGN OR UNLOCK
      </Text>
      <View style={styles.pool}>
        {assignableIds.map((abilityId) => {
          const def = catalog[abilityId];
          const assigned = draft.indexOf(abilityId);
          const isSelected = draft[selectedSlot] === abilityId;
          const unlocked = isUnlocked(abilityId);
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
                {def.tagsLine}
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
  anchorSlot: {
    opacity: 0.92,
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
