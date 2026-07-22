import React, { useEffect, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import { usePlayerAccount } from '../../../context/PlayerAccountContext';
import {
  EXPEDITION_KEEPSAKE_REGISTRY,
  listKeepsakeDefinitions,
} from '../../../data/expeditionKeepsakeRegistry';
import {
  formatKeepsakeDeploymentOptionLabel,
  formatKeepsakeRoleLine,
  getKeepsakeDeploymentChoiceValue,
  isKeepsakeDeploymentConfigured,
  resolveKeepsakeDeploymentWarnings,
} from '../../../data/expeditionKeepsakeDeploymentEngine';
import type { KeepsakeId } from '../../../types/expeditionKeepsake';
import { useWorldState } from '../../../context/WorldStateContext';
import { MUTED, TERMINAL, TEXT_PRIMARY, TEXT_SECONDARY } from './loadoutTerminalUi';

interface RelicWorkspaceProps {
  selectedId: KeepsakeId | null;
  onSelect: (id: KeepsakeId | null) => void;
  compact?: boolean;
}

export default function RelicWorkspace({
  selectedId,
  onSelect,
  compact,
}: RelicWorkspaceProps): React.JSX.Element {
  const { account } = usePlayerAccount();
  const relics = useMemo(
    () => listKeepsakeDefinitions(account.unlockedKeepsakeIds),
    [account.unlockedKeepsakeIds],
  );

  useEffect(() => {
    if (selectedId && relics.some((relic) => relic.id === selectedId)) return;
    const equipped = relics.find((relic) => relic.id === account.equippedKeepsakeId);
    onSelect(equipped?.id ?? relics[0]?.id ?? null);
  }, [account.equippedKeepsakeId, onSelect, relics, selectedId]);

  if (relics.length === 0) {
    return (
      <View style={styles.empty}>
        <TerminalText size={9} letterSpacing={0.6} style={styles.emptyTitle}>
          NO EXPEDITION RELICS AVAILABLE
        </TerminalText>
        <TerminalText size={8.5} style={styles.emptyBody}>
          Unlock relics through progression before arming one for descent.
        </TerminalText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.feed}
      contentContainerStyle={styles.feedContent}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
      {...(Platform.OS === 'web'
        ? ({
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(105, 200, 173, 0.24) transparent',
          } as object)
        : null)}
    >
      {relics.map((relic) => {
        const selected = selectedId === relic.id;
        const equipped = account.equippedKeepsakeId === relic.id;
        return (
          <View
            key={relic.id}
            style={styles.signal}
            {...(Platform.OS === 'web'
              ? ({ 'data-selected': selected ? 'true' : 'false' } as object)
              : null)}
          >
            {selected ? <View style={styles.signalAccent} /> : null}
            <HapticPressable
              onPress={() => onSelect(relic.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Inspect ${relic.name}`}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ([
                styles.signalSelect,
                compact && styles.signalSelectCompact,
                selected && styles.signalSelectSelected,
                ((hovered || pressed) && !selected) ? styles.signalSelectHover : null,
              ])}
            >
              <View style={styles.signalMain}>
                <View style={styles.signalTopline}>
                  <TerminalText size={7} letterSpacing={0.9} style={styles.signalMeta}>
                    EXPEDITION RELIC
                  </TerminalText>
                  <TerminalText
                    size={7}
                    letterSpacing={0.9}
                    style={{ color: equipped ? TERMINAL : MUTED, fontWeight: '700' }}
                  >
                    {equipped ? 'EQUIPPED' : 'AVAILABLE'}
                  </TerminalText>
                </View>
                <TerminalText size={11} letterSpacing={0.35} style={styles.signalTitle} numberOfLines={1}>
                  {relic.name.toUpperCase()}
                </TerminalText>
                <TerminalText size={7.5} letterSpacing={0.45} style={styles.signalTags} numberOfLines={1}>
                  {formatKeepsakeRoleLine(relic).toUpperCase()}
                </TerminalText>
                <TerminalText size={8.5} style={styles.signalBody} numberOfLines={1}>
                  {relic.runStyle}
                </TerminalText>
              </View>
            </HapticPressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function resolveRelicDossier(
  account: ReturnType<typeof usePlayerAccount>['account'],
  selectedId: KeepsakeId | null,
  selectedSector: ReturnType<typeof useWorldState>['selectedSector'],
  selectedContract: ReturnType<typeof useWorldState>['persisted']['contractBoard']['selectedContract'],
) {
  if (!selectedId) return null;
  const def = EXPEDITION_KEEPSAKE_REGISTRY[selectedId];
  if (!def) return null;
  const equipped = account.equippedKeepsakeId === selectedId;
  const deploymentSummary = formatKeepsakeDeploymentOptionLabel(selectedId, account.keepsakeDeployment);
  const configured = isKeepsakeDeploymentConfigured(selectedId, account.keepsakeDeployment);
  const warnings = resolveKeepsakeDeploymentWarnings(selectedId, selectedSector, selectedContract);
  const currentChoice = def.deploymentChoice
    ? getKeepsakeDeploymentChoiceValue(account.keepsakeDeployment, def.deploymentChoice)
    : null;
  return {
    def,
    equipped,
    deploymentSummary,
    configured,
    warnings,
    currentChoice,
  };
}

const styles = StyleSheet.create({
  feed: { flex: 1, minHeight: 0 },
  feedContent: { paddingBottom: 16 },
  empty: { paddingHorizontal: 28, paddingVertical: 28 },
  emptyTitle: { color: TEXT_PRIMARY, fontWeight: '700' },
  emptyBody: { marginTop: 8, color: TEXT_SECONDARY, lineHeight: 19 },
  signal: {
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(137, 170, 163, 0.1)',
  },
  signalAccent: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 0,
    width: 2,
    backgroundColor: TERMINAL,
    zIndex: 1,
  },
  signalSelect: {
    minHeight: 94,
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 28,
    paddingRight: 24,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  signalSelectCompact: { minHeight: 82, paddingTop: 11, paddingBottom: 11 },
  signalSelectHover: { backgroundColor: 'rgba(105, 200, 173, 0.035)' },
  signalSelectSelected: { backgroundColor: 'rgba(105, 200, 173, 0.06)' },
  signalMain: { minWidth: 0 },
  signalTopline: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  signalMeta: { color: MUTED, fontWeight: '700' },
  signalTitle: { marginTop: 5, color: TEXT_PRIMARY, fontWeight: '700' },
  signalTags: { marginTop: 5, color: MUTED, fontWeight: '700' },
  signalBody: { marginTop: 5, color: TEXT_SECONDARY, lineHeight: 18 },
});
