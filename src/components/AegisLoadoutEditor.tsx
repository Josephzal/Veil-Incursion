import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import HapticPressable from './HapticPressable';
import { Grid, GridCell } from './layout/Grid';
import TacticalTagRow from './hub/TacticalTagRow';
import DossierCardShell from './hub/DossierCardShell';
import { LoadoutSectionBlock, LOADOUT_SECTION_GAP } from './hub/loadoutTabUi';
import { CARD_BLACK, DOSSIER_ROW_BG } from '../constants/dossierSurface';
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
import { getAegisTechniqueDefinition, isAegisTechniqueId } from '../data/aegisTechniqueCatalog';
import { useSafehouseTypography } from '../hooks/useSafehouseTypography';
import {
  getInteractiveButtonStyle,
  getInteractiveButtonTextStyle,
  hubTerminalUi,
} from '../styles/hubTerminalUi';
import { terminalHoverStyle, readPressableHover } from '../utils/terminalHoverStyle';
import { viewShadow } from '../utils/adaptiveStyles';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { ResourceQuantity } from '../types/resourceItem';

const MONO = 'monospace';

function loadoutSlotSurface(selected: boolean, accentColor: string, borderColor: string): ViewStyle {
  return {
    backgroundColor: CARD_BLACK,
    borderColor: selected ? accentColor : borderColor,
    borderWidth: selected ? 2 : 1,
    ...(selected
      ? viewShadow({
        color: accentColor,
        opacity: 0.5,
        radius: 12,
        offset: { width: 0, height: 0 },
      })
      : null),
  };
}

function poolChipSurface(assigned: boolean, accentColor: string, borderColor: string): ViewStyle {
  return {
    backgroundColor: DOSSIER_ROW_BG,
    borderColor: assigned ? accentColor : borderColor,
    borderWidth: assigned ? 2 : 1,
  };
}

export interface AegisLoadoutEditorTheme {
  accentColor: string;
  borderColor: string;
  mutedColor: string;
  textColor?: string;
  panelBg?: string;
}

