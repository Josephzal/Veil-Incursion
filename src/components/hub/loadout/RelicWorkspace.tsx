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
import { OccultNeonRail } from '../veilChrome';
import {
  HUB_CARD_BORDER,
  HUB_CARD_BORDER_HOVER,
  HUB_CARD_BORDER_SELECTED,
  HUB_CARD_SURFACE,
  HUB_CARD_SURFACE_HOVER,
  HUB_SELECT_SURFACE,
} from '../../../theme/hubPanelSurfaces';

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
      <View style={styles.signalGrid}>
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
              {selected ? <OccultNeonRail style={styles.signalAccent} /> : null}
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
                  <TerminalText
                    size={11}
                    letterSpacing={0.35}
                    style={[styles.signalTitle, selected && styles.signalTitleSelected]}
                    numberOfLines={1}
                  >
                    {relic.name.toUpperCase()}
                  </TerminalText>
                  <TerminalText size={7.5} letterSpacing={0.45} style={styles.signalTags} numberOfLines={1}>
                    {formatKeepsakeRoleLine(relic).toUpperCase()}
                  </TerminalText>
                </View>
                <TerminalText
                  size={7}
                  letterSpacing={0.9}
                  style={[styles.signalStatus, { color: equipped ? TERMINAL : MUTED }]}
                >
                  {equipped ? 'EQUIPPED' : 'AVAILABLE'}
                </TerminalText>
              </HapticPressable>
            </View>
          );
        })}
      </View>
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
  feedContent: { paddingHorizontal: 0, paddingTop: 4, paddingBottom: 16 },
  empty: { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 12 },
  emptyTitle: { color: TEXT_PRIMARY, fontWeight: '700' },
  emptyBody: { marginTop: 6, color: TEXT_SECONDARY, lineHeight: 19, maxWidth: 480 },
  signalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        columnGap: 10,
        rowGap: 10,
      } as object,
      default: {
        gap: 10,
      },
    }),
  },
  signal: {
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      web: { minWidth: 0 } as object,
      default: { width: '48%', flexGrow: 1 },
    }),
  },
  signalAccent: {
    top: 14,
    bottom: 14,
  },
  signalSelect: {
    minHeight: 82,
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 16,
    paddingRight: 14,
    gap: 12,
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        cursor: 'pointer',
        outlineStyle: 'none',
        transitionProperty: 'background-color, border-color',
        transitionDuration: '120ms',
        transitionTimingFunction: 'ease-out',
      } as object,
      default: {
        flexDirection: 'row',
        alignItems: 'center',
      },
    }),
  },
  signalSelectCompact: { minHeight: 74, paddingTop: 12, paddingBottom: 12 },
  signalSelectHover: {
    backgroundColor: HUB_CARD_SURFACE_HOVER,
    borderColor: HUB_CARD_BORDER_HOVER,
  },
  signalSelectSelected: {
    backgroundColor: HUB_SELECT_SURFACE,
    borderColor: HUB_CARD_BORDER_SELECTED,
  },
  signalMain: {
    minWidth: 0,
    overflow: 'hidden',
  },
  signalTitle: { color: TEXT_PRIMARY, fontWeight: '700' },
  signalTitleSelected: { color: '#F0F2EF' },
  signalTags: { marginTop: 5, color: MUTED, fontWeight: '700' },
  signalStatus: { fontWeight: '700', flexShrink: 0 },
});
