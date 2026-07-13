import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import TerminalText from '../TerminalText';
import HapticPressable from '../HapticPressable';
import DossierCardShell from './DossierCardShell';
import { usePlayerAccount } from '../../context/PlayerAccountContext';
import { useTerminal } from '../../context/TerminalContext';
import { listWeaponFamiliesForClass } from '../../data/weaponRegistry';
import {
  canUnlockWeaponFamily,
  canUpgradeWeaponTier,
  getEquippedWeaponForClass,
  getWeaponTier,
  resolveWeaponState,
} from '../../data/weaponProgressionEngine';
import { formatWeaponCostLine } from '../../data/weaponResourceEngine';
import { formatWeaponStatLines } from '../../data/weaponCombatEngine';
import type { WeaponFamilyId } from '../../types/weapon';
import { readPressableHover, terminalHoverStyle } from '../../utils/terminalHoverStyle';

interface WeaponLoadoutPanelProps {
  accent: string;
  muted: string;
}

export default function WeaponLoadoutPanel({
  accent,
  muted,
}: WeaponLoadoutPanelProps): React.JSX.Element {
  const {
    account,
    appendHubLog,
    equipWeaponFamily,
    unlockWeaponFamilyAccount,
    upgradeWeaponFamilyTier,
  } = usePlayerAccount();
  const { theme } = useTerminal();

  const progression = useMemo(() => ({
    weaponUnlocks: account.weaponUnlocks,
    weaponTiers: account.weaponTiers,
    equippedWeaponByClass: account.equippedWeaponByClass,
  }), [account.equippedWeaponByClass, account.weaponTiers, account.weaponUnlocks]);

  const equippedId = getEquippedWeaponForClass(progression, account.activeClass);
  const families = useMemo(
    () => listWeaponFamiliesForClass(account.activeClass),
    [account.activeClass],
  );

  const handleEquip = useCallback((familyId: WeaponFamilyId) => {
    const result = equipWeaponFamily(familyId);
    appendHubLog(result.logLine);
  }, [appendHubLog, equipWeaponFamily]);

  const handleUnlock = useCallback((familyId: WeaponFamilyId) => {
    const result = unlockWeaponFamilyAccount(familyId);
    appendHubLog(result.logLine);
  }, [appendHubLog, unlockWeaponFamilyAccount]);

  const handleUpgrade = useCallback((familyId: WeaponFamilyId) => {
    const result = upgradeWeaponFamilyTier(familyId);
    appendHubLog(result.logLine);
  }, [appendHubLog, upgradeWeaponFamilyTier]);

  return (
    <View style={styles.root}>
      <TerminalText variant="section" letterSpacing={1} style={{ color: accent, marginBottom: 4 }}>
        [ WEAPON CHASSIS ]
      </TerminalText>
      <TerminalText variant="caption" style={{ color: muted, marginBottom: 10 }}>
        One weapon per class — locked for the run at descent. Mid-run weapon swap disabled in v1.
      </TerminalText>

      {families.map((def) => {
        const unlocked = account.weaponUnlocks.includes(def.id);
        const tier = getWeaponTier(progression, def.id);
        const tierState = resolveWeaponState(def.id, tier);
        const isEquipped = equippedId === def.id;
        const canUnlock = !unlocked && canUnlockWeaponFamily(account.resourceStash, progression, def.id);
        const canUpgrade = unlocked && tier < 3 && canUpgradeWeaponTier(account.resourceStash, progression, def.id);
        const nextTier = tier === 1
          ? def.tiers[1]
          : tier === 2
            ? def.tiers[2]
            : null;
        const statLines = formatWeaponStatLines(tierState);

        return (
          <DossierCardShell
            key={def.id}
            padding={10}
            accentColor={isEquipped ? accent : muted}
            showAccentStripe={isEquipped}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <TerminalText variant="body" style={{ color: isEquipped ? accent : theme.primaryColor, fontWeight: '700' }}>
                {tierState.displayName.toUpperCase()}
              </TerminalText>
              <TerminalText variant="caption" style={{ color: muted }}>
                {def.role.toUpperCase()}
              </TerminalText>
            </View>
            <TerminalText variant="caption" style={{ color: muted, marginBottom: 6 }}>
              {def.description}
            </TerminalText>
            {statLines.map((line) => (
              <TerminalText key={line} variant="caption" style={{ color: theme.primaryColor, marginBottom: 2 }}>
                {`// ${line}`}
              </TerminalText>
            ))}
            {!unlocked ? (
              <>
                <TerminalText variant="caption" style={{ color: muted, marginTop: 6 }}>
                  {`UNLOCK: ${formatWeaponCostLine(def.unlockRequirement)}`}
                </TerminalText>
                <HapticPressable
                  disabled={!canUnlock}
                  onPress={() => handleUnlock(def.id)}
                  style={(state) => [
                    styles.actionBtn,
                    terminalHoverStyle(readPressableHover(state), state.pressed),
                    { borderColor: canUnlock ? accent : muted, opacity: canUnlock ? 1 : 0.45 },
                  ]}
                >
                  <TerminalText variant="caption" style={{ color: canUnlock ? accent : muted }}>
                    UNLOCK BLUEPRINT
                  </TerminalText>
                </HapticPressable>
              </>
            ) : (
              <View style={styles.actionRow}>
                {!isEquipped ? (
                  <HapticPressable
                    onPress={() => handleEquip(def.id)}
                    style={(state) => [
                      styles.actionBtn,
                      terminalHoverStyle(readPressableHover(state), state.pressed),
                      { borderColor: accent },
                    ]}
                  >
                    <TerminalText variant="caption" style={{ color: accent }}>EQUIP</TerminalText>
                  </HapticPressable>
                ) : (
                  <TerminalText variant="caption" style={{ color: accent, marginTop: 8 }}>
                    ACTIVE WEAPON LINK
                  </TerminalText>
                )}
                {nextTier ? (
                  <>
                    <TerminalText variant="caption" style={{ color: muted, marginTop: 6 }}>
                      {`NEXT: ${nextTier.displayName} — ${nextTier.effectSummary}`}
                    </TerminalText>
                    <TerminalText variant="caption" style={{ color: muted }}>
                      {`COST: ${formatWeaponCostLine(def.tiers[tier - 1]?.upgradeCost ?? [])}`}
                    </TerminalText>
                    <HapticPressable
                      disabled={!canUpgrade}
                      onPress={() => handleUpgrade(def.id)}
                      style={(state) => [
                        styles.actionBtn,
                        terminalHoverStyle(readPressableHover(state), state.pressed),
                        { borderColor: canUpgrade ? accent : muted, opacity: canUpgrade ? 1 : 0.45 },
                      ]}
                    >
                      <TerminalText variant="caption" style={{ color: canUpgrade ? accent : muted }}>
                        UPGRADE TIER
                      </TerminalText>
                    </HapticPressable>
                  </>
                ) : (
                  <TerminalText variant="caption" style={{ color: muted, marginTop: 6 }}>
                    MAX TIER — Masterwork locked (future).
                  </TerminalText>
                )}
              </View>
            )}
          </DossierCardShell>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  card: {
    marginBottom: 8,
  },
  cardHeader: {
    marginBottom: 4,
  },
  actionRow: {
    marginTop: 4,
  },
  actionBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
