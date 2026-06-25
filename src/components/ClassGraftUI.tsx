import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import {
  canGraftClassAbility,
  formatClassGraftOfferLine,
  getClassGraftDefinition,
} from '../data/classGraftEngine';
import { resolveClassAbilityCost } from '../data/classAbilityResolver';
import type { ClassType } from '../types/game';
import type {
  EnvoyAbilityGraftMap,
  HexShotAbilityGraftMap,
  OperativeClassGraftId,
} from '../types/classGraft';
import type { AbilityGraftMap, VeilGraftId } from '../types/veilGraft';
import type { EnvoyLoadout, HexShotAbilityId, HexShotLoadout } from '../types/operativeClass';
import type { AegisLoadout } from '../types/aegisCombat';

const TERMINAL_ACCENT = '#00ff33';

type ClassLoadout = AegisLoadout | HexShotLoadout | EnvoyLoadout;
type ClassGraftMap = AbilityGraftMap | HexShotAbilityGraftMap | EnvoyAbilityGraftMap;

interface ClassGraftUIProps {
  activeClass: ClassType;
  loadout: ClassLoadout;
  offers: readonly (OperativeClassGraftId | import('../types/veilGraft').VeilGraftId)[];
  residueBalance: number;
  abilityGrafts: ClassGraftMap;
  onApply: (abilityId: string, graftId: string) => void;
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
  onApply,
  borderColor,
  primaryColor,
  mutedColor,
}: ClassGraftUIProps): React.JSX.Element {
  const [selectedGraftId, setSelectedGraftId] = useState<string | null>(null);

  const selectedGraft = selectedGraftId
    ? getClassGraftDefinition(activeClass, selectedGraftId)
    : null;

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

  return (
    <View style={[styles.overlay, { borderColor }]}>
      <Text style={[styles.header, { color: TERMINAL_ACCENT }]}>
        {classLabel} TERMINAL // RESIDUE {residueBalance}
      </Text>
      <Text style={[styles.subheader, { color: mutedColor }]}>
        Select a graft, then an ability slot. Anchor and Ultimate abilities are locked.
      </Text>

      <View style={styles.offerCol}>
        {offers.map((graftId) => {
          const graft = getClassGraftDefinition(activeClass, graftId);
          const affordable = residueBalance >= graft.cost;
          const selected = selectedGraftId === graftId;
          return (
            <HapticPressable
              key={graftId}
              disabled={!affordable}
              onPress={() => setSelectedGraftId(graftId)}
              style={({ pressed }) => [
                styles.offerBtn,
                {
                  borderColor: selected ? graft.accentColor : borderColor,
                  backgroundColor: selected ? `${graft.accentColor}18` : '#0a0b0f',
                  opacity: affordable ? pressed ? 0.75 : 1 : 0.35,
                },
              ]}
            >
              <Text style={[styles.offerTitle, { color: selected ? graft.accentColor : primaryColor }]}>
                {graft.name.toUpperCase()} — {graft.cost} RESIDUE
              </Text>
              <Text style={[styles.offerBody, { color: mutedColor }]}>
                {formatClassGraftOfferLine(activeClass, graftId, residueBalance).split('\n')[1]}
              </Text>
            </HapticPressable>
          );
        })}
      </View>

      {selectedGraft ? (
        <Text style={[styles.hint, { color: primaryColor }]}>
          {`APPLY ${selectedGraft.name.toUpperCase()} TO:`}
        </Text>
      ) : null}

      <View style={styles.loadoutGrid}>
        {abilityRows.map(({ abilityId, label, graftId, graftable }) => {
          const existing = graftId ? getClassGraftDefinition(activeClass, graftId) : null;
          const canApply = graftable
            && selectedGraftId != null
            && residueBalance >= (selectedGraft?.cost ?? 0);
          return (
            <HapticPressable
              key={abilityId}
              disabled={!canApply}
              onPress={() => {
                if (!selectedGraftId) return;
                onApply(abilityId, selectedGraftId);
                setSelectedGraftId(null);
              }}
              style={({ pressed }) => [
                styles.abilitySlot,
                {
                  borderColor: existing?.accentColor ?? (graftable ? borderColor : '#475569'),
                  backgroundColor: existing ? `${existing.accentColor}14` : '#0a0b0f',
                  opacity: !graftable ? 0.45 : canApply ? pressed ? 0.7 : 1 : 0.85,
                },
              ]}
            >
              <Text
                style={[
                  styles.abilityLabel,
                  { color: existing?.accentColor ?? (graftable ? primaryColor : mutedColor) },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {!graftable ? (
                <Text style={[styles.lockTag, { color: mutedColor }]}>ANCHOR LOCK</Text>
              ) : existing ? (
                <Text style={[styles.graftTag, { color: existing.accentColor }]}>
                  {existing.name.toUpperCase()}
                </Text>
              ) : (
                <Text style={[styles.graftTag, { color: mutedColor }]}>UNGRAFTED</Text>
              )}
            </HapticPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    borderWidth: 1,
    padding: 12,
    gap: 10,
    backgroundColor: 'rgba(5, 6, 8, 0.94)',
  },
  header: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  subheader: {
    fontFamily: 'monospace',
    fontSize: 7,
    letterSpacing: 0.4,
    lineHeight: 11,
  },
  offerCol: { gap: 6 },
  offerBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  offerTitle: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  offerBody: {
    fontFamily: 'monospace',
    fontSize: 7,
    lineHeight: 10,
  },
  hint: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  loadoutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  abilitySlot: {
    width: '48%',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 56,
    justifyContent: 'center',
  },
  abilityLabel: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  graftTag: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.5,
  },
  lockTag: {
    fontFamily: 'monospace',
    fontSize: 6,
    letterSpacing: 0.5,
  },
});
