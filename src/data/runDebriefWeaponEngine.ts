import type { PlayerAccount } from '../types/game';
import type { ResourceQuantity } from '../types/resourceItem';
import type { WeaponDebriefLine, WeaponDebriefSummary } from '../types/weapon';
import {
  canUnlockWeaponFamily,
  getEquippedWeaponForClass,
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
    equippedWeaponByClass: account.equippedWeaponByClass,
  };
  const equippedFamilyId = incursion?.activeWeaponFamilyId
    ?? getEquippedWeaponForClass(progression, classId);
  const equippedState = resolveWeaponState(equippedFamilyId);
  const lines: WeaponDebriefLine[] = [];

  lines.push({
    kind: 'EQUIPPED',
    label: equippedState.displayName,
    detail: equippedState.effectSummary,
  });

  const stash: ResourceQuantity = account.resourceStash;

  listWeaponFamiliesForClass(classId).forEach((def) => {
    if (progression.weaponUnlocks.includes(def.id)) return;

    if (canUnlockWeaponFamily(stash, progression, def.id)) {
      lines.push({
        kind: 'NEWLY_UNLOCKABLE',
        label: def.name,
        detail: `Resources available — ${formatWeaponCostLine(def.unlockRequirement)}`,
      });
      return;
    }

    const { missingTotal, parts } = countMissingCost(stash, def.unlockRequirement);
    if (missingTotal > 0 && missingTotal <= 5) {
      lines.push({
        kind: 'NEARLY_READY',
        label: def.name,
        detail: `Need ${parts.join(', ')} for unlock.`,
      });
    }
  });

  return {
    equippedFamilyId,
    equippedDisplayName: equippedState.displayName,
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
          label: `${getWeaponFamily(summary.equippedFamilyId ?? 'aegis-longsword').classId}: ${line.label}`,
        });
      });
  });
  return lines;
}
