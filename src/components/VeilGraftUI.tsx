/**
 * @deprecated Phase D — dead four-slot Aegis graft UI.
 * Live Sanctuary surface is `ClassGraftUI` (4 weapon actions + 3 techniques).
 * Do not wire this component; kept only as quarantined legacy.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import HapticPressable from './HapticPressable';
import { getAbilityDefinition } from '../data/aegisAbilities';
import { canGraftAbility, formatGraftOfferLine } from '../data/veilGraftEngine';
import { getVeilGraftDefinition } from '../data/veilGraftDatabase';
import type { AegisAbilityId, AegisLoadout } from '../types/aegisCombat';
import type { AbilityGraftMap, VeilGraftId } from '../types/veilGraft';

const TERMINAL_ACCENT = '#00ff33';

interface VeilGraftUIProps {
  loadout: AegisLoadout;
  offers: readonly VeilGraftId[];
  residueBalance: number;
  abilityGrafts: AbilityGraftMap;
  onApply: (abilityId: AegisAbilityId, graftId: VeilGraftId) => void;
  borderColor: string;
  primaryColor: string;
  mutedColor: string;
}

export default function VeilGraftUI({
  loadout,
  offers,
  residueBalance,
  abilityGrafts,
  onApply,
  borderColor,
  primaryColor,
  mutedColor,
}: VeilGraftUIProps): React.JSX.Element {
  const [selectedGraftId, setSelectedGraftId] = useState<VeilGraftId | null>(null);

  const selectedGraft = selectedGraftId ? getVeilGraftDefinition(selectedGraftId) : null;

  const abilityRows = useMemo(
    () => loadout.map((abilityId) => ({
      abilityId,
      def: getAbilityDefinition(abilityId),
      graftId: abilityGrafts[abilityId],
      graftable: canGraftAbility(abilityId),
    })),
    [abilityGrafts, loadout],
  );

  return (
    <View style={[styles.overlay, { borderColor }]}>
      <Text style={[styles.header, { color: TERMINAL_ACCENT }]}>
        VEIL-GRAFT TERMINAL (LEGACY — USE ClassGraftUI)
      </Text>
      <Text style={[styles.subheader, { color: mutedColor }]}>
        Quarantined four-slot UI. Live Sanctuary uses ClassGraftUI (no Residue charge).
      </Text>

      <View style={styles.offerCol}>
        {offers.map((graftId) => {
          const graft = getVeilGraftDefinition(graftId);
          const selected = selectedGraftId === graftId;
          return (
            <HapticPressable
              key={graftId}
              onPress={() => setSelectedGraftId(graftId)}
              style={({ pressed }) => [
                styles.offerBtn,
                {
                  borderColor: selected ? graft.accentColor : borderColor,
                  backgroundColor: selected ? `${graft.accentColor}18` : '#0a0b0f',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.offerTitle, { color: selected ? graft.accentColor : primaryColor }]}>
                {graft.name.toUpperCase()}
              </Text>
              <Text style={[styles.offerBody, { color: mutedColor }]}>
                {formatGraftOfferLine(graftId).split('\n')[1]}
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
        {abilityRows.map(({ abilityId, def, graftId, graftable }) => {
          const existing = graftId ? getVeilGraftDefinition(graftId) : null;
          const canApply = graftable && selectedGraftId != null;
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
                {def.label}
              </Text>
              {!graftable ? (
                <Text style={[styles.lockTag, { color: mutedColor }]}>ULTIMATE LOCK</Text>
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
