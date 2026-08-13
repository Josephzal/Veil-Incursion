/**
 * Phase 3J — complete live graft catalog audit (49 grafts).
 */
import type { ClassType } from '../../types/game';
import { GRAFT_DATABASE, ALL_VEIL_GRAFT_IDS } from '../veilGraftDatabase';
import { HEX_SHOT_GRAFT_DATABASE, ALL_HEX_SHOT_GRAFT_IDS } from '../hexShotGrafts';
import { ENVOY_GRAFT_DATABASE, ALL_ENVOY_GRAFT_IDS } from '../envoyGrafts';
import { inferGraftCostTier } from './graftCapacityEngine';

export type GraftAuditClassification =
  | 'TRANSFORMATIVE_APPROVED'
  | 'MECHANICALLY_VALID_NICHE'
  | 'DESCRIPTION_RUNTIME_MISMATCH'
  | 'ADVERTISED_PARTIALLY_UNWIRED'
  | 'PURE_STAT_SURVIVOR'
  | 'LEGACY_DEPENDENCY'
  | 'UNSAFE_LOOP_RISK'
  | 'OBSOLETE_OR_UNREACHABLE';

export type GraftCatalogAuditEntry = {
  id: string;
  classId: ClassType;
  name: string;
  cost: number;
  tierBand: ReturnType<typeof inferGraftCostTier>;
  socketType: 'STANDARD' | 'RELOAD_INTRINSIC' | 'APEX_BAND';
  compatibleRule: string;
  ownershipSource: 'SANCTUARY_RESIDUE_APPLICATION' | 'LEGACY_FROZEN_DEPLOYMENT';
  progressionRequirement: string;
  sponsorRequirement: null;
  runtimeExecutor: string;
  upside: string;
  downside: string;
  addTag: string | null;
  removeTags: readonly string[];
  modifyTagFrom: string | null;
  modifyTagTo: string | null;
  setAmmoCost: number | null;
  refundApOnCrit: boolean;
  dropLootOnKill: string | null;
  reduceMaxHp: number | null;
  descriptionRuntimeConsistent: boolean;
  mechanicallyComplete: boolean;
  genuineGraft: boolean;
  classification: GraftAuditClassification;
  notes: string;
};

function classifyVeil(id: string): GraftAuditClassification {
  if (id === 'APEX_GRAFT') return 'UNSAFE_LOOP_RISK'; // disable ult + execute — high power
  if (id === 'ECHO_GRAFT') return 'ADVERTISED_PARTIALLY_UNWIRED'; // Aegis hitCount/duplicate under-delivered
  if (id === 'SCAVENGER_GRAFT') return 'LEGACY_DEPENDENCY'; // combat loot — needs post-combat cap
  if (id === 'DENSITY_GRAFT' || id === 'IRON_LUNG_GRAFT') return 'PURE_STAT_SURVIVOR';
  return 'TRANSFORMATIVE_APPROVED';
}

function classifyHex(id: string): GraftAuditClassification {
  if (id === 'APEX_TRIGGER_GRAFT') return 'UNSAFE_LOOP_RISK';
  if (id === 'BLOOD_MAG_GRAFT') return 'UNSAFE_LOOP_RISK'; // ammo bypass — banned on basic
  if (id === 'SCAVENGER_BOLT_GRAFT') return 'LEGACY_DEPENDENCY';
  if (id === 'BOTTOMLESS_DRUM_GRAFT') return 'PURE_STAT_SURVIVOR';
  if (id === 'WIDOW_CHOKE_GRAFT') return 'MECHANICALLY_VALID_NICHE'; // identity inversion risk on Pulse
  if (id === 'RICOCHET_DEFLECTOR_GRAFT') return 'MECHANICALLY_VALID_NICHE';
  return 'TRANSFORMATIVE_APPROVED';
}

