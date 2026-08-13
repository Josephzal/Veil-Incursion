/**
 * Phase 3J — sanitize equipped graft maps (ownership preserved; invalid assignments dropped).
 * Phase D — Aegis maps use encoded WA:/TECH: keys + surface sanitize (never redirect).
 * Stage II-B — capacity from run depth band, not Class Rank.
 */
import type { ClassType } from '../../types/game';
import type { AbilityGraftMap } from '../../types/veilGraft';
import type { EnvoyAbilityGraftMap, HexShotAbilityGraftMap } from '../../types/classGraft';
import type { AegisTechniqueLoadout } from '../../types/aegisCombat';
import type { WeaponFamilyId } from '../../types/weapon';
import { evaluateGraftCompatibility, isLiveGraftId } from './graftCompatibilityEngine';
import { getGraftSocketAccessForRunDepth } from './graftCapacityEngine';
import { canGraftClassAbility } from '../classGraftEngine';
import { migrateHexShotAbilityId } from '../hexShotMigration';
import { sanitizeAegisAbilityGraftMap } from '../aegisGraftTarget';

export type GraftSanitizeReport = {
  kept: Record<string, string>;
  removed: { abilityId: string; graftId: string; reason: string }[];
  capacityUsed: number;
  capacityAvailable: number;
};

function sanitizeMap(
  classId: ClassType,
  raw: Readonly<Record<string, string | undefined>>,
  runDepthBand: number,
): GraftSanitizeReport {
  const access = getGraftSocketAccessForRunDepth(runDepthBand);
  const removed: GraftSanitizeReport['removed'] = [];
  const candidates: { abilityId: string; graftId: string }[] = [];

  Object.entries(raw).forEach(([abilityId, graftId]) => {
    if (!graftId) return;
    const resolvedAbility =
      classId === 'HEX_SHOT' ? migrateHexShotAbilityId(abilityId) : abilityId;
    if (!isLiveGraftId(classId, graftId)) {
      removed.push({ abilityId, graftId, reason: 'UNKNOWN_OR_RETIRED_GRAFT' });
      return;
    }
    if (!canGraftClassAbility(classId, resolvedAbility, {
      allowFixedBasic: access.allowFixedBasic,
      allowUltimate: access.allowUltimate,
    })) {
      removed.push({ abilityId, graftId, reason: 'INCOMPATIBLE_SOCKET' });
      return;
    }
    candidates.push({ abilityId: resolvedAbility, graftId });
  });

  // One instance per graft ID — keep first, drop later duplicates.
  const seenGraft = new Set<string>();
  const deduped: typeof candidates = [];
  candidates.forEach((c) => {
    if (seenGraft.has(c.graftId)) {
      removed.push({ abilityId: c.abilityId, graftId: c.graftId, reason: 'DUPLICATE_GRAFT_ID' });
      return;
    }
    seenGraft.add(c.graftId);
    deduped.push(c);
  });

  // Capacity clamp — keep earliest assignments.
  const kept: Record<string, string> = {};
  deduped.forEach((c, index) => {
    if (index >= access.capacity) {
      removed.push({ abilityId: c.abilityId, graftId: c.graftId, reason: 'OVER_CAPACITY' });
      return;
    }
    const check = evaluateGraftCompatibility({
      classId,
      abilityId: c.abilityId,
      graftId: c.graftId,
      runDepthBand,
      equippedMap: kept,
      graftAvailable: true,
    });
    if (!check.ok && check.rejections.includes('SAFETY_INVARIANT')) {
      removed.push({ abilityId: c.abilityId, graftId: c.graftId, reason: 'SAFETY_INVARIANT' });
      return;
    }
    kept[c.abilityId] = c.graftId;
  });

  return {
    kept,
    removed,
    capacityUsed: Object.keys(kept).length,
    capacityAvailable: Math.max(0, access.capacity - Object.keys(kept).length),
  };
}

export function sanitizeAegisAbilityGrafts(
  map: AbilityGraftMap,
  runDepthBand: number,
  surface?: {
    weaponFamilyId?: WeaponFamilyId | null;
    techniques?: AegisTechniqueLoadout | readonly string[] | null;
  },
): { map: AbilityGraftMap; report: GraftSanitizeReport } {
  const surfaceClean = sanitizeAegisAbilityGraftMap(map as Record<string, string>, {
    weaponFamilyId: surface?.weaponFamilyId,
    techniques: surface?.techniques,
  });
  const report = sanitizeMap('AEGIS', surfaceClean, runDepthBand);
  const kept: Record<string, string> = {};
  const removed = [...report.removed];
  Object.entries(report.kept).forEach(([abilityId, graftId]) => {
    const check = evaluateGraftCompatibility({
      classId: 'AEGIS',
      abilityId,
      graftId,
      runDepthBand,
      equippedMap: kept,
      graftAvailable: true,
    });
    if (!check.ok) {
      removed.push({
        abilityId,
        graftId,
        reason: check.rejections.join(',') || 'INCOMPATIBLE',
      });
      return;
    }
    kept[abilityId] = graftId;
  });
  return {
    map: kept as AbilityGraftMap,
    report: {
      ...report,
      kept,
      removed,
      capacityUsed: Object.keys(kept).length,
      capacityAvailable: Math.max(
        0,
        getGraftSocketAccessForRunDepth(runDepthBand).capacity - Object.keys(kept).length,
      ),
    },
  };
}

export function sanitizeHexShotAbilityGrafts(
  map: HexShotAbilityGraftMap,
  runDepthBand: number,
): { map: HexShotAbilityGraftMap; report: GraftSanitizeReport } {
  const report = sanitizeMap('HEX_SHOT', map as Record<string, string>, runDepthBand);
  return { map: report.kept as HexShotAbilityGraftMap, report };
}

export function sanitizeEnvoyAbilityGrafts(
  map: EnvoyAbilityGraftMap,
  runDepthBand: number,
): { map: EnvoyAbilityGraftMap; report: GraftSanitizeReport } {
  const report = sanitizeMap('ENVOY', map as Record<string, string>, runDepthBand);
  return { map: report.kept as EnvoyAbilityGraftMap, report };
}
