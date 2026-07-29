/**
 * Phase 3L — read-only player-facing weapon presentation engine.
 * Rendering / inspecting never mutates combat, offers, grafts, decks, or saves.
 */
import type { WeaponFamilyId } from '../../types/weapon';
import type { SectorId } from '../../types/worldState';
import type {
  WeaponAbilityGuidance,
  WeaponAbilityGuidanceLabel,
  WeaponCombatCallout,
  WeaponCombatCalloutInput,
  WeaponPlayerFacingSummary,
  WeaponSectorPressureNote,
} from '../../types/weaponPlayerFacing';
import type { OperativeAbilityId } from '../../types/weaponLoadoutRecommendation';
import { ALL_WEAPON_FAMILY_IDS, isWeaponFamilyId } from '../weaponRegistry';
import { WEAPON_PLAYER_FACING_SUMMARIES } from './weaponPlayerFacingCatalog';
import { getWeaponLoadoutRecommendationProfile } from '../weaponLoadoutRecommendationProfiles';
import { getWeaponSectorMatchup } from '../weaponMatchup/weaponSectorMatchupEngine';
import { WEAPON_DRAWBACK_RECORDS } from '../weaponDrawbackEngine';
import { formatWeaponUltimateReadyCallout } from '../weaponUltimateSurfaceEngine';
import { PRISM_BRINK_FLUX_THRESHOLD } from '../weaponBasicEngine';

const RETIRED_WEAPON_IDS = [
  'rift-conduit',
  'curse-needle',
  'grimoire',
  'hex-control-carbine',
  'ash-shotgun',
] as const;

export function getWeaponPlayerFacingSummary(id: WeaponFamilyId): WeaponPlayerFacingSummary {
  return WEAPON_PLAYER_FACING_SUMMARIES[id];
}

export function listWeaponPlayerFacingSummaries(): WeaponPlayerFacingSummary[] {
  return ALL_WEAPON_FAMILY_IDS.map((id) => WEAPON_PLAYER_FACING_SUMMARIES[id]);
}

export function weaponTutorialCompletionKey(id: WeaponFamilyId): string {
  return WEAPON_PLAYER_FACING_SUMMARIES[id].tutorialCompletionKey;
}

export function isRetiredWeaponId(id: string): boolean {
  return (RETIRED_WEAPON_IDS as readonly string[]).includes(id);
}

export function assertNoRetiredIdsInPlayerFacing(): string[] {
  const issues: string[] = [];
  for (const summary of listWeaponPlayerFacingSummaries()) {
    if (isRetiredWeaponId(summary.id)) {
      issues.push(`retired weapon in player-facing: ${summary.id}`);
    }
    for (const path of summary.sanctuaryPaths) {
      if (/RIOT_VANGUARD/i.test(path.reason)) {
        issues.push(`${summary.id} sanctuary path exposes RIOT_VANGUARD`);
      }
    }
  }
  return issues;
}

/** Map Phase 3H roles → concise UI labels (only when data supports). */
export function resolveAbilityGuidanceForWeapon(
  weaponFamilyId: WeaponFamilyId,
  abilityId: OperativeAbilityId,
): WeaponAbilityGuidance | null {
  const profile = getWeaponLoadoutRecommendationProfile(weaponFamilyId);
  const rec = profile.recommendations.find((r) => r.abilityId === abilityId);
  if (!rec) return null;
  if (rec.role === 'ANTI_SYNERGY') return null;

  let label: WeaponAbilityGuidanceLabel | null = null;
  if (
    rec.role === 'IDENTITY_ANCHOR'
    || rec.role === 'METER_SUPPORT'
    || rec.role === 'DAMAGE_COMPLEMENT'
  ) {
    label = 'REINFORCES LOOP';
  } else if (
    rec.role === 'MATCHUP_COVERAGE'
    || rec.role === 'DEFENSIVE_FLEX'
    || rec.role === 'CONTROL_COMPLEMENT'
  ) {
    label = 'COVERS PRESSURE';
  } else if (rec.role === 'CONDITIONAL' || rec.coreTier === 'CONDITIONAL') {
    label = 'ALTERNATE PATH';
  } else if (rec.coreTier === 'FLEX') {
    label = 'ALTERNATE PATH';
  }

  if (!label) return null;
  return {
    abilityId,
    label,
    reason: rec.exactMechanicalInteraction || rec.playerFacingReason,
  };
}

