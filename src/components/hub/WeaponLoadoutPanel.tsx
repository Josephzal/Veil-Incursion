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
import { LOADOUT_SECTION_GAP, LoadoutSectionBlock } from './loadoutTabUi';

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

  const renderCard = (def: (typeof families)[number]): React.JSX.Element => {
    const unlocked = account.weaponUnlocks.includes(def.id);
    const tier = getWeaponTier(progression, def.id);
    const tierState = resolveWeaponState(def.id, tier);
    const isEquipped = equippedId === def.id;
    const canUnlock = !unlocked && canUnlockWeaponFamily(account.resourceStash, progression, def.id);
    const canUpgrade = unlocked && tier < 3 && canUpgradeWeaponTier(account.resourceStash, progression, def.id);
    const nextTier = tier === 1 ? def.tiers[1] : tier === 2 ? def.tiers[2] : null;
    const statLines = formatWeaponStatLines(tierState);

    return (
      <DossierCardShell
        key={def.id}
        padding={10}
        accentColor={isEquipped ? accent : muted}
        showAccentStripe={isEquipped}
      >
        <View style={styles.cardHeader}>
          <TerminalText variant="micro" letterSpacing={0.8} style={{ color: muted }}>
            WEAPON
          </TerminalText>
          <View style={styles.cardTitleRow}>
            <TerminalText variant="body" style={{ color: isEquipped ? accent : theme.primaryColor, fontWeight: '700', flex: 1 }}>
              {tierState.displayName.toUpperCase()}
            </TerminalText>
            <TerminalText variant="caption" style={{ color: isEquipped ? accent : muted }}>
              {isEquipped ? 'EQUIPPED' : def.role.toUpperCase()}
            </TerminalText>
          </View>
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
  };

  const equippedDef = families.find((def) => def.id === equippedId) ?? null;
  const availableDefs = families.filter((def) => def.id !== equippedId);

  return (
    <View style={styles.root}>
      <LoadoutSectionBlock label="Currently Equipped">
        {equippedDef ? (
          renderCard(equippedDef)
        ) : (
          <TerminalText variant="caption" style={{ color: muted }}>
            No weapon equipped for this class.
          </TerminalText>
        )}
      </LoadoutSectionBlock>

      <LoadoutSectionBlock label="Available Chassis">
        <View style={styles.cardList}>
          {availableDefs.map((def) => renderCard(def))}
        </View>
      </LoadoutSectionBlock>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: LOADOUT_SECTION_GAP,
  },
  cardList: {
    gap: 12,
  },
  cardHeader: {
    marginBottom: 4,
    gap: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
