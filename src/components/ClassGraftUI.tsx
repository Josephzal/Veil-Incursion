import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import {
  canGraftClassAbility,
  getClassGraftDefinition,
} from '../data/classGraftEngine';
import { resolveClassAbilityCost } from '../data/classAbilityResolver';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import type { ClassType } from '../types/game';
import type {
  EnvoyAbilityGraftMap,
  HexShotAbilityGraftMap,
  OperativeClassGraftId,
} from '../types/classGraft';
import type { AbilityGraftMap, VeilGraftId } from '../types/veilGraft';
import type { EnvoyLoadout, HexShotAbilityId, HexShotLoadout } from '../types/operativeClass';
import type { AegisLoadout } from '../types/aegisCombat';
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';
import { VEIL } from '../theme/veilTerminalTokens';

const TERMINAL_ACCENT = VEIL.mint;
const GRAFT_SELECT_ACCENT = VEIL.occult;
const MUTED_TEXT = VEIL.textMuted;
const PANEL_BORDER = VEIL.line;
const CARD_BG = VEIL.surface2;
const CARD_BORDER = VEIL.lineFaint;
const PANEL_BG = 'rgba(4, 5, 5, 0.88)';

type ClassLoadout = AegisLoadout | HexShotLoadout | EnvoyLoadout;
type ClassGraftMap = AbilityGraftMap | HexShotAbilityGraftMap | EnvoyAbilityGraftMap;

export interface GraftInjectSelection {
  graftId: string | null;
  abilityId: string | null;
  canInject: boolean;
}

interface ClassGraftUIProps {
  activeClass: ClassType;
  loadout: ClassLoadout;
  offers: readonly (OperativeClassGraftId | import('../types/veilGraft').VeilGraftId)[];
  residueBalance: number;
  abilityGrafts: ClassGraftMap;
  onSelectionChange?: (selection: GraftInjectSelection) => void;
  compact?: boolean;
  borderColor: string;
  primaryColor: string;
  mutedColor: string;
}

