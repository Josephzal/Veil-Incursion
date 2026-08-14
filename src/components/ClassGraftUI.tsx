import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import RunActionRail from './runField/RunActionRail';
import { canGraftClassAbility } from '../data/classGraftEngine';
import { resolveClassAbilityCost } from '../data/classAbilityResolver';
import { evaluateGraftCompatibility } from '../data/graftSynergy/graftCompatibilityEngine';
import { getGraftSocketAccessForRunDepth } from '../data/graftSynergy/graftCapacityEngine';
import {
  getUniversalGraftCardData,
  getUniversalGraftDefinition,
} from '../data/universalGraftRegistry';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { RUN_FIELD } from '../theme/runFieldTokens';
import type { ClassType } from '../types/game';
import type {
  EnvoyAbilityGraftMap,
  HexShotAbilityGraftMap,
  OperativeClassGraftId,
} from '../types/classGraft';
import type { AbilityGraftMap, VeilGraftId } from '../types/veilGraft';
import type { EnvoyLoadout, HexShotAbilityId, HexShotLoadout } from '../types/operativeClass';
import type { AegisTechniqueLoadout } from '../types/aegisCombat';
import {
  resolveSanctuaryOfferTarget,
  type SanctuaryGraftSurfaceRow,
} from '../data/sanctuaryFlowEngine';
import { readPressableHover, terminalHoverStyle } from '../utils/terminalHoverStyle';

const WEB_NO_OUTLINE = Platform.OS === 'web'
  ? ({ outlineStyle: 'none', outlineWidth: 0 } as object)
  : null;

/** Aegis: 4+3 surface rows; Hex/Envoy: combat decks. */
type ClassLoadout = AegisTechniqueLoadout | HexShotLoadout | EnvoyLoadout | readonly string[];
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
  abilityGrafts: ClassGraftMap;
  onSelectionChange?: (selection: GraftInjectSelection) => void;
  compact?: boolean;
  borderColor: string;
  primaryColor: string;
  mutedColor: string;
  /** Optional slot rendered inside the terminal frame below ability slots. */
  footer?: React.ReactNode;
  /** When set, renders an attached CANCEL / INJECT dialog footer inside the terminal. */
  onInjectCancel?: () => void;
  onInject?: () => void;
  canInject?: boolean;
  injectDisabled?: boolean;
  cancelDisabled?: boolean;
  /** Run depth band (1–3) — must match apply validation. */
  runDepthBand?: number;
  /** Canonical equipped surface: four weapon actions + three Techniques/Flex abilities. */
  surfaceRows?: readonly SanctuaryGraftSurfaceRow[];
}

