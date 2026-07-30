import type { ClassType } from '../types/game';
import type { PlayerAccount } from '../types/game';
import type { WeaponValidationIssue } from '../types/weapon';
import { isResourceItemId } from './resourceRegistry';
import {
  ALL_WEAPON_FAMILY_IDS,
  getStarterWeaponForClass,
  STARTER_WEAPON_BY_CLASS,
  WEAPON_REGISTRY,
} from './weaponRegistry';
import { validateWeaponIdentityProfiles } from './weaponIdentityProfiles';
import { validateWeaponLoadoutRecommendations } from './weaponLoadoutRecommendationEngine';
import {
  getEquippedWeaponForClass,
  getWeaponTier,
} from './weaponProgressionEngine';
import type { ActiveIncursionState } from '../types/game';
import { resolveActiveWeaponState } from './weaponRunState';
import { validateWeaponUltimates } from './weaponUltimateValidationEngine';
import { validateWeaponCombatPresentation } from './weaponCombatPresentation/validation';

export type { WeaponValidationIssue };

export function validateWeaponRegistry(): WeaponValidationIssue[] {
  const issues: WeaponValidationIssue[] = [];

  if (ALL_WEAPON_FAMILY_IDS.length !== 9) {
    issues.push({
      severity: 'error',
      message: `Expected 9 weapon families, found ${ALL_WEAPON_FAMILY_IDS.length}.`,
    });
  }

  validateWeaponIdentityProfiles().forEach((message) => {
    issues.push({ severity: 'error', message: `Identity profile: ${message}` });
  });

  validateWeaponLoadoutRecommendations().forEach((issue) => {
    issues.push({
      severity: issue.severity,
      weaponId: issue.weaponId,
      message: `Loadout recommendation: ${issue.message}`,
    });
  });

  validateWeaponUltimates().forEach((issue) => {
    issues.push(issue);
  });

  // Phase 3M focused presentation registry checks (not the broader 3N suite).
  validateWeaponCombatPresentation().forEach((issue) => {
    issues.push({
      severity: issue.level === 'error' ? 'error' : 'warn',
      weaponId: undefined,
      message: `Presentation 3M: ${issue.code} — ${issue.message}`,
    });
  });

  const startersByClass = new Map<ClassType, number>();
  ALL_WEAPON_FAMILY_IDS.forEach((id) => {
    const def = WEAPON_REGISTRY[id];
    if (!def) {
      issues.push({ severity: 'error', weaponId: id, message: 'Missing registry entry.' });
      return;
    }
    if (def.id !== id) {
      issues.push({ severity: 'error', weaponId: id, message: 'Registry key/id mismatch.' });
    }
    if (!def.classId) {
      issues.push({ severity: 'error', weaponId: id, message: 'Weapon has no classId.' });
    }
    if (def.tiers.length !== 3) {
      issues.push({ severity: 'error', weaponId: id, message: 'Weapon must have exactly 3 tiers.' });
    }
    if (!def.tiers[0] || def.tiers[0].tierNumber !== 1) {
      issues.push({ severity: 'error', weaponId: id, message: 'Weapon has no default Tier I.' });
    }
    def.tiers.forEach((tier) => {
      if (!tier.effectSummary) {
        issues.push({ severity: 'error', weaponId: id, message: `Tier ${tier.tierNumber} has no effect summary.` });
      }
      tier.upgradeCost.forEach((cost) => {
        if (!isResourceItemId(cost.resourceId)) {
          issues.push({
            severity: 'error',
            weaponId: id,
            message: `Tier ${tier.tierNumber} upgrade references missing resource ${cost.resourceId}.`,
          });
        }
        if (cost.resourceId === 'anomalous-core') {
          issues.push({
            severity: 'warn',
            weaponId: id,
            message: 'Anomalous Core required for normal v1 upgrade.',
          });
        }
      });
    });
    def.unlockRequirement.forEach((cost) => {
      if (!isResourceItemId(cost.resourceId)) {
        issues.push({
          severity: 'error',
          weaponId: id,
          message: `Unlock cost references missing resource ${cost.resourceId}.`,
        });
      }
      if (cost.resourceId === 'anomalous-core') {
        issues.push({
          severity: 'warn',
          weaponId: id,
          message: 'Anomalous Core required for normal v1 unlock.',
        });
      }
    });
    if (def.startingUnlocked) {
      startersByClass.set(def.classId, (startersByClass.get(def.classId) ?? 0) + 1);
    }
    if (!def.uiSummary) {
      issues.push({ severity: 'warn', weaponId: id, message: 'Weapon effect has no UI summary.' });
    }
  });

  (Object.keys(STARTER_WEAPON_BY_CLASS) as ClassType[]).forEach((classId) => {
    const starter = getStarterWeaponForClass(classId);
    const def = WEAPON_REGISTRY[starter];
    if (!def?.startingUnlocked) {
      issues.push({
        severity: 'error',
        message: `Starter class ${classId} has no unlocked starter weapon.`,
      });
    }
    if ((startersByClass.get(classId) ?? 0) < 1) {
      issues.push({
        severity: 'error',
        message: `Class ${classId} missing startingUnlocked weapon in registry.`,
      });
    }
  });

  return issues;
}