/**
 * Translate Phase 3K sector×depth classification into restrained planning notes.
 * Never exposes raw shares, enums, enemy IDs, or debug confidence.
 */
export function resolveWeaponSectorPressureNote(
  weaponFamilyId: WeaponFamilyId,
  sectorId: SectorId | null | undefined,
  depth: 1 | 2 | 3 = 1,
): WeaponSectorPressureNote {
  const fallbackNeutral = 'Sector pressure unknown — plan from chassis strengths and drawbacks.';
  if (!sectorId) {
    return {
      sectorId: 'THE_NULL_ZONE',
      depth,
      advantage: null,
      pressure: null,
      preparation: null,
      fallbackNeutral,
    };
  }

  try {
    const row = getWeaponSectorMatchup(weaponFamilyId, sectorId, depth);
    const drawback = WEAPON_DRAWBACK_RECORDS[weaponFamilyId];
    const summary = getWeaponPlayerFacingSummary(weaponFamilyId);

    let advantage: string | null = null;
    let pressure: string | null = null;
    let preparation: string | null = null;

    if (row.classification === 'FAVORABLE') {
      advantage = translateFavorable(weaponFamilyId, row.formationPressure);
      preparation = `Lean into ${summary.loopCueTag.toLowerCase()} — sector formations support this loop.`;
    } else if (row.classification === 'STRAINED') {
      pressure = translateStrained(weaponFamilyId, drawback.primaryStructuralWeakness);
      preparation = `Bring flex coverage for: ${drawback.compensateBoonOrGraftCategory}.`;
    } else if (row.classification === 'NONVIABLE_DEFECT') {
      // Must never be normal player-facing — neutralize.
      return {
        sectorId,
        depth,
        advantage: null,
        pressure: null,
        preparation: null,
        fallbackNeutral,
      };
    } else {
      // EVEN — omit unless useful preparation tip.
      preparation = `Standard sector expression — watch ${summary.pressures[0].phrase.toLowerCase()}.`;
    }

    return {
      sectorId,
      depth,
      advantage,
      pressure,
      preparation,
      fallbackNeutral,
    };
  } catch {
    return {
      sectorId,
      depth,
      advantage: null,
      pressure: null,
      preparation: null,
      fallbackNeutral,
    };
  }
}

function translateFavorable(weaponFamilyId: WeaponFamilyId, formation: string): string {
  switch (weaponFamilyId) {
    case 'hex-pulse-rifle':
      return 'Strong against clustered formations';
    case 'hex-void-cannon':
      return 'Reliable priority-target / armor-pressure access';
    case 'envoy-echo-lantern':
      return 'Durable groups support Rot detonation setup';
    case 'aegis-claymore-blade':
      return 'Frontline Fracture windows favor break cashouts';
    case 'aegis-rift-edge':
      return 'Tempo windows appear often enough to arm Occult riders';
    case 'envoy-sanguine-prism':
      return 'Spike windows open without constant attrition denial';
    case 'hex-silver-core-sidearm':
      return 'Precision / Protocol tempo remains efficient';
    case 'envoy-null-conduit':
      return 'Catalyst sequencing stays clean under typical pressure';
    default:
      return formation.includes('corruption')
        ? 'Chassis loop remains viable through deeper corruption'
        : 'Natural advantage for this chassis loop';
  }
}

