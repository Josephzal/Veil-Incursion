import React, { useEffect, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import HapticPressable from '../../HapticPressable';
import TerminalText from '../../TerminalText';
import { usePlayerAccount } from '../../../context/PlayerAccountContext';
import { listWeaponFamiliesForClass } from '../../../data/weaponRegistry';
import {
  canUnlockWeaponFamily,
  canUpgradeWeaponTier,
  getEquippedWeaponForClass,
  getWeaponTier,
  resolveWeaponState,
} from '../../../data/weaponProgressionEngine';
import { countMissingCost, formatWeaponCostLine } from '../../../data/weaponResourceEngine';
import { formatWeaponStatLines } from '../../../data/weaponCombatEngine';
import { getResourceDisplayName } from '../../../data/resourceRegistry';
import { getStashCount } from '../../../data/resourceStashEngine';
import { getWeaponPlayerFacingSummary } from '../../../data/weaponPlayerFacing/weaponPlayerFacingEngine';
import type { WeaponFamilyId } from '../../../types/weapon';
import { MISSING, MUTED, TERMINAL, TEXT_PRIMARY, TEXT_SECONDARY } from './loadoutTerminalUi';
import { OccultNeonRail } from '../veilChrome';
import {
  HUB_CARD_BORDER,
  HUB_CARD_BORDER_HOVER,
  HUB_CARD_BORDER_SELECTED,
  HUB_CARD_SURFACE,
  HUB_CARD_SURFACE_HOVER,
  HUB_SELECT_SURFACE,
} from '../../../theme/hubPanelSurfaces';

export type ChassisStatus =
  | 'EQUIPPED'
  | 'AVAILABLE'
  | 'BLUEPRINT LOCKED'
  | 'MISSING MATERIALS'
  | 'UPGRADE AVAILABLE';

export interface ChassisRowModel {
  familyId: WeaponFamilyId;
  name: string;
  role: string;
  loopCue: string;
  selectionSummary: string;
  description: string;
  tier: number;
  unlocked: boolean;
  equipped: boolean;
  status: ChassisStatus;
  nextSummary: string | null;
  statusColor: string;
  isStarter: boolean;
}

function resolveStatus(args: {
  unlocked: boolean;
  equipped: boolean;
  canUnlock: boolean;
  canUpgrade: boolean;
  lockedAffordable: boolean;
}): ChassisStatus {
  if (args.equipped) return 'EQUIPPED';
  if (!args.unlocked) {
    return args.lockedAffordable ? 'BLUEPRINT LOCKED' : 'MISSING MATERIALS';
  }
  if (args.canUpgrade) return 'UPGRADE AVAILABLE';
  return 'AVAILABLE';
}

export function buildChassisRows(account: ReturnType<typeof usePlayerAccount>['account']): ChassisRowModel[] {
  const progression = {
    weaponUnlocks: account.weaponUnlocks,
    weaponTiers: account.weaponTiers,
    equippedWeaponByClass: account.equippedWeaponByClass,
  };
  const equippedId = getEquippedWeaponForClass(progression, account.activeClass);
  return listWeaponFamiliesForClass(account.activeClass).map((def) => {
    const unlocked = account.weaponUnlocks.includes(def.id);
    const tier = getWeaponTier(progression, def.id);
    const tierState = resolveWeaponState(def.id, tier);
    const equipped = equippedId === def.id;
    const canUnlock = !unlocked && canUnlockWeaponFamily(account.resourceStash, progression, def.id);
    const canUpgrade = unlocked && tier < 3 && canUpgradeWeaponTier(account.resourceStash, progression, def.id);
    const unlockMissing = !unlocked
      ? countMissingCost(account.resourceStash, def.unlockRequirement)
      : { missingTotal: 0, parts: [] as string[] };
    const status = resolveStatus({
      unlocked,
      equipped,
      canUnlock,
      canUpgrade,
      lockedAffordable: unlockMissing.missingTotal === 0,
    });
    const nextTier = tier === 1 ? def.tiers[1] : tier === 2 ? def.tiers[2] : null;
    const nextSummary = !unlocked
      ? 'UNLOCK REQUIREMENTS IN DOSSIER'
      : nextTier
        ? `NEXT: ${nextTier.effectSummary.toUpperCase()}`
        : 'MAX TIER';
    const statusColor = status === 'MISSING MATERIALS'
      ? MISSING
      : status === 'UPGRADE AVAILABLE' || status === 'EQUIPPED'
        ? TERMINAL
        : MUTED;
    const facing = getWeaponPlayerFacingSummary(def.id);
    return {
      familyId: def.id,
      name: tierState.displayName,
      role: facing.roleLabel,
      loopCue: facing.loopCueTag,
      selectionSummary: facing.selectionSummary,
      description: facing.selectionSummary,
      tier,
      unlocked,
      equipped,
      status,
      nextSummary,
      statusColor,
      isStarter: facing.isStarter,
    };
  });
}

interface ChassisWorkspaceProps {
  selectedId: WeaponFamilyId | null;
  onSelect: (familyId: WeaponFamilyId, opts?: { silent?: boolean }) => void;
  compact?: boolean;
}

export default function ChassisWorkspace({
  selectedId,
  onSelect,
  compact,
}: ChassisWorkspaceProps): React.JSX.Element {
  const { account } = usePlayerAccount();
  const rows = useMemo(() => buildChassisRows(account), [account]);

  useEffect(() => {
    if (selectedId && rows.some((row) => row.familyId === selectedId)) return;
    const equipped = rows.find((row) => row.equipped) ?? rows[0];
    if (equipped) onSelect(equipped.familyId, { silent: true });
  }, [onSelect, rows, selectedId]);

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
      {rows.map((row) => {
        const selected = selectedId === row.familyId;
        return (
          <View
            key={row.familyId}
            style={styles.signal}
            {...(Platform.OS === 'web'
              ? ({ 'data-selected': selected ? 'true' : 'false' } as object)
              : null)}
          >
            {selected ? <OccultNeonRail style={styles.signalAccent} /> : null}
            <HapticPressable
              onPress={() => onSelect(row.familyId)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Inspect ${row.name}`}
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
                  {row.name.toUpperCase()}
                </TerminalText>
                <TerminalText size={8} letterSpacing={0.55} style={styles.signalRoleInline} numberOfLines={1}>
                  {row.role.toUpperCase()}
                </TerminalText>
                <TerminalText size={8.5} style={styles.signalBody} numberOfLines={2}>
                  {row.selectionSummary}
                </TerminalText>
                <View style={styles.loopCueRow}>
                  <TerminalText size={7} letterSpacing={0.8} style={styles.loopCue} numberOfLines={1}>
                    {row.loopCue}
                  </TerminalText>
                  {row.isStarter ? (
                    <TerminalText size={7} letterSpacing={0.6} style={styles.starterCue} numberOfLines={1}>
                      COMPLETE BASELINE
                    </TerminalText>
                  ) : null}
                </View>
              </View>
              <View style={styles.signalClassCol}>
                <TerminalText size={8} letterSpacing={0.7} style={styles.signalTier}>
                  {`TIER ${['I', 'II', 'III'][row.tier - 1] ?? row.tier}`}
                </TerminalText>
                <TerminalText size={7.5} letterSpacing={0.5} style={styles.signalRole} numberOfLines={2}>
                  {row.unlocked ? 'LINK READY' : 'LOCKED'}
                </TerminalText>
              </View>
              <View style={styles.signalStatusCol}>
                <TerminalText size={7} letterSpacing={0.9} style={{ color: row.statusColor, fontWeight: '700' }}>
                  {row.status}
                </TerminalText>
              </View>
            </HapticPressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function resolveChassisDossier(account: ReturnType<typeof usePlayerAccount>['account'], familyId: WeaponFamilyId | null) {
  if (!familyId) return null;
  const progression = {
    weaponUnlocks: account.weaponUnlocks,
    weaponTiers: account.weaponTiers,
    equippedWeaponByClass: account.equippedWeaponByClass,
  };
  const def = listWeaponFamiliesForClass(account.activeClass).find((entry) => entry.id === familyId);
  if (!def) return null;
  const facing = getWeaponPlayerFacingSummary(def.id);
  const unlocked = account.weaponUnlocks.includes(def.id);
  const tier = getWeaponTier(progression, def.id);
  const tierState = resolveWeaponState(def.id, tier);
  const equipped = getEquippedWeaponForClass(progression, account.activeClass) === def.id;
  const canUnlock = !unlocked && canUnlockWeaponFamily(account.resourceStash, progression, def.id);
  const canUpgrade = unlocked && tier < 3 && canUpgradeWeaponTier(account.resourceStash, progression, def.id);
  const nextTier = tier === 1 ? def.tiers[1] : tier === 2 ? def.tiers[2] : null;
  const upgradeCost = unlocked && tier < 3 ? (def.tiers[tier - 1]?.upgradeCost ?? []) : [];
  const unlockCost = def.unlockRequirement;
  const activeCost = !unlocked ? unlockCost : upgradeCost;
  const costLines = activeCost.map((cost) => ({
    label: getResourceDisplayName(cost.resourceId),
    owned: getStashCount(account.resourceStash, cost.resourceId),
    need: cost.quantity,
  }));
  const missing = countMissingCost(account.resourceStash, activeCost);
  return {
    def,
    facing,
    tierState,
    tier,
    unlocked,
    equipped,
    canUnlock,
    canUpgrade,
    nextTier,
    statLines: formatWeaponStatLines(tierState),
    costLines,
    missing,
    unlockCostLine: formatWeaponCostLine(unlockCost),
    upgradeCostLine: formatWeaponCostLine(upgradeCost),
  };
}

const styles = StyleSheet.create({
  feed: { flex: 1, minHeight: 0 },
  // Top spacing owned by Loadout catalogHeader (matches Black Market section rhythm).
  feedContent: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 16 },
  signal: {
    position: 'relative',
    marginBottom: 10,
    overflow: 'hidden',
  },
  signalAccent: {
    top: 14,
    bottom: 14,
  },
  signalSelect: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    minHeight: 112,
    paddingTop: 16,
    paddingBottom: 16,
    paddingLeft: 18,
    paddingRight: 18,
    gap: 28,
    backgroundColor: HUB_CARD_SURFACE,
    borderWidth: 1,
    borderColor: HUB_CARD_BORDER,
    ...Platform.select({
      web: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(210px, 260px) minmax(140px, 170px)',
        alignItems: 'start',
        cursor: 'pointer',
        outlineStyle: 'none',
        transitionProperty: 'background-color, border-color',
        transitionDuration: '120ms',
        transitionTimingFunction: 'ease-out',
      } as object,
      default: {
        flexDirection: 'row',
        alignItems: 'flex-start',
      },
    }),
  },
  signalSelectCompact: {
    minHeight: 108,
    paddingTop: 14,
    paddingBottom: 14,
  },
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
    maxWidth: 560,
  },
  signalTitle: { color: TEXT_PRIMARY, fontWeight: '700' },
  signalTitleSelected: { color: '#F0F2EF' },
  signalRoleInline: { marginTop: 4, color: MUTED, fontWeight: '700' },
  signalBody: { marginTop: 5, color: TEXT_SECONDARY, lineHeight: 18 },
  loopCueRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  loopCue: {
    color: MUTED,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: 'rgba(105, 200, 173, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  starterCue: { color: MUTED, fontWeight: '600' },
  signalNext: { marginTop: 6, color: MUTED, fontWeight: '700' },
  signalClassCol: {
    minWidth: 0,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flexShrink: 0,
    gap: 4,
    paddingTop: 2,
  },
  signalStatusCol: {
    minWidth: 0,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    flexShrink: 0,
    paddingTop: 2,
  },
  signalTier: { color: TEXT_PRIMARY, fontWeight: '700', fontVariant: ['tabular-nums'] },
  signalRole: { color: MUTED, fontWeight: '700', lineHeight: 14 },
});
