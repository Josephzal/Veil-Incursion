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
import type { WeaponFamilyId } from '../../../types/weapon';
import { MISSING, MUTED, TERMINAL, TEXT_PRIMARY, TEXT_SECONDARY } from './loadoutTerminalUi';

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
  description: string;
  tier: number;
  unlocked: boolean;
  equipped: boolean;
  status: ChassisStatus;
  nextSummary: string | null;
  statusColor: string;
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
    return {
      familyId: def.id,
      name: tierState.displayName,
      role: def.role,
      description: def.description,
      tier,
      unlocked,
      equipped,
      status,
      nextSummary,
      statusColor,
    };
  });
}

interface ChassisWorkspaceProps {
  selectedId: WeaponFamilyId | null;
  onSelect: (familyId: WeaponFamilyId) => void;
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
    if (equipped) onSelect(equipped.familyId);
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
            {selected ? <View style={styles.signalAccent} /> : null}
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
                <View style={styles.signalTopline}>
                  <TerminalText size={7} letterSpacing={0.9} style={styles.signalMeta}>
                    WEAPON CHASSIS
                  </TerminalText>
                  <TerminalText size={7} letterSpacing={0.9} style={{ color: row.statusColor, fontWeight: '700' }}>
                    {row.status}
                  </TerminalText>
                </View>
                <TerminalText size={11} letterSpacing={0.35} style={styles.signalTitle} numberOfLines={1}>
                  {row.name.toUpperCase()}
                </TerminalText>
                <TerminalText size={8.5} style={styles.signalBody} numberOfLines={1}>
                  {row.description}
                </TerminalText>
                {row.nextSummary ? (
                  <TerminalText size={7.5} letterSpacing={0.4} style={styles.signalNext} numberOfLines={1}>
                    {row.nextSummary}
                  </TerminalText>
                ) : null}
              </View>
              <View style={styles.signalAside}>
                <TerminalText size={7} letterSpacing={0.9} style={styles.signalMeta}>
                  {`TIER ${['I', 'II', 'III'][row.tier - 1] ?? row.tier}`}
                </TerminalText>
                <TerminalText size={7.5} letterSpacing={0.5} style={styles.signalRole} numberOfLines={2}>
                  {row.role.toUpperCase()}
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
  feedContent: { paddingBottom: 16 },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    minHeight: 94,
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 28,
    paddingRight: 24,
    ...Platform.select({ web: { cursor: 'pointer' } as object, default: {} }),
  },
  signalSelectCompact: {
    minHeight: 82,
    paddingTop: 11,
    paddingBottom: 11,
  },
  signalSelectHover: {
    backgroundColor: 'rgba(105, 200, 173, 0.035)',
  },
  signalSelectSelected: {
    backgroundColor: 'rgba(105, 200, 173, 0.06)',
  },
  signalMain: { flex: 1, minWidth: 0 },
  signalTopline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  signalMeta: { color: MUTED, fontWeight: '700' },
  signalTitle: { marginTop: 5, color: TEXT_PRIMARY, fontWeight: '700' },
  signalBody: { marginTop: 5, color: TEXT_SECONDARY, lineHeight: 18 },
  signalNext: { marginTop: 6, color: MUTED, fontWeight: '700' },
  signalAside: { width: 150, alignItems: 'flex-end', flexShrink: 0 },
  signalRole: { marginTop: 6, color: MUTED, textAlign: 'right', fontWeight: '700' },
});
