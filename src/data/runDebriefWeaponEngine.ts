import type { PlayerAccount } from '../types/game';
import type { ResourceQuantity } from '../types/resourceItem';
import type { WeaponDebriefLine, WeaponDebriefSummary } from '../types/weapon';
import {
  canUnlockWeaponFamily,
  canUpgradeWeaponTier,
  getEquippedWeaponForClass,
  getWeaponTier,
  resolveWeaponState,
} from './weaponProgressionEngine';
import { countMissingCost, formatWeaponCostLine } from './weaponResourceEngine';
import { getWeaponFamily, listWeaponFamiliesForClass } from './weaponRegistry';
import type { ActiveIncursionState } from '../types/game';

export function buildWeaponDebriefSummary(
  account: PlayerAccount,
  incursion: ActiveIncursionState | null,
): WeaponDebriefSummary {
  const classId = incursion?.activeClass ?? account.activeClass;
  const progression = {
    weaponUnlocks: account.weaponUnlocks,
    weaponTiers: account.weaponTiers,
    equippedWeaponByClass: account.equippedWeaponByClass,
  };
  const equippedFamilyId = incursion?.activeWeaponFamilyId
    ?? getEquippedWeaponForClass(progression, classId);
  const equippedTier = incursion?.activeWeaponTier
    ?? getWeaponTier(progression, equippedFamilyId);
  const equippedState = resolveWeaponState(equippedFamilyId, equippedTier);
  const lines: WeaponDebriefLine[] = [];

  lines.push({
    kind: 'EQUIPPED',
    label: equippedState.displayName,
    detail: equippedState.effectSummary,
  });

  const stash: ResourceQuantity = account.resourceStash;

  listWeaponFamiliesForClass(classId).forEach((def) => {
    if (!progression.weaponUnlocks.includes(def.id)) {
      if (canUnlockWeaponFamily(stash, progression, def.id)) {
        lines.push({
          kind: 'NEWLY_UNLOCKABLE',
          label: def.name,
          detail: `Resources available — ${formatWeaponCostLine(def.unlockRequirement)}`,
        });
      } else {
        const { missingTotal, parts } = countMissingCost(stash, def.unlockRequirement);
        if (missingTotal > 0 && missingTotal <= 5) {
          lines.push({
            kind: 'NEARLY_READY',
            label: def.name,
            detail: `Need ${parts.join(', ')} for unlock.`,
          });
        }
      }
      return;
    }

    const tier = getWeaponTier(progression, def.id);
    if (tier >= 3) return;
    const nextTierDef = tier === 1
      ? def.tiers[1]
      : tier === 2
        ? def.tiers[2]
        : null;
    if (!nextTierDef) return;
    if (canUpgradeWeaponTier(stash, progression, def.id)) {
      lines.push({
        kind: 'UPGRADE_AVAILABLE',
        label: nextTierDef.displayName,
        detail: nextTierDef.effectSummary,
      });
    } else {
      const upgradeCost = def.tiers[tier - 1]?.upgradeCost ?? [];
      const { missingTotal, parts } = countMissingCost(stash, upgradeCost);
      if (missingTotal > 0 && missingTotal <= 4) {
        lines.push({
          kind: 'NEARLY_READY',
          label: nextTierDef.displayName,
          detail: `Need ${parts.join(', ')} for upgrade.`,
        });
      }
    }
  });

  return {
    equippedFamilyId,
    equippedDisplayName: equippedState.displayName,
    equippedTier,
    effectSummary: equippedState.effectSummary,
    lines,
  };
}

export function buildAllClassWeaponOpportunities(account: PlayerAccount): WeaponDebriefLine[] {
  const lines: WeaponDebriefLine[] = [];
  const classes: import('../types/game').ClassType[] = ['AEGIS', 'HEX_SHOT', 'ENVOY'];
  classes.forEach((classId) => {
    const summary = buildWeaponDebriefSummary(account, {
      activeClass: classId,
      isRunActive: false,
    } as ActiveIncursionState);
    summary.lines
      .filter((line) => line.kind !== 'EQUIPPED')
      .forEach((line) => {
        lines.push({
          ...line,
          label: `${getWeaponFamily(summary.equippedFamilyId ?? 'aegis-runed-longsword').classId}: ${line.label}`,
        });
      });
  });
  return lines;
}