export function validatePlayerWeaponState(account: PlayerAccount): WeaponValidationIssue[] {
  const issues: WeaponValidationIssue[] = [];
  (Object.keys(STARTER_WEAPON_BY_CLASS) as ClassType[]).forEach((classId) => {
    const equipped = account.equippedWeaponByClass[classId];
    if (!equipped) return;
    const def = WEAPON_REGISTRY[equipped];
    if (!def) {
      issues.push({ severity: 'error', message: `Unknown equipped weapon ${equipped} for ${classId}.` });
      return;
    }
    if (def.classId !== classId) {
      issues.push({
        severity: 'error',
        weaponId: equipped,
        message: `Player has equipped weapon from wrong class (${classId}).`,
      });
    }
    if (!account.weaponUnlocks.includes(equipped)) {
      issues.push({
        severity: 'error',
        weaponId: equipped,
        message: `Equipped weapon ${equipped} is not unlocked.`,
      });
    }
  });
  return issues;
}

export function validateActiveRunWeapon(incursion: ActiveIncursionState): WeaponValidationIssue[] {
  const issues: WeaponValidationIssue[] = [];
  if (!incursion.isRunActive) return issues;
  if (!incursion.activeWeaponFamilyId) {
    issues.push({ severity: 'error', message: 'Active run has missing weapon.' });
    return issues;
  }
  const def = WEAPON_REGISTRY[incursion.activeWeaponFamilyId];
  if (!def) {
    issues.push({
      severity: 'error',
      weaponId: incursion.activeWeaponFamilyId,
      message: 'Active run weapon not in registry.',
    });
    return issues;
  }
  if (def.classId !== (incursion.activeClass ?? 'AEGIS')) {
    issues.push({
      severity: 'error',
      weaponId: incursion.activeWeaponFamilyId,
      message: 'Active run weapon class mismatch.',
    });
  }
  return issues;
}

export function formatWeaponValidationReport(issues: WeaponValidationIssue[]): string {
  if (issues.length === 0) return 'WEAPON VALIDATION — PASS (0 issues).';
  const lines = issues.map((issue) => {
    const prefix = issue.severity === 'error' ? 'ERR' : 'WRN';
    const id = issue.weaponId ? `[${issue.weaponId}] ` : '';
    return `${prefix} ${id}${issue.message}`;
  });
  return ['WEAPON VALIDATION REPORT', ...lines].join('\n');
}

export function validateWeaponPipeline(
  account: PlayerAccount,
  incursion?: ActiveIncursionState | null,
): WeaponValidationIssue[] {
  return [
    ...validateWeaponRegistry(),
    ...validatePlayerWeaponState(account),
    ...(incursion ? validateActiveRunWeapon(incursion) : []),
  ];
}

export function debugPrintEquippedWeapons(account: PlayerAccount): string {
  const lines = (Object.keys(STARTER_WEAPON_BY_CLASS) as ClassType[]).map((classId) => {
    const familyId = getEquippedWeaponForClass(
      {
        weaponUnlocks: account.weaponUnlocks,
        weaponTiers: account.weaponTiers,
        equippedWeaponByClass: account.equippedWeaponByClass,
      },
      classId,
    );
    const tier = getWeaponTier(
      {
        weaponUnlocks: account.weaponUnlocks,
        weaponTiers: account.weaponTiers,
        equippedWeaponByClass: account.equippedWeaponByClass,
      },
      familyId,
    );
    const def = WEAPON_REGISTRY[familyId];
    return `${classId}: ${def.shortName} // Tier ${tier}`;
  });
  return lines.join('\n');
}

export function debugResolveRunWeapon(incursion: ActiveIncursionState): string {
  try {
    const weapon = resolveActiveWeaponState(incursion);
    return `${weapon.displayName} // ${weapon.effectSummary}`;
  } catch {
    return 'UNRESOLVED WEAPON';
  }
}
