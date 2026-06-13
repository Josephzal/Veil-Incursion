import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AEGIS_ABILITY_CATALOG } from '../data/aegisAbilities';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../styles/hubTerminalUi';
import { ALL_AEGIS_ABILITIES, type AegisAbilityId } from '../types/aegisCombat';

const MONO = 'monospace';
const ASSIGNABLE_ABILITIES = ALL_AEGIS_ABILITIES.filter((id) => id !== 'EVISCERATE');

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
  title = 'AEGIS COMBAT LOADOUT // 4 ACTIVE SLOTS',
  hint = 'Select a slot, then tap an ability. Eviscerate unlocks at full Abyssal Reserve.',
  commitLabel = '[ COMMIT LOADOUT ]',
  statusMessage = null,
}: AegisLoadoutEditorProps): React.JSX.Element {
  const textColor = theme.textColor ?? '#d8e2dc';

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: theme.mutedColor }]}>{title}</Text>
      <Text style={[styles.hint, { color: theme.mutedColor }]}>{hint}</Text>

      <View style={styles.slotRow}>
        {draft.map((abilityId, index) => {
          const isSelected = selectedSlot === index;
          return (
            <Pressable
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
                {AEGIS_ABILITY_CATALOG[abilityId].label}
              </Text>
              <Text
                style={[styles.slotMeta, { color: theme.mutedColor }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {AEGIS_ABILITY_CATALOG[abilityId].description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.poolLabel, { color: theme.mutedColor }]}>ABILITY POOL // TAP TO ASSIGN</Text>
      <View style={styles.pool}>
        {ASSIGNABLE_ABILITIES.map((abilityId) => {
          const assigned = draft.indexOf(abilityId);
          const isSelected = draft[selectedSlot] === abilityId;
          return (
            <Pressable
              key={abilityId}
              onPress={() => onAssignAbility(abilityId)}
              style={({ pressed }) => [
                getInteractiveButtonStyle(theme.accentColor, { pressed, size: 'sm' }),
                styles.chip,
                !isSelected && { borderColor: theme.borderColor },
              ]}
            >
              <Text style={[styles.chipLabel, { color: isSelected ? theme.accentColor : textColor }]}>
                {AEGIS_ABILITY_CATALOG[abilityId].label}
              </Text>
              {assigned >= 0 ? (
                <Text style={[styles.chipSlot, { color: theme.mutedColor }]}>{`S${assigned + 1}`}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {statusMessage ? (
        <Text style={[styles.status, { color: theme.mutedColor }]}>{statusMessage}</Text>
      ) : null}

      <Pressable
        onPress={onCommit}
        style={({ pressed }) => [
          getInteractiveButtonStyle(theme.accentColor, { pressed, size: 'md' }),
          styles.commitBtn,
        ]}
      >
        <Text style={[getInteractiveButtonTextStyle('md'), { color: theme.accentColor }]}>
          {commitLabel}
        </Text>
      </Pressable>
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
  chipLabel: {
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.4,
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