function translateStrained(weaponFamilyId: WeaponFamilyId, primaryWeakness: string): string {
  switch (weaponFamilyId) {
    case 'hex-pulse-rifle':
      return 'Few natural spread-target opportunities';
    case 'hex-void-cannon':
      return 'Soft / swarm density punishes scarce ammo';
    case 'envoy-echo-lantern':
      return 'Fragile setups — enemies may collapse before Rot cashout';
    case 'aegis-claymore-blade':
      return 'Stamina drain can disrupt break setup';
    case 'aegis-runed-longsword':
      return 'Pressured by backline / swarm reach gaps';
    case 'aegis-rift-edge':
      return 'Pressured when tempo cannot be earned safely';
    case 'envoy-null-conduit':
      return 'Pressured by layered Occult denial / silence';
    case 'envoy-sanguine-prism':
      return 'Attrition and heal denial punish sacrifice exposure';
    case 'hex-silver-core-sidearm':
      return 'Pressured by armored packs without pierce flex';
    default:
      return primaryWeakness;
  }
}

/**
 * Compact combat HUD callouts from live runtime state only.
 * Never invents meters; never shows full Prism payoff when unpaid.
 */
export function resolveWeaponCombatCallouts(
  input: WeaponCombatCalloutInput,
): WeaponCombatCallout[] {
  const out: WeaponCombatCallout[] = [];
  const id = input.weaponFamilyId;

  if (input.operativeClass === 'AEGIS') {
    if (typeof input.abyssalReserve === 'number') {
      out.push({
        id: 'aegis-reserve',
        label: `RESERVE ${Math.floor(input.abyssalReserve)}`,
        tone: 'info',
      });
    }
    if (id === 'aegis-rift-edge') {
      out.push({
        id: 'rift-tempo',
        label: input.riftEdgeTempoArmed ? 'OCCULT RIDER ARMED' : 'TEMPO COLD',
        tone: input.riftEdgeTempoArmed ? 'ready' : 'info',
      });
    }
    if (id === 'aegis-claymore-blade') {
      const stm = input.stamina ?? 0;
      const max = input.maxStamina ?? 1;
      const low = stm / max <= 0.35;
      out.push({
        id: 'claymore-stamina',
        label: low ? 'STAMINA COMMITTED' : 'STAMINA READY',
        tone: low ? 'warn' : 'info',
      });
      if (input.claymoreStaminaCommitted) {
        out.push({
          id: 'claymore-cashout',
          label: 'BREAK CASHOUT WINDOW',
          tone: 'ready',
        });
      }
    }
    if (input.weaponUltimateReady) {
      const label = input.weaponUltimateDisplayName
        ? `${input.weaponUltimateDisplayName} READY`
        : formatWeaponUltimateReadyCallout(id) ?? 'ULTIMATE READY';
      out.push({ id: 'weapon-ultimate', label, tone: 'ready' });
    }
  }

  if (input.operativeClass === 'HEX_SHOT') {
    if (typeof input.currentAmmo === 'number' && typeof input.maxAmmo === 'number') {
      out.push({
        id: 'hex-ammo',
        label: `AMMO ${input.currentAmmo}/${input.maxAmmo}`,
        tone: input.currentAmmo === 0 ? 'warn' : 'info',
      });
    }
    if (input.perfectReloadWindow) {
      out.push({ id: 'perfect-reload', label: 'PERFECT RELOAD', tone: 'ready' });
    }
    if (typeof input.hexProtocolCharges === 'number') {
      const max = input.hexMaxProtocolCharges ?? 3;
      out.push({
        id: 'protocol',
        label: `PROTOCOL ${input.hexProtocolCharges}/${max}`,
        tone: input.hexProtocolCharges > 0 ? 'ready' : 'info',
      });
    }
    if (input.weaponUltimateReady || input.zeroProtocolReady) {
      const label = input.weaponUltimateDisplayName
        ? `${input.weaponUltimateDisplayName} READY`
        : formatWeaponUltimateReadyCallout(id) ?? 'ULTIMATE READY';
      out.push({ id: 'weapon-ultimate', label, tone: 'ready' });
    }
    if (id === 'hex-void-cannon') {
      out.push({
        id: 'nullbreach-priority',
        label: 'BREACH — PRIORITY TARGET',
        tone: 'info',
      });
    }
    if (id === 'hex-pulse-rifle') {
      const sec = input.pulseSpreadSecondaryCount ?? 0;
      out.push({
        id: 'pulse-spread',
        label: sec > 0 ? `SPREAD TARGETS +${sec}` : 'SPREAD — PRIMARY ONLY',
        tone: sec > 0 ? 'ready' : 'warn',
      });
    }
  }

  if (input.operativeClass === 'ENVOY') {
    if (typeof input.veilFlux === 'number') {
      out.push({
        id: 'flux',
        label: `FLUX ${Math.floor(input.veilFlux)}${input.fluxMaxCap != null ? `/${input.fluxMaxCap}` : ''}`,
        tone: 'info',
      });
    }
    if (input.previousCatalyst) {
      out.push({
        id: 'catalyst',
        label: `CATALYST ${input.previousCatalyst}`,
        tone: 'info',
      });
    }
    if (id === 'envoy-null-conduit') {
      out.push({
        id: 'clean-cycle',
        label: input.cleanCatalystCycleReady ? 'CLEAN CYCLE READY' : 'CLEAN CYCLE COLD',
        tone: input.cleanCatalystCycleReady ? 'ready' : 'info',
      });
    }
    if (id === 'envoy-echo-lantern') {
      out.push({
        id: 'rot',
        label: `ROT ${input.veilRotStacksTotal ?? 0}`,
        tone: (input.veilRotStacksTotal ?? 0) > 0 ? 'ready' : 'info',
      });
      out.push({
        id: 'detonate',
        label: input.lanternDetonationReady ? 'DETONATION READY' : 'DETONATION SETUP',
        tone: input.lanternDetonationReady ? 'ready' : 'info',
      });
    }
    if (id === 'envoy-sanguine-prism') {
      const brink = input.prismBrinkActive
        ?? (typeof input.veilFlux === 'number' && input.veilFlux <= PRISM_BRINK_FLUX_THRESHOLD);
      out.push({
        id: 'brink',
        label: brink ? 'BRINK ACTIVE' : 'BRINK COLD',
        tone: brink ? 'risk' : 'info',
      });
      const canPay = input.prismCanPayFullSacrifice === true;
      const preview = input.prismSacrificePreview ?? 0;
      if (canPay && preview > 0) {
        out.push({
          id: 'sacrifice',
          label: `SACRIFICE READY (−${preview} HP)`,
          tone: 'risk',
        });
      } else {
        out.push({
          id: 'sacrifice',
          label: preview > 0 && !canPay
            ? 'SACRIFICE BLOCKED — PARTIAL PAY'
            : 'SACRIFICE UNAVAILABLE',
          tone: 'warn',
        });
      }
    }
    if (input.weaponUltimateReady) {
      const label = input.weaponUltimateDisplayName
        ? `${input.weaponUltimateDisplayName} READY`
        : formatWeaponUltimateReadyCallout(id) ?? 'ULTIMATE READY';
      out.push({ id: 'weapon-ultimate', label, tone: 'ready' });
    }
  }

  return out;
}

/** Pure inspect helper — does not mutate anything. */
export function inspectWeaponPlayerFacing(id: string): WeaponPlayerFacingSummary | null {
  if (!isWeaponFamilyId(id)) return null;
  return getWeaponPlayerFacingSummary(id);
}

export function siblingsAreDistinct(summaries: readonly WeaponPlayerFacingSummary[]): string[] {
  const issues: string[] = [];
  const byClass = new Map<string, WeaponPlayerFacingSummary[]>();
  for (const s of summaries) {
    const list = byClass.get(s.classId) ?? [];
    list.push(s);
    byClass.set(s.classId, list);
  }
  for (const [, group] of byClass) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i]!;
        const b = group[j]!;
        if (a.roleLabel === b.roleLabel) issues.push(`role collision ${a.id} / ${b.id}`);
        if (a.selectionSummary === b.selectionSummary) issues.push(`selection collision ${a.id} / ${b.id}`);
        if (a.loopCueTag === b.loopCueTag) issues.push(`loop cue collision ${a.id} / ${b.id}`);
        if (a.playstyleExplanation === b.playstyleExplanation) {
          issues.push(`playstyle collision ${a.id} / ${b.id}`);
        }
      }
    }
  }
  return issues;
}
