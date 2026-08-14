import type { ClassType } from '../types/game';
import type { RunStatusEffect } from '../types/narrativeProcedural';
import type { AegisTechniqueLoadout } from '../types/aegisCombat';
import type { EnvoyLoadout, HexShotLoadout } from '../types/operativeClass';
import type { WeaponFamilyId } from '../types/weapon';
import { buildAegisGraftSurface } from './aegisGraftTarget';
import { deriveHexWeaponActions } from './hexWeaponActionRegistry';
import { deriveEnvoyWeaponActions } from './envoyWeaponActionRegistry';
import { classifyAbilitySocket } from './graftSynergy/graftCapacityEngine';
import { resolveClassAbilityCost } from './classAbilityResolver';
import {
  getUniversalGraftDefinition,
  getUniversalGraftForAction,
  normalizeUniversalGraftId,
  universalGraftMatchesTarget,
} from './universalGraftRegistry';

export const SANCTUARY_STABILIZATION_HEAL_PCT = 0.10;
export const SANCTUARY_ATTUNE_HEAL_PCT = 0.30;

export interface SanctuaryGraftSurfaceRow {
  key: string;
  actionId: string;
  group: 'WEAPON_ACTION' | 'TECHNIQUE';
  isFixedBasic: boolean;
}

export function resolveSanctuaryOfferTarget(
  classId: ClassType,
  surface: readonly SanctuaryGraftSurfaceRow[],
  graftId: unknown,
): SanctuaryGraftSurfaceRow | null {
  const graft = getUniversalGraftDefinition(graftId);
  if (!graft || graft.classId !== classId) return null;
  return surface.find(
    (row) =>
      row.actionId === graft.canonicalActionId
      && universalGraftMatchesTarget(classId, row.key, graft.id),
  ) ?? null;
}

export function sanctuaryVisitId(input: {
  currentNodeId?: string | null;
  nodesCleared?: number | null;
  currentDistrict?: number | null;
}): string {
  return input.currentNodeId
    ? `node:${input.currentNodeId}`
    : `sanctuary:d${input.currentDistrict ?? 1}:n${input.nodesCleared ?? 0}`;
}

export function isOrdinarySanctuaryAilment(effect: RunStatusEffect): boolean {
  return effect.sanctuaryAilment?.removable === true
    && effect.sanctuaryAilment.severity !== 'MAJOR';
}

export function resolveSanctuaryStabilization(args: {
  currentHp: number;
  maxHp: number;
  statusEffects: readonly RunStatusEffect[];
  alreadyApplied: boolean;
}): {
  applied: boolean;
  currentHp: number;
  statusEffects: RunStatusEffect[];
  healed: number;
  cleansedEffectId: string | null;
} {
  if (args.alreadyApplied) {
    return {
      applied: false,
      currentHp: args.currentHp,
      statusEffects: [...args.statusEffects],
      healed: 0,
      cleansedEffectId: null,
    };
  }
  if (args.currentHp < args.maxHp) {
    const nextHp = Math.min(
      args.maxHp,
      args.currentHp + Math.floor(args.maxHp * SANCTUARY_STABILIZATION_HEAL_PCT),
    );
    return {
      applied: true,
      currentHp: nextHp,
      statusEffects: [...args.statusEffects],
      healed: nextHp - args.currentHp,
      cleansedEffectId: null,
    };
  }
  const candidate = args.statusEffects
    .map((effect, index) => ({ effect, index }))
    .filter(({ effect }) =>
      effect.sanctuaryAilment?.removable === true
      && effect.sanctuaryAilment.severity === 'MINOR')
    .sort((left, right) =>
      (right.effect.sanctuaryAilment?.priority ?? 0)
      - (left.effect.sanctuaryAilment?.priority ?? 0)
      || left.index - right.index)[0];
  return {
    applied: true,
    currentHp: Math.min(args.currentHp, args.maxHp),
    statusEffects: candidate
      ? args.statusEffects.filter((_, index) => index !== candidate.index)
      : [...args.statusEffects],
    healed: 0,
    cleansedEffectId: candidate?.effect.id ?? null,
  };
}

