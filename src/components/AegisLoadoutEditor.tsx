import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { Grid, GridCell } from './layout/Grid';
import TacticalTagRow, { parseTagsLine } from './hub/TacticalTagRow';
import { useHubLayout } from '../context/HubLayoutContext';
import { ABILITY_CARD_MIN_HEIGHT } from '../constants/layoutTokens';
import { formatClassAbilityCostLine } from '../data/classAbilityResolver';
import { AEGIS_ABILITY_CATALOG, getAbilityDefinition } from '../data/aegisAbilities';
import {
  canAffordAbilityUnlock,
  formatAbilityTags,
  formatAbilityUnlockCost,
  getAssignableAbilities,
  isAbilityUnlocked,
} from '../data/aegisAbilityUnlockEngine';
import { useSafehouseTypography } from '../hooks/useSafehouseTypography';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
} from '../styles/hubTerminalUi';
import { terminalHoverStyle, readPressableHover } from '../utils/terminalHoverStyle';
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
  hint = 'Select a slot, then tap an ability. Costs show AP // Reserve // Brand economy.',
  commitLabel = '[ COMMIT LOADOUT ]',
  statusMessage = null,
}: AegisLoadoutEditorProps): React.JSX.Element {
  const textColor = theme.textColor ?? '#d8e2dc';
  const { isDesktop } = useHubLayout();
  const { bodySize, captionSize } = useSafehouseTypography();

  const handleAbilityPress = (abilityId: AegisAbilityId) => {
    const unlocked = isAbilityUnlocked(unlockedAbilities, abilityId);
    if (unlocked) {
      onAssignAbility(abilityId);
      return;
    }
    onUnlockAbility?.(abilityId);
  };

  const cardStyle = isDesktop ? styles.cardDesktop : null;

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: theme.mutedColor }]}>{title}</Text>
      <Text style={[styles.hint, { color: theme.mutedColor }]}>{hint}</Text>

      <Text style={[styles.sectionLabel, { color: theme.mutedColor, fontSize: captionSize(7) }]}>
        ACTIVE LOADOUT // TAP SLOT TO SELECT
      </Text>
      <Grid columns={2}>
        {draft.map((abilityId, index) => {
          const isSelected = selectedSlot === index;
          const def = AEGIS_ABILITY_CATALOG[abilityId];
          const costLine = formatClassAbilityCostLine('AEGIS', abilityId);
          const tags = getAbilityDefinition(abilityId).tags;
          return (
            <GridCell key={`slot-${index}`}>
              <HapticPressable
                onPress={() => onSelectSlot(index as 0 | 1 | 2 | 3)}
                style={(state) => [
                  getInteractiveButtonStyle(theme.accentColor, { pressed: state.pressed, size: 'sm' }),
                  styles.card,
                  cardStyle,
                  !isSelected && { borderColor: theme.borderColor },
                  terminalHoverStyle(readPressableHover(state), state.pressed),
                ]}
              >
                <Text style={[styles.slotLabel, { color: theme.mutedColor, fontSize: captionSize(8) }]}>
                  {`S${index + 1}`}
                </Text>
                <Text
                  style={[styles.slotAbility, { color: textColor, fontSize: bodySize(8), lineHeight: bodySize(11) }]}
                  numberOfLines={2}
                >
                  {def.label}
                </Text>
                {costLine ? (
                  <Text
                    style={[styles.tagLine, { color: theme.mutedColor, fontSize: captionSize(6), lineHeight: captionSize(8) }]}
                    numberOfLines={1}
                  >
                    {`COST: ${costLine}`}
                  </Text>
                ) : null}
                <TacticalTagRow tags={tags} />
                <Text
                  style={[styles.slotMeta, { color: theme.mutedColor, fontSize: captionSize(6), lineHeight: captionSize(9) }]}
                  numberOfLines={2}
                >
                  {def.description}
                </Text>
              </HapticPressable>
            </GridCell>
          );
        })}
      </Grid>

      <Text style={[styles.poolLabel, { color: theme.mutedColor, fontSize: captionSize(7) }]}>
        ABILITY POOL // TAP TO ASSIGN OR UNLOCK
      </Text>
      <Grid columns={2}>
        {getAssignableAbilities().map((abilityId) => {
          const def = AEGIS_ABILITY_CATALOG[abilityId];
          const costLine = formatClassAbilityCostLine('AEGIS', abilityId);
          const tags = getAbilityDefinition(abilityId).tags;
          const assigned = draft.indexOf(abilityId);
          const isSelected = draft[selectedSlot] === abilityId;
          const unlocked = isAbilityUnlocked(unlockedAbilities, abilityId);
          const affordable = unlocked || canAffordAbilityUnlock(resourceStash, def.unlockCost);
          return (
            <GridCell key={abilityId}>
              <HapticPressable
                onPress={() => handleAbilityPress(abilityId)}
                style={(state) => [
                  getInteractiveButtonStyle(theme.accentColor, { pressed: state.pressed, size: 'sm' }),
                  styles.card,
                  cardStyle,
                  !isSelected && { borderColor: theme.borderColor },
                  !unlocked && !affordable && styles.chipLocked,
                  !unlocked && affordable && styles.chipUnlockable,
                  terminalHoverStyle(readPressableHover(state), state.pressed),
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: isSelected ? theme.accentColor : textColor, fontSize: bodySize(7) },
                  ]}
                >
                  {def.label}
                </Text>
                {!unlocked ? (
                  <Text
                    style={[
                      styles.chipCost,
                      { color: affordable ? '#4ade80' : '#f87171', fontSize: captionSize(6), lineHeight: captionSize(9) },
                    ]}
                  >
                    {`LOCKED // ${formatAbilityUnlockCost(def.unlockCost)}`}
                  </Text>
                ) : null}
                <Text
                  style={[styles.chipTags, { color: theme.mutedColor, fontSize: captionSize(5), lineHeight: captionSize(7) }]}
                  numberOfLines={2}
                >
                  {costLine ? `COST: ${costLine}` : formatAbilityTags(abilityId)}
                </Text>
                {costLine ? <TacticalTagRow tags={tags} /> : null}
                {assigned >= 0 ? (
                  <Text style={[styles.chipSlot, { color: theme.mutedColor, fontSize: captionSize(6) }]}>
                    {`S${assigned + 1}`}
                  </Text>
                ) : null}
              </HapticPressable>
            </GridCell>
          );
        })}
      </Grid>

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
  card: {
    alignItems: 'flex-start',
    gap: 4,
    width: '100%',
  },
  cardDesktop: {
    minHeight: ABILITY_CARD_MIN_HEIGHT,
    height: '100%',
  },
  slotLabel: {
    fontFamily: MONO,
    letterSpacing: 0.6,
  },
  slotAbility: {
    fontFamily: MONO,
    fontWeight: '700',
  },
  tagLine: {
    fontFamily: MONO,
    letterSpacing: 0.3,
  },
  slotMeta: {
    fontFamily: MONO,
  },
  poolLabel: {
    fontFamily: MONO,
    letterSpacing: 0.8,
    marginTop: 8,
  },
  sectionLabel: {
    fontFamily: MONO,
    letterSpacing: 0.8,
  },
  chipLocked: {
    opacity: 0.55,
  },
  chipUnlockable: {
    borderStyle: 'dashed',
  },
  chipLabel: {
    fontFamily: MONO,
    letterSpacing: 0.4,
  },
  chipCost: {
    fontFamily: MONO,
    letterSpacing: 0.4,
  },
  chipTags: {
    fontFamily: MONO,
    letterSpacing: 0.3,
  },
  chipSlot: {
    fontFamily: MONO,
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
