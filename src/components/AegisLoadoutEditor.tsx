import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import HapticPressable from './HapticPressable';
import { Grid, GridCell } from './layout/Grid';
import TacticalTagRow, { parseTagsLine } from './hub/TacticalTagRow';
import DossierCardShell from './hub/DossierCardShell';
import TerminalText from './TerminalText';
import { DOSSIER_CTA_BG, DOSSIER_ROW_BG } from '../constants/dossierSurface';
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
  hubTerminalUi,
} from '../styles/hubTerminalUi';
import { terminalHoverStyle, readPressableHover } from '../utils/terminalHoverStyle';
import { viewShadow } from '../utils/adaptiveStyles';
import type { AegisAbilityId } from '../types/aegisCombat';
import type { ResourceQuantity } from '../types/resourceItem';

const MONO = 'monospace';

function loadoutSlotSurface(selected: boolean, accentColor: string, borderColor: string): ViewStyle {
  return {
    backgroundColor: DOSSIER_CTA_BG,
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
  const { isDesktop, scaleSpacing } = useHubLayout();
  const { bodySize, captionSize } = useSafehouseTypography();
  const panelPadding = scaleSpacing(10);

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

      <DossierCardShell
        padding={panelPadding}
        style={styles.sectionShell}
        contentStyle={styles.sectionContent}
      >
        <TerminalText variant="panelTitle" letterSpacing={0.8} style={[styles.sectionTitle, { color: theme.accentColor }]}>
          ACTIVE LOADOUT
        </TerminalText>
        <TerminalText variant="caption" style={{ color: theme.mutedColor }}>
          TAP SLOT TO SELECT
        </TerminalText>
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
      </DossierCardShell>

      <DossierCardShell
        padding={panelPadding}
        style={styles.sectionShell}
        contentStyle={styles.sectionContent}
      >
        <TerminalText variant="panelTitle" letterSpacing={0.8} style={[styles.sectionTitle, { color: theme.accentColor }]}>
          ABILITY POOL
        </TerminalText>
        <TerminalText variant="caption" style={{ color: theme.mutedColor }}>
          TAP TO ASSIGN OR UNLOCK
        </TerminalText>
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
  sectionShell: {
    width: '100%',
  },
  sectionContent: {
    gap: 8,
  },
  sectionTitle: {
    fontWeight: '700',
    flexShrink: 0,
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