export function resolveSanctuaryAttune(args: {
  currentHp: number;
  maxHp: number;
  healReceivedMultiplier: number;
  statusEffects: readonly RunStatusEffect[];
}): {
  currentHp: number;
  healed: number;
  statusEffects: RunStatusEffect[];
  cleansedEffectIds: string[];
} {
  const restore = Math.floor(
    args.maxHp * SANCTUARY_ATTUNE_HEAL_PCT * args.healReceivedMultiplier,
  );
  const currentHp = Math.min(args.maxHp, args.currentHp + restore);
  const cleansedEffectIds = args.statusEffects
    .filter(isOrdinarySanctuaryAilment)
    .map((effect) => effect.id);
  return {
    currentHp,
    healed: currentHp - args.currentHp,
    statusEffects: args.statusEffects.filter((effect) => !isOrdinarySanctuaryAilment(effect)),
    cleansedEffectIds,
  };
}

export function buildSanctuaryGraftSurface(args: {
  classId: ClassType;
  weaponFamilyId: WeaponFamilyId | null | undefined;
  aegisTechniques: AegisTechniqueLoadout | readonly string[];
  hexFlex: HexShotLoadout | readonly string[];
  envoyFlex: EnvoyLoadout | readonly string[];
}): SanctuaryGraftSurfaceRow[] {
  if (args.classId === 'AEGIS') {
    return buildAegisGraftSurface({
      weaponFamilyId: args.weaponFamilyId,
      techniques: args.aegisTechniques,
    }).map((row) => ({ ...row }));
  }
  const actions = args.classId === 'HEX_SHOT'
    ? deriveHexWeaponActions(args.weaponFamilyId) ?? []
    : deriveEnvoyWeaponActions(args.weaponFamilyId) ?? [];
  const flex = args.classId === 'HEX_SHOT' ? args.hexFlex : args.envoyFlex;
  const rows: SanctuaryGraftSurfaceRow[] = [
    ...actions.map((actionId) => ({
      key: actionId,
      actionId,
      group: 'WEAPON_ACTION' as const,
      isFixedBasic: classifyAbilitySocket(args.classId, actionId) === 'FIXED_BASIC_SIGNATURE',
    })),
    ...[...new Set(flex)].slice(0, 3).map((actionId) => ({
      key: actionId,
      actionId,
      group: 'TECHNIQUE' as const,
      isFixedBasic: false,
    })),
  ];
  return rows.filter((row) => {
    const socket = classifyAbilitySocket(args.classId, row.actionId);
    if (socket === 'ULTIMATE' || socket === 'RELOAD_INTRINSIC') return false;
    const tags = resolveClassAbilityCost(args.classId, row.actionId).tags;
    return !tags.some((tag) =>
      tag === 'ULTIMATE'
      || tag === 'INSTINCT'
      || tag === 'CLASS_MECHANIC'
      || tag === 'MIGRATION_ONLY'
      || tag === 'RETIRED');
  });
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildDeterministicSanctuaryGraftOffers(args: {
  classId: ClassType;
  seed: string;
  runDepthBand: number;
  surface: readonly SanctuaryGraftSurfaceRow[];
  currentMap: Readonly<Record<string, string>>;
}): string[] {
  const candidates = args.surface
    .map((row) => ({
      row,
      graft: getUniversalGraftForAction(args.classId, row.actionId),
    }))
    .filter((entry): entry is {
      row: SanctuaryGraftSurfaceRow;
      graft: NonNullable<typeof entry.graft>;
    } => entry.graft != null)
    .filter(({ row, graft }) => args.currentMap[row.key] !== graft.id)
    .filter(({ row, graft }) =>
      universalGraftMatchesTarget(args.classId, row.key, graft.id))
    .sort((left, right) =>
      stableHash(`${args.seed}:${left.row.key}:${left.graft.id}`)
      - stableHash(`${args.seed}:${right.row.key}:${right.graft.id}`)
      || left.graft.id.localeCompare(right.graft.id));
  return [...new Set(candidates.map(({ graft }) => graft.id))].slice(0, 3);
}

export function sanitizeSanctuaryGraftMap(
  map: Readonly<Record<string, string>>,
  surface: readonly SanctuaryGraftSurfaceRow[],
): Record<string, string> {
  const allowed = new Set(surface.map((row) => row.key));
  return Object.fromEntries(
    Object.entries(map).filter(([abilityId, graftId]) => {
      if (!allowed.has(abilityId)) return false;
      const normalized = normalizeUniversalGraftId(graftId);
      if (!normalized) return false;
      const actionId = surface.find((row) => row.key === abilityId)?.actionId;
      return actionId != null
        && getUniversalGraftDefinition(normalized)?.canonicalActionId === actionId;
    }),
  );
}