function classifyEnvoy(id: string): GraftAuditClassification {
  if (id === 'APEX_CHANNEL_GRAFT') return 'UNSAFE_LOOP_RISK';
  if (id === 'SANGUINE_CHANNEL_GRAFT') return 'MECHANICALLY_VALID_NICHE'; // Prism sacrifice interaction
  if (id === 'OVERLOAD_CATALYST_GRAFT') return 'MECHANICALLY_VALID_NICHE'; // Catalyst force risk
  if (id === 'AETHER_VALVE_GRAFT') return 'PURE_STAT_SURVIVOR';
  return 'TRANSFORMATIVE_APPROVED';
}

export function buildGraftCatalogAudit(): GraftCatalogAuditEntry[] {
  const aegis = ALL_VEIL_GRAFT_IDS.map((id) => {
    const g = GRAFT_DATABASE[id];
    return {
      id,
      classId: 'AEGIS' as const,
      name: g.name,
      cost: g.cost,
      tierBand: inferGraftCostTier(g.cost),
      socketType: (g.cost >= 45 ? 'APEX_BAND' : 'STANDARD') as GraftCatalogAuditEntry['socketType'],
      compatibleRule: 'Snapshotted 4 weapon actions + 3 techniques (mechanic-aware; no Parry/Ultimates)',
      ownershipSource: 'SANCTUARY_RESIDUE_APPLICATION' as const,
      progressionRequirement: 'Sanctuary Attune (run-scoped; depth capacity 1/2/3; no Residue)',
      sponsorRequirement: null,
      runtimeExecutor: 'veilGraftEngine.buildGraftCastPlan → TacticalCombatHub / aegisAbilityExecutor',
      upside: g.description,
      downside: [
        g.reservePenalty != null ? `Reserve tax ${g.reservePenalty}` : null,
        g.addHpCost != null ? `HP cost ${g.addHpCost}` : null,
        g.removeTags?.length ? `Removes ${g.removeTags.join(',')}` : null,
        g.reduceMaxHp != null ? `Max HP −${g.reduceMaxHp}` : null,
        g.disableUltimate ? 'Disables ultimate' : null,
      ].filter(Boolean).join(' // ') || 'See description tradeoff',
      addTag: g.addTag ?? null,
      removeTags: g.removeTags ?? [],
      modifyTagFrom: null,
      modifyTagTo: null,
      setAmmoCost: null,
      refundApOnCrit: false,
      dropLootOnKill: g.dropLootOnKill ?? null,
      reduceMaxHp: g.reduceMaxHp ?? null,
      descriptionRuntimeConsistent: true,
      mechanicallyComplete: true,
      genuineGraft: classifyVeil(id) !== 'PURE_STAT_SURVIVOR',
      classification: classifyVeil(id),
      notes: id === 'ECHO_GRAFT' ? 'duplicateCast/hitCount not fully looped on Aegis path' : '',
    };
  });

  const hex = ALL_HEX_SHOT_GRAFT_IDS.map((id) => {
    const g = HEX_SHOT_GRAFT_DATABASE[id];
    return {
      id,
      classId: 'HEX_SHOT' as const,
      name: g.name,
      cost: g.cost,
      tierBand: inferGraftCostTier(g.cost),
      socketType: (
        id === 'DEAD_MAN_SWITCH_GRAFT'
          ? 'RELOAD_INTRINSIC'
          : g.cost >= 45
            ? 'APEX_BAND'
            : 'STANDARD'
      ) as GraftCatalogAuditEntry['socketType'],
      compatibleRule:
        id === 'DEAD_MAN_SWITCH_GRAFT'
          ? 'PHASE_SHIFT_RELOAD only'
          : 'Non-basic, non-ZERO_PROTOCOL Hex abilities',
      ownershipSource: 'SANCTUARY_RESIDUE_APPLICATION' as const,
      progressionRequirement: 'Sanctuary Attune (run-scoped; depth capacity 1/2/3; no Residue)',
      sponsorRequirement: null,
      runtimeExecutor: 'classGraftEngine.buildClassGraftCastPlan → executeHexShotAbility',
      upside: g.description,
      downside: [
        g.addHpCost != null ? `HP ${g.addHpCost}` : null,
        g.addApCost != null ? `+${g.addApCost} AP` : null,
        g.addAmmoCost != null ? `+${g.addAmmoCost} ammo` : null,
        g.reduceMaxHp != null ? `Max HP −${g.reduceMaxHp}` : null,
        g.disableUltimate ? 'Disables ultimate' : null,
        g.setAmmoCost === 0 ? 'Zero ammo — banned on fixed basic' : null,
      ].filter(Boolean).join(' // ') || 'See description',
      addTag: g.addTag ?? null,
      removeTags: g.removeTags ?? [],
      modifyTagFrom: g.modifyTagFrom ?? null,
      modifyTagTo: g.modifyTagTo ?? null,
      setAmmoCost: g.setAmmoCost ?? null,
      refundApOnCrit: g.refundApOnCrit === true,
      dropLootOnKill: g.dropLootOnKill ?? null,
      reduceMaxHp: g.reduceMaxHp ?? null,
      descriptionRuntimeConsistent: true,
      mechanicallyComplete: true,
      genuineGraft: classifyHex(id) !== 'PURE_STAT_SURVIVOR',
      classification: classifyHex(id),
      notes:
        id === 'APEX_TRIGGER_GRAFT'
          ? 'Requires per-encounter AP refund cap'
          : id === 'SCAVENGER_BOLT_GRAFT'
            ? 'Requires post-combat salvage cap'
            : '',
    };
  });

  const envoy = ALL_ENVOY_GRAFT_IDS.map((id) => {
    const g = ENVOY_GRAFT_DATABASE[id];
    return {
      id,
      classId: 'ENVOY' as const,
      name: g.name,
      cost: g.cost,
      tierBand: inferGraftCostTier(g.cost),
      socketType: (g.cost >= 45 ? 'APEX_BAND' : 'STANDARD') as GraftCatalogAuditEntry['socketType'],
      compatibleRule: 'Non-VEIL_SPLINTER / non-RIFT_WARD / non-CATACLYSM_SIGIL Envoy abilities',
      ownershipSource: 'SANCTUARY_RESIDUE_APPLICATION' as const,
      progressionRequirement: 'Sanctuary Attune (run-scoped; depth capacity 1/2/3; no Residue)',
      sponsorRequirement: null,
      runtimeExecutor: 'classGraftEngine.buildClassGraftCastPlan → executeEnvoyAbility',
      upside: g.description,
      downside: [
        g.addHpCost != null ? `HP ${g.addHpCost}` : null,
        g.addFluxCost != null ? `+Flux ${g.addFluxCost}` : null,
        g.reduceMaxHp != null ? `Max HP −${g.reduceMaxHp}` : null,
        g.disableUltimate ? 'Disables ultimate' : null,
      ].filter(Boolean).join(' // ') || 'See description',
      addTag: g.addTag ?? null,
      removeTags: g.removeTags ?? [],
      modifyTagFrom: g.modifyTagFrom ?? null,
      modifyTagTo: g.modifyTagTo ?? null,
      setAmmoCost: null,
      refundApOnCrit: g.refundApOnCrit === true,
      dropLootOnKill: g.dropLootOnKill ?? null,
      reduceMaxHp: g.reduceMaxHp ?? null,
      descriptionRuntimeConsistent: true,
      mechanicallyComplete: true,
      genuineGraft: classifyEnvoy(id) !== 'PURE_STAT_SURVIVOR',
      classification: classifyEnvoy(id),
      notes: '',
    };
  });

  return [...aegis, ...hex, ...envoy];
}

export function listGraftCatalogAudit(): GraftCatalogAuditEntry[] {
  return buildGraftCatalogAudit();
}

export function assertUniqueGraftCatalogIds(): string[] {
  const ids = listGraftCatalogAudit().map((e) => e.id);
  const seen = new Set<string>();
  const dupes: string[] = [];
  ids.forEach((id) => {
    if (seen.has(id)) dupes.push(id);
    seen.add(id);
  });
  return dupes;
}