interface AegisLoadoutEditorProps {
  draft: readonly string[];
  selectedSlot: 0 | 1 | 2 | 3;
  onSelectSlot: (slot: 0 | 1 | 2 | 3) => void;
  onAssignAbility: (abilityId: string) => void;
  onCommit: () => void;
  theme: AegisLoadoutEditorTheme;
  unlockedAbilities: readonly string[];
  resourceStash?: ResourceQuantity;
  onUnlockAbility?: (abilityId: AegisAbilityId) => void;
  title?: string;
  hint?: string;
  commitLabel?: string;
  statusMessage?: string | null;
  /** When true, hides the manual commit button (loadout auto-saves). */
  hideCommit?: boolean;
  /** Phase A — three technique slots from the shared pool of 12. */
  techniqueMode?: boolean;
  techniquePool?: readonly { id: string; label: string; description: string }[];
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
  title = 'AEGIS TECHNIQUES // 3 OF 12',
  hint = 'Select three techniques. At least one Brand technique required.',
  commitLabel = '[ COMMIT TECHNIQUES ]',
  statusMessage = null,
  hideCommit = false,
  techniqueMode = false,
  techniquePool,
}: AegisLoadoutEditorProps): React.JSX.Element {
  const textColor = theme.textColor ?? '#d8e2dc';
  const { isDesktop } = useHubLayout();
  const { bodySize, captionSize } = useSafehouseTypography();
  const cardStyle = isDesktop ? styles.cardDesktop : null;

  const pool = techniqueMode
    ? (techniquePool ?? getAssignableAbilities().map((id) => {
      const def = getAegisTechniqueDefinition(id);
      return { id, label: def.label, description: def.description };
    }))
    : getAssignableAbilities().map((id) => {
      const def = AEGIS_ABILITY_CATALOG[id];
      return { id, label: def.label, description: def.description };
    });

  const handleAbilityPress = (abilityId: string) => {
    if (techniqueMode) {
      onAssignAbility(abilityId);
      return;
    }
    const id = abilityId as AegisAbilityId;
    const unlocked = isAbilityUnlocked(unlockedAbilities as AegisAbilityId[], id);
    if (unlocked) {
      onAssignAbility(id);
      return;
    }
    onUnlockAbility?.(id);
  };

  const resolveSlotMeta = (abilityId: string) => {
    if (isAegisTechniqueId(abilityId)) {
      const def = getAegisTechniqueDefinition(abilityId);
      return {
        label: def.label,
        description: def.description,
        costLine: formatClassAbilityCostLine('AEGIS', abilityId as AegisAbilityId),
        tags: AEGIS_ABILITY_CATALOG[abilityId as AegisAbilityId]?.tags ?? [],
      };
    }
    const def = AEGIS_ABILITY_CATALOG[abilityId as AegisAbilityId];
    return {
      label: def?.label ?? abilityId,
      description: def?.description ?? '',
      costLine: formatClassAbilityCostLine('AEGIS', abilityId as AegisAbilityId),
      tags: def ? getAbilityDefinition(abilityId as AegisAbilityId).tags : [],
    };
  };

  return (
    <View style={styles.root}>
      {title ? <Text style={[styles.title, { color: theme.mutedColor }]}>{title}</Text> : null}
      {hint ? <Text style={[styles.hint, { color: theme.mutedColor }]}>{hint}</Text> : null}

      <LoadoutSectionBlock label={techniqueMode ? 'Selected Techniques' : 'Active Slots'}>
        <DossierCardShell
          padding={10}
          style={styles.sectionShell}
          contentStyle={styles.sectionContent}
        >
        <Grid columns={techniqueMode ? 3 : 2}>
        {draft.map((abilityId, index) => {
          const isSelected = selectedSlot === index;
          const meta = resolveSlotMeta(abilityId);
          return (
            <GridCell key={`slot-${index}`}>
              <HapticPressable
                onPress={() => onSelectSlot(index as 0 | 1 | 2 | 3)}
                style={(state) => [
                  hubTerminalUi.interactiveButton,
                  hubTerminalUi.interactiveButtonSm,
                  styles.card,
                  cardStyle,
                  loadoutSlotSurface(isSelected, theme.accentColor, theme.borderColor),
                  terminalHoverStyle(readPressableHover(state), state.pressed),
                ]}
              >
                <Text style={[styles.slotLabel, { color: theme.mutedColor, fontSize: captionSize(8) }]}>
                  {`S${index + 1}`}
                </Text>
                <Text
                  style={[
                    styles.slotAbility,
                    {
                      color: isSelected ? theme.accentColor : textColor,
                      fontSize: bodySize(8),
                      lineHeight: bodySize(11),
                    },
                  ]}
                  numberOfLines={2}
                >
                  {meta.label}
                </Text>
                {meta.costLine ? (
                  <Text
                    style={[styles.tagLine, { color: theme.mutedColor, fontSize: captionSize(6), lineHeight: captionSize(8) }]}
                    numberOfLines={1}
                  >
                    {`COST: ${meta.costLine}`}
                  </Text>
                ) : null}
                <TacticalTagRow tags={meta.tags} />
                <Text
                  style={[styles.slotMeta, { color: theme.mutedColor, fontSize: captionSize(6), lineHeight: captionSize(9) }]}
                  numberOfLines={2}
                >
                  {meta.description}
                </Text>
              </HapticPressable>
            </GridCell>
          );
        })}
        </Grid>
        </DossierCardShell>
      </LoadoutSectionBlock>

      <LoadoutSectionBlock label={techniqueMode ? 'Technique Pool' : 'Ability Pool'}>
        <DossierCardShell
          padding={10}
          style={styles.sectionShell}
          contentStyle={styles.sectionContent}
        >
        <Grid columns={2}>
        {pool.map((entry) => {
          const abilityId = entry.id;
          const costLine = formatClassAbilityCostLine('AEGIS', abilityId as AegisAbilityId);
          const tags = AEGIS_ABILITY_CATALOG[abilityId as AegisAbilityId]?.tags ?? [];
          const assigned = draft.indexOf(abilityId);
          const isSelected = draft[selectedSlot] === abilityId;
          const unlocked = techniqueMode || isAbilityUnlocked(
            unlockedAbilities as AegisAbilityId[],
            abilityId as AegisAbilityId,
          );
          const unlockCost = AEGIS_ABILITY_CATALOG[abilityId as AegisAbilityId]?.unlockCost ?? {};
          const affordable = unlocked || canAffordAbilityUnlock(resourceStash, unlockCost);
          return (
            <GridCell key={abilityId}>
              <HapticPressable
                onPress={() => handleAbilityPress(abilityId)}
                style={(state) => [
                  hubTerminalUi.interactiveButton,
                  hubTerminalUi.interactiveButtonSm,
                  styles.card,
                  cardStyle,
                  poolChipSurface(assigned >= 0, theme.accentColor, theme.borderColor),
                  !unlocked && !affordable && styles.chipLocked,
                  !unlocked && affordable && styles.chipUnlockable,
                  terminalHoverStyle(readPressableHover(state), state.pressed),
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    {
                      color: assigned >= 0 || isSelected ? theme.accentColor : textColor,
                      fontSize: bodySize(7),
                    },
                  ]}
                >
                  {entry.label}
                </Text>
                {!unlocked && !techniqueMode ? (
                  <Text
                    style={[
                      styles.chipCost,
                      { color: affordable ? '#4ade80' : '#f87171', fontSize: captionSize(6), lineHeight: captionSize(9) },
                    ]}
                  >
                    {`LOCKED // ${formatAbilityUnlockCost(unlockCost)}`}
                  </Text>
                ) : null}
                <Text
                  style={[styles.chipTags, { color: theme.mutedColor, fontSize: captionSize(5), lineHeight: captionSize(7) }]}
                  numberOfLines={2}
                >
                  {costLine
                    ? `COST: ${costLine}`
                    : (AEGIS_ABILITY_CATALOG[abilityId as AegisAbilityId]
                      ? formatAbilityTags(abilityId as AegisAbilityId)
                      : entry.description)}
                </Text>
                {costLine && tags.length > 0 ? <TacticalTagRow tags={tags} /> : null}
                {assigned >= 0 ? (
                  <Text style={[styles.chipSlot, { color: theme.accentColor, fontSize: captionSize(6), fontWeight: '800' }]}>
                    {`EQUIPPED // S${assigned + 1}`}
                  </Text>
                ) : null}
              </HapticPressable>
            </GridCell>
          );
        })}
        </Grid>
      </DossierCardShell>
      </LoadoutSectionBlock>

      {statusMessage ? (
        <Text style={[styles.status, { color: theme.mutedColor }]}>{statusMessage}</Text>
      ) : null}

      {hideCommit ? null : (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: LOADOUT_SECTION_GAP },
  sectionShell: {
    width: '100%',
  },
  sectionContent: {
    gap: 8,
  },
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