export default function ClassGraftUI({
  activeClass,
  loadout,
  offers,
  residueBalance,
  abilityGrafts,
  onSelectionChange,
  compact = false,
  borderColor: _borderColor,
  primaryColor,
  mutedColor: _mutedColor,
}: ClassGraftUIProps): React.JSX.Element {
  const { fontScale, scaleFont, scaleSpacing } = useResponsiveLayout();
  const [selectedGraftId, setSelectedGraftId] = useState<string | null>(null);
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);

  const selectedGraft = selectedGraftId
    ? getClassGraftDefinition(activeClass, selectedGraftId)
    : null;

  const panelPadding = scaleSpacing(compact ? 16 : 24);
  const cardPadding = scaleSpacing(compact ? 10 : 16);
  const cardGap = scaleSpacing(compact ? 8 : 12);
  const slotMinHeight = scaleSpacing(compact ? 52 : 72);
  const headerSize = scaleFont(compact ? 10 : 11);
  const residueSize = scaleFont(compact ? 11 : 12);
  const subheaderSize = scaleFont(compact ? 9 : 10);
  const cardTitleSize = (compact ? 9 : 10) * fontScale * 1.1;
  const cardBodySize = scaleFont(compact ? 8 : 9);
  const abilityLabelSize = scaleFont(compact ? 9 : 10);
  const tagSize = scaleFont(compact ? 7 : 8);

  const abilityRows = useMemo(
    () => {
      const abilityIds: string[] = activeClass === 'HEX_SHOT'
        ? [...loadout, 'PHASE_SHIFT_RELOAD' as HexShotAbilityId]
        : [...loadout];
      return abilityIds.map((abilityId) => {
        const cost = resolveClassAbilityCost(activeClass, abilityId);
        return {
          abilityId,
          label: cost.label,
          graftId: (abilityGrafts as Record<string, OperativeClassGraftId | VeilGraftId | undefined>)[abilityId],
          graftable: canGraftClassAbility(activeClass, abilityId),
        };
      });
    },
    [abilityGrafts, activeClass, loadout],
  );

  const classLabel = activeClass === 'HEX_SHOT'
    ? 'HEX-SHOT GRAFT'
    : activeClass === 'ENVOY'
      ? 'ENVOY GRAFT'
      : 'VEIL-GRAFT';

  useEffect(() => {
    const canInject = selectedGraftId != null
      && selectedAbilityId != null
      && selectedGraft != null
      && residueBalance >= selectedGraft.cost
      && canGraftClassAbility(activeClass, selectedAbilityId);

    onSelectionChange?.({
      graftId: selectedGraftId,
      abilityId: selectedAbilityId,
      canInject,
    });
  }, [
    activeClass,
    onSelectionChange,
    residueBalance,
    selectedAbilityId,
    selectedGraft,
    selectedGraftId,
  ]);

  const handleSelectGraft = (graftId: string) => {
    setSelectedGraftId(graftId);
    setSelectedAbilityId(null);
  };

  const handleSelectAbility = (abilityId: string, graftable: boolean) => {
    if (!selectedGraftId || !graftable) return;
    if (!selectedGraft || residueBalance < selectedGraft.cost) return;
    setSelectedAbilityId(abilityId);
  };

  const dashedBorder = Platform.OS === 'web'
    ? ({ borderStyle: 'dashed' as const })
    : ({ borderStyle: 'dashed' as const });

  return (
    <View
      style={[
        styles.panel,
        {
          padding: panelPadding,
          marginTop: compact ? 0 : scaleSpacing(24),
          borderColor: PANEL_BORDER,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.headerPrefix,
            {
              color: TERMINAL_ACCENT,
              fontSize: headerSize,
              lineHeight: headerSize * 1.3,
            },
          ]}
        >
          {`${classLabel} TERMINAL // RESIDUE `}
        </Text>
        <Text
          style={[
            styles.headerResidue,
            {
              color: GRAFT_SELECT_ACCENT,
              fontSize: residueSize,
              lineHeight: residueSize * 1.25,
            },
          ]}
        >
          {residueBalance}
        </Text>
      </View>

      <Text
        style={[
          styles.subheader,
          {
            color: MUTED_TEXT,
            fontSize: subheaderSize,
            lineHeight: subheaderSize * 1.45,
            marginTop: scaleSpacing(compact ? 4 : 8),
          },
        ]}
      >
        Select a graft cartridge, patch an ability slot, then inject. Anchor and Ultimate abilities are locked.
      </Text>

      <View style={[styles.offerCol, { gap: cardGap, marginTop: scaleSpacing(compact ? 10 : 20) }]}>
        {offers.map((graftId) => {
          const graft = getClassGraftDefinition(activeClass, graftId);
          const affordable = residueBalance >= graft.cost;
          const selected = selectedGraftId === graftId;
          const dimmed = selectedGraftId != null && !selected;

          return (
            <HapticPressable
              key={graftId}
              disabled={!affordable}
              onPress={() => handleSelectGraft(graftId)}
              style={(state) => [
                styles.offerCard,
                {
                  padding: cardPadding,
                  borderColor: selected ? GRAFT_SELECT_ACCENT : CARD_BORDER,
                  backgroundColor: selected ? 'rgba(6, 182, 212, 0.1)' : CARD_BG,
                  opacity: !affordable ? 0.35 : dimmed ? 0.4 : state.pressed ? 0.88 : 1,
                  transform: selected ? [{ scale: 1.02 }] : undefined,
                },
                terminalHoverStyle(readPressableHover(state), state.pressed),
              ]}
            >
              <View style={styles.offerTitleRow}>
                <Text
                  style={[
                    styles.offerTitle,
                    {
                      color: selected ? GRAFT_SELECT_ACCENT : primaryColor,
                      fontSize: cardTitleSize,
                      lineHeight: cardTitleSize * 1.25,
                    },
                  ]}
                >
                  {graft.name.toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.offerCost,
                    {
                      color: selected ? GRAFT_SELECT_ACCENT : primaryColor,
                      fontSize: cardTitleSize,
                      lineHeight: cardTitleSize * 1.25,
                    },
                  ]}
                >
                  {`${graft.cost} RESIDUE`}
                </Text>
              </View>
              <Text
                style={[
                  styles.offerBody,
                  {
                    color: MUTED_TEXT,
                    fontSize: cardBodySize,
                    lineHeight: cardBodySize * 1.4,
                    marginTop: scaleSpacing(compact ? 4 : 6),
                  },
                ]}
                numberOfLines={compact ? 2 : 3}
              >
                {graft.description}
              </Text>
            </HapticPressable>
          );
        })}
      </View>

      <View
        style={[
          styles.abilitySection,
          {
            borderTopColor: CARD_BORDER,
            paddingTop: scaleSpacing(compact ? 12 : 24),
            marginTop: scaleSpacing(compact ? 8 : 12),
          },
        ]}
      >
        <View
          style={[
            styles.loadoutGrid,
            {
              gap: cardGap,
            },
          ]}
        >
          {abilityRows.map(({ abilityId, label, graftId, graftable }) => {
            const existing = graftId ? getClassGraftDefinition(activeClass, graftId) : null;
            const slotSelected = selectedAbilityId === abilityId;
            const canSelect = graftable
              && selectedGraftId != null
              && selectedGraft != null
              && residueBalance >= selectedGraft.cost;
            const dimmed = selectedAbilityId != null
              && selectedAbilityId !== abilityId
              && graftable
              && canSelect;

            const slotAccent = slotSelected
              ? GRAFT_SELECT_ACCENT
              : existing?.accentColor ?? PANEL_BORDER;

            return (
              <HapticPressable
                key={abilityId}
                disabled={!canSelect}
                onPress={() => handleSelectAbility(abilityId, graftable)}
                style={(state) => [
                  styles.abilitySlot,
                  dashedBorder,
                  {
                    width: '48%',
                    minHeight: slotMinHeight,
                    borderColor: slotAccent,
                    borderWidth: slotSelected ? 2 : 2,
                    paddingVertical: compact ? 6 : 10,
                    paddingHorizontal: compact ? 6 : 8,
                    backgroundColor: slotSelected
                      ? 'rgba(6, 182, 212, 0.12)'
                      : existing
                        ? `${existing.accentColor}14`
                        : 'rgba(0, 0, 0, 0.5)',
                    opacity: !graftable
                      ? 0.45
                      : dimmed
                        ? 0.4
                        : canSelect
                          ? state.pressed
                            ? 0.82
                            : 1
                          : 0.7,
                  },
                  terminalHoverStyle(readPressableHover(state), state.pressed),
                ]}
              >
                <Text
                  style={[
                    styles.abilityLabel,
                    {
                      color: slotSelected
                        ? GRAFT_SELECT_ACCENT
                        : existing?.accentColor ?? (graftable ? primaryColor : MUTED_TEXT),
                      fontSize: abilityLabelSize,
                      lineHeight: abilityLabelSize * 1.3,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {label}
                </Text>
                {!graftable ? (
                  <Text style={[styles.slotTag, { color: MUTED_TEXT, fontSize: tagSize }]}>
                    ANCHOR LOCK
                  </Text>
                ) : existing ? (
                  <Text style={[styles.slotTag, { color: existing.accentColor, fontSize: tagSize }]}>
                    {existing.name.toUpperCase()}
                  </Text>
                ) : slotSelected ? (
                  <Text style={[styles.slotTag, { color: GRAFT_SELECT_ACCENT, fontSize: tagSize }]}>
                    PATCH READY
                  </Text>
                ) : (
                  <Text style={[styles.slotTag, { color: MUTED_TEXT, fontSize: tagSize }]}>
                    UNGRAFTED
                  </Text>
                )}
              </HapticPressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    backgroundColor: PANEL_BG,
    borderWidth: 1,
    gap: 0,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 4,
  },
  headerPrefix: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerResidue: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  subheader: {
    fontFamily: 'monospace',
    letterSpacing: 0.35,
  },
  offerCol: {
    width: '100%',
  },
  offerCard: {
    borderWidth: 1,
    width: '100%',
  },
  offerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  offerTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
  },
  offerCost: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
  offerBody: {
    fontFamily: 'monospace',
    letterSpacing: 0.25,
  },
  abilitySection: {
    borderTopWidth: 1,
    width: '100%',
  },
  loadoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  abilitySlot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  abilityLabel: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  slotTag: {
    fontFamily: 'monospace',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