export default function ClassGraftUI({
  activeClass,
  loadout,
  offers,
  abilityGrafts,
  onSelectionChange,
  compact = false,
  borderColor: _borderColor,
  primaryColor: _primaryColor,
  mutedColor: _mutedColor,
  footer,
  onInjectCancel,
  onInject,
  canInject = false,
  injectDisabled = false,
  cancelDisabled = false,
  runDepthBand = 1,
  surfaceRows,
}: ClassGraftUIProps): React.JSX.Element {
  const { fontScale, scaleFont, scaleSpacing } = useResponsiveLayout();
  const [selectedGraftId, setSelectedGraftId] = useState<string | null>(null);
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);

  const selectedGraft = selectedGraftId
    ? getUniversalGraftDefinition(selectedGraftId)
    : null;

  const access = useMemo(() => getGraftSocketAccessForRunDepth(runDepthBand), [runDepthBand]);

  const panelPadding = scaleSpacing(compact ? 16 : 24);
  const cardPadding = scaleSpacing(compact ? 10 : 16);
  const cardGap = scaleSpacing(compact ? 8 : 12);
  const slotMinHeight = scaleSpacing(compact ? 52 : 72);
  const headerSize = scaleFont(compact ? 10 : 11);
  const subheaderSize = scaleFont(compact ? 9 : 10);
  const cardTitleSize = (compact ? 9 : 10) * fontScale * 1.1;
  const cardBodySize = scaleFont(compact ? 8 : 9);
  const abilityLabelSize = scaleFont(compact ? 9 : 10);
  const tagSize = scaleFont(compact ? 7 : 8);

  const abilityRows = useMemo(
    () => {
      if (surfaceRows?.length) {
        return surfaceRows.map((row) => {
          const graftId = (abilityGrafts as Record<string, VeilGraftId | undefined>)[row.key];
          const socketOk = canGraftClassAbility(activeClass, row.key);
          let lockReason: string | null = null;
          if (!socketOk) {
            lockReason = 'LOCKED';
          } else if (
            selectedGraft
            && row.actionId !== selectedGraft.canonicalActionId
          ) {
            lockReason = 'OTHER ACTION';
          } else if (selectedGraftId) {
            const compat = evaluateGraftCompatibility({
              classId: 'AEGIS',
              abilityId: row.key,
              graftId: selectedGraftId,
              runDepthBand,
              equippedMap: abilityGrafts as Record<string, string>,
              graftAvailable: true,
            });
            if (!compat.ok) {
              lockReason = compat.rejections[0] ?? 'INCOMPATIBLE';
            }
          }
          const label = resolveClassAbilityCost(activeClass, row.actionId).label;
          return {
            abilityId: row.key,
            label,
            group: row.group,
            graftId,
            graftable: socketOk && lockReason == null,
            lockReason,
            isFixedBasic: row.isFixedBasic,
          };
        });
      }

      const abilityIds: string[] = activeClass === 'HEX_SHOT'
        ? [...loadout, 'PHASE_SHIFT_RELOAD' as HexShotAbilityId]
        : [...loadout];
      return abilityIds.map((abilityId) => {
        const cost = resolveClassAbilityCost(activeClass, abilityId);
        const socketOk = canGraftClassAbility(activeClass, abilityId);
        let lockReason: string | null = null;
        if (!socketOk) {
          lockReason = 'LOCKED';
        } else if (selectedGraftId) {
          const compat = evaluateGraftCompatibility({
            classId: activeClass,
            abilityId,
            graftId: selectedGraftId,
            runDepthBand,
            equippedMap: abilityGrafts as Record<string, string>,
            graftAvailable: true,
          });
          if (!compat.ok) {
            lockReason = compat.rejections[0] ?? 'INCOMPATIBLE';
          }
        }
        return {
          abilityId,
          label: cost.label,
          group: 'TECHNIQUE' as const,
          graftId: (abilityGrafts as Record<string, OperativeClassGraftId | VeilGraftId | undefined>)[abilityId],
          graftable: socketOk && lockReason == null,
          lockReason,
          isFixedBasic: false,
        };
      });
    },
    [
      abilityGrafts,
      activeClass,
      surfaceRows,
      runDepthBand,
      loadout,
      selectedGraftId,
      selectedGraft,
    ],
  );

  const weaponRows = abilityRows.filter((r) => r.group === 'WEAPON_ACTION');
  const techniqueRows = abilityRows.filter((r) => r.group !== 'WEAPON_ACTION');

  useEffect(() => {
    let injectOk = selectedGraftId != null
      && selectedAbilityId != null
      && selectedGraft != null
      && canGraftClassAbility(activeClass, selectedAbilityId);
    if (injectOk && selectedGraftId && selectedAbilityId) {
      const compat = evaluateGraftCompatibility({
        classId: activeClass,
        abilityId: selectedAbilityId,
        graftId: selectedGraftId,
        runDepthBand,
        equippedMap: abilityGrafts as Record<string, string>,
        graftAvailable: true,
      });
      injectOk = compat.ok;
    }

    onSelectionChange?.({
      graftId: selectedGraftId,
      abilityId: selectedAbilityId,
      canInject: injectOk,
    });
  }, [
    abilityGrafts,
    activeClass,
    runDepthBand,
    onSelectionChange,
    selectedAbilityId,
    selectedGraft,
    selectedGraftId,
  ]);

  const handleSelectGraft = (graftId: string) => {
    const card = getUniversalGraftCardData(activeClass, graftId);
    const matchingRow = surfaceRows
      ? resolveSanctuaryOfferTarget(activeClass, surfaceRows, graftId)
      : null;
    setSelectedGraftId(graftId);
    setSelectedAbilityId(matchingRow?.key ?? card?.canonicalActionId ?? null);
  };

  const handleSelectAbility = (abilityId: string, graftable: boolean) => {
    if (!selectedGraftId || !graftable) return;
    setSelectedAbilityId(abilityId);
  };

  const dashedBorder = Platform.OS === 'web'
    ? ({ borderStyle: 'dashed' as const })
    : ({ borderStyle: 'dashed' as const });

  const showInjectFooter = onInjectCancel != null && onInject != null;
  const resolvedFooter = footer ?? (showInjectFooter ? (
    <RunActionRail
      mode="dialog"
      primaryLabel="APPLY UPGRADE"
      onPrimary={onInject}
      primaryDisabled={!canInject || injectDisabled}
      secondaryLabel="CANCEL"
      onSecondary={onInjectCancel}
      secondaryDisabled={cancelDisabled}
    />
  ) : null);

  const renderSlot = ({
    abilityId,
    label,
    graftId,
    graftable,
    lockReason,
  }: (typeof abilityRows)[number]) => {
    const existing = graftId ? getUniversalGraftDefinition(graftId) : null;
    const slotSelected = selectedAbilityId === abilityId;
    const canSelect = graftable
      && selectedGraftId != null
      && selectedGraft != null;
    const dimmed = selectedAbilityId != null
      && selectedAbilityId !== abilityId
      && graftable
      && canSelect;

    const slotAccent = slotSelected
      ? RUN_FIELD.mintBorder
      : existing?.accentColor ?? RUN_FIELD.line;

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
            borderWidth: slotSelected ? 2 : 1,
            paddingVertical: compact ? 6 : 10,
            paddingHorizontal: compact ? 6 : 8,
            backgroundColor: slotSelected
              ? RUN_FIELD.mintSoft
              : existing
                ? `${existing.accentColor}14`
                : RUN_FIELD.panelWash,
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
          WEB_NO_OUTLINE,
        ]}
      >
        <Text
          style={[
            styles.abilityLabel,
            {
              color: slotSelected
                ? RUN_FIELD.mint
                : existing?.accentColor ?? (graftable ? RUN_FIELD.text : RUN_FIELD.textDim),
              fontSize: abilityLabelSize,
              lineHeight: abilityLabelSize * 1.3,
            },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {!graftable ? (
          <Text style={[styles.slotTag, { color: RUN_FIELD.textDim, fontSize: tagSize }]}>
            {lockReason ?? 'LOCKED'}
          </Text>
        ) : existing ? (
          <Text style={[styles.slotTag, { color: existing.accentColor, fontSize: tagSize }]}>
            {existing.name}
          </Text>
        ) : slotSelected ? (
          <Text style={[styles.slotTag, { color: RUN_FIELD.mint, fontSize: tagSize }]}>
            SELECTED
          </Text>
        ) : (
          <Text style={[styles.slotTag, { color: RUN_FIELD.textDim, fontSize: tagSize }]}>
            NO UPGRADE
          </Text>
        )}
      </HapticPressable>
    );
  };

  return (
    <View
      style={[
        styles.panel,
        {
          padding: panelPadding,
          marginTop: compact ? 0 : scaleSpacing(24),
          borderColor: RUN_FIELD.line,
        },
      ]}
    >
      <Text
        style={[
          styles.headerPrefix,
          {
            color: RUN_FIELD.mint,
            fontSize: headerSize,
            lineHeight: headerSize * 1.3,
          },
        ]}
      >
        ACTION UPGRADES
      </Text>

      <Text
        style={[
          styles.subheader,
          {
            color: RUN_FIELD.textSecondary,
            fontSize: subheaderSize,
            lineHeight: subheaderSize * 1.45,
            marginTop: scaleSpacing(compact ? 4 : 8),
          },
        ]}
      >
        Select one action upgrade. Its matching equipped action is selected automatically.
      </Text>

      <View style={[styles.offerCol, { gap: cardGap, marginTop: scaleSpacing(compact ? 10 : 20) }]}>
        {offers.map((graftId) => {
          const card = getUniversalGraftCardData(activeClass, graftId);
          if (!card) return null;
          const selected = selectedGraftId === graftId;
          const dimmed = selectedGraftId != null && !selected;

          return (
            <HapticPressable
              key={graftId}
              onPress={() => handleSelectGraft(graftId)}
              style={(state) => [
                styles.offerCard,
                {
                  padding: cardPadding,
                  borderColor: selected ? RUN_FIELD.mintBorder : RUN_FIELD.line,
                  backgroundColor: selected ? RUN_FIELD.mintSoft : RUN_FIELD.panelLight,
                  opacity: dimmed ? 0.4 : state.pressed ? 0.88 : 1,
                  transform: selected ? [{ scale: 1.02 }] : undefined,
                },
                terminalHoverStyle(readPressableHover(state), state.pressed),
                WEB_NO_OUTLINE,
              ]}
            >
              <Text
                style={[
                  styles.offerTitle,
                  {
                    color: selected ? RUN_FIELD.mint : RUN_FIELD.text,
                    fontSize: cardTitleSize,
                    lineHeight: cardTitleSize * 1.25,
                  },
                ]}
              >
                {card.actionName}
              </Text>
              <Text
                style={[
                  styles.offerBody,
                  {
                    color: RUN_FIELD.textSecondary,
                    fontSize: cardBodySize,
                    lineHeight: cardBodySize * 1.4,
                    marginTop: scaleSpacing(compact ? 4 : 6),
                  },
                ]}
              >
                {`Current: ${card.currentValue}  →  Upgraded: ${card.upgradedValue}`}
              </Text>
              <Text
                style={[
                  styles.offerBody,
                  {
                    color: RUN_FIELD.textSecondary,
                    fontSize: cardBodySize,
                    lineHeight: cardBodySize * 1.4,
                    marginTop: scaleSpacing(compact ? 4 : 6),
                  },
                ]}
                numberOfLines={compact ? 2 : 3}
              >
                {card.improvedProperty}
              </Text>
            </HapticPressable>
          );
        })}
      </View>

      <View
        style={[
          styles.abilitySection,
          {
            borderTopColor: RUN_FIELD.line,
            paddingTop: scaleSpacing(compact ? 12 : 24),
            marginTop: scaleSpacing(compact ? 8 : 12),
          },
        ]}
      >
        {weaponRows.length > 0 ? (
          <>
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: RUN_FIELD.textSecondary,
                  fontSize: tagSize,
                  marginBottom: scaleSpacing(6),
                },
              ]}
            >
              WEAPON ACTIONS
            </Text>
            <View style={[styles.loadoutGrid, { gap: cardGap }]}>
              {weaponRows.map(renderSlot)}
            </View>
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: RUN_FIELD.textSecondary,
                  fontSize: tagSize,
                  marginTop: scaleSpacing(12),
                  marginBottom: scaleSpacing(6),
                },
              ]}
            >
              TECHNIQUES
            </Text>
            <View style={[styles.loadoutGrid, { gap: cardGap }]}>
              {techniqueRows.map(renderSlot)}
            </View>
          </>
        ) : (
          <View style={[styles.loadoutGrid, { gap: cardGap }]}>
            {abilityRows.map(renderSlot)}
          </View>
        )}
      </View>

      {resolvedFooter ? (
        <View
          style={[
            styles.footerSection,
            {
              borderTopColor: RUN_FIELD.line,
              marginTop: scaleSpacing(compact ? 10 : 16),
              paddingTop: scaleSpacing(compact ? 4 : 8),
            },
          ]}
        >
          {resolvedFooter}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    backgroundColor: RUN_FIELD.panelStrong,
    borderWidth: 1,
    gap: 0,
    flex: 1,
    minHeight: 0,
  },
  footerSection: {
    width: '100%',
    borderTopWidth: 1,
    flexShrink: 0,
  },
  headerPrefix: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
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
  offerTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.5,
    flex: 1,
  },
  offerBody: {
    fontFamily: 'monospace',
    letterSpacing: 0.25,
  },
  abilitySection: {
    borderTopWidth: 1,
    width: '100%',
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
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
