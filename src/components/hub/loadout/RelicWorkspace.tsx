import React, { useEffect, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import { usePlayerAccount } from '../../../context/PlayerAccountContext';
import {
  EXPEDITION_REQUISITION_REGISTRY,
} from '../../../data/expeditionRequisitionRegistry';
import {
  ENABLED_REQUISITION_IDS,
  type RequisitionId,
} from '../../../types/expeditionRequisition';
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
  selectedId: RequisitionId | null;
  onSelect: (id: RequisitionId | null) => void;
  compact?: boolean;
}

export default function RelicWorkspace({
  selectedId,
  onSelect,
  compact,
}: RelicWorkspaceProps): React.JSX.Element {
  const { account } = usePlayerAccount();
  const requisitions = useMemo(
    () =>
      ENABLED_REQUISITION_IDS
        .filter((id) => account.unlockedRequisitionIds.includes(id))
        .map((id) => EXPEDITION_REQUISITION_REGISTRY[id]),
    [account.unlockedRequisitionIds],
  );

  useEffect(() => {
    if (selectedId && requisitions.some((requisition) => requisition.id === selectedId)) return;
    const equipped = requisitions.find(
      (requisition) => requisition.id === account.equippedRequisitionId,
    );
    onSelect(equipped?.id ?? requisitions[0]?.id ?? null);
  }, [account.equippedRequisitionId, onSelect, requisitions, selectedId]);

  if (requisitions.length === 0) {
    return (
      <View style={styles.empty}>
        <TerminalText size={9} letterSpacing={0.6} style={styles.emptyTitle}>
          NO EXPEDITION REQUISITIONS AVAILABLE
        </TerminalText>
        <TerminalText size={8.5} style={styles.emptyBody}>
          No enabled Requisition is available for deployment.
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
        {requisitions.map((requisition) => {
          const selected = selectedId === requisition.id;
          const equipped = account.equippedRequisitionId === requisition.id;
          return (
            <View
              key={requisition.id}
              style={styles.signal}
              {...(Platform.OS === 'web'
                ? ({ 'data-selected': selected ? 'true' : 'false' } as object)
                : null)}
            >
              {selected ? <OccultNeonRail style={styles.signalAccent} /> : null}
              <HapticPressable
                onPress={() => onSelect(requisition.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Inspect Requisition ${requisition.name}`}
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
                    {requisition.name.toUpperCase()}
                  </TerminalText>
                  <TerminalText size={7.5} letterSpacing={0.45} style={styles.signalTags} numberOfLines={1}>
                    {`${requisition.family} // ${requisition.subtype}`.toUpperCase()}
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
  selectedId: RequisitionId | null,
  _selectedSector: ReturnType<typeof useWorldState>['selectedSector'],
  selectedContract: ReturnType<typeof useWorldState>['persisted']['contractBoard']['selectedContract'],
) {
  if (!selectedId) return null;
  const def = EXPEDITION_REQUISITION_REGISTRY[selectedId];
  if (!def) return null;
  const equipped = account.equippedRequisitionId === selectedId;
  const configured =
    selectedId === 'signal_compass'
      ? account.requisitionDeployment.attunement != null
      : selectedId === 'ashen_cartograph'
        ? account.requisitionDeployment.routeDoctrine != null
        : true;
  const deploymentSummary =
    selectedId === 'signal_compass'
      ? account.requisitionDeployment.attunement
      : selectedId === 'ashen_cartograph'
        ? account.requisitionDeployment.routeDoctrine
        : 'No deployment configuration';
  const warnings = [
    ...(def.deploymentWarning ? [def.deploymentWarning] : []),
    ...(selectedId === 'contract_seal' && !selectedContract
      ? ['Warning: No sponsor Contract is configured.']
      : []),
  ];
  const currentChoice = def.deploymentChoice
    ? def.deploymentChoice.kind === 'attunement'
      ? account.requisitionDeployment.attunement
      : account.requisitionDeployment.routeDoctrine
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
  // Top spacing owned by Loadout catalogHeader (matches Black Market section rhythm).
  feedContent: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 16 },
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
