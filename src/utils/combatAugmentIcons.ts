import { getClassGraftDefinition } from '../data/classGraftEngine';
import { ENVOY_BOON_CATALOG } from '../data/envoyBoons';
import { HEX_SHOT_BOON_CATALOG } from '../data/hexShotBoons';
import { LEY_LINE_MUTATION_CATALOG } from '../data/leyLineMutations';
import type { ClassType } from '../types/game';
import type { EnvoyAbilityGraftMap, HexShotAbilityGraftMap } from '../types/classGraft';
import type { EnvoyBoonId, HexShotBoonId } from '../types/classBoon';
import type { LeyLineMutationId, LeyLineMutationTier } from '../types/leyLineMutation';
import type { PendingNarrativeCombatBoons } from '../types/narrativeBonusReward';
import { NARRATIVE_BOON_CATALOG } from '../types/narrativeBonusReward';
import type { AbilityGraftMap } from '../types/veilGraft';
import type { AegisLoadout } from '../types/aegisCombat';
import type { EnvoyLoadout, HexShotLoadout } from '../types/operativeClass';

export type CombatAugmentKind = 'graft' | 'mutation' | 'boon' | 'narrative';

export interface CombatAugmentIcon {
  id: string;
  kind: CombatAugmentKind;
  label: string;
  title: string;
  accentColor: string;
}

const MUTATION_TIER_COLOR: Record<LeyLineMutationTier, string> = {
  KINETIC: '#f97316',
  OCCULT: '#a78bfa',
  SYSTEM: '#94a3b8',
  SYNAPTIC: '#22d3ee',
  AP_BOOST: '#fbbf24',
};

const CLASS_BOON_TIER_COLOR = {
  TIER_1: '#94a3b8',
  TIER_2: '#60a5fa',
  TIER_3: '#a78bfa',
  TIER_4: '#fbbf24',
} as const;

const NARRATIVE_BOON_COLOR: Record<keyof PendingNarrativeCombatBoons, string> = {
  ghosted: '#c084fc',
  scouted: '#38bdf8',
  overcharged: '#fbbf24',
  veilWard: '#34d399',
};

function abbreviate(name: string, max = 3): string {
  const words = name.split(/[\s'-]+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, max)
      .map((word) => word[0] ?? '')
      .join('')
      .toUpperCase();
  }
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, max).toUpperCase();
}

function pushUnique(
  icons: CombatAugmentIcon[],
  seen: Set<string>,
  icon: CombatAugmentIcon,
): void {
  if (seen.has(icon.id)) return;
  seen.add(icon.id);
  icons.push(icon);
}

export function buildCombatAugmentIcons(input: {
  operativeClass: ClassType;
  /** Technique loadout and/or combat HUD cards — grafts keyed by ability id. */
  aegisLoadout: readonly string[] | AegisLoadout;
  hexShotLoadout: HexShotLoadout;
  envoyLoadout: EnvoyLoadout;
  abilityGrafts: AbilityGraftMap;
  hexShotAbilityGrafts: HexShotAbilityGraftMap;
  envoyAbilityGrafts: EnvoyAbilityGraftMap;
  leyLineMutations: readonly LeyLineMutationId[];
  hexShotBoons: readonly HexShotBoonId[];
  envoyBoons: readonly EnvoyBoonId[];
  narrativeCombatBoons?: PendingNarrativeCombatBoons;
}): CombatAugmentIcon[] {
  const icons: CombatAugmentIcon[] = [];
  const seen = new Set<string>();
  const {
    operativeClass,
    aegisLoadout,
    hexShotLoadout,
    envoyLoadout,
    abilityGrafts,
    hexShotAbilityGrafts,
    envoyAbilityGrafts,
    leyLineMutations,
    hexShotBoons,
    envoyBoons,
    narrativeCombatBoons,
  } = input;

  const loadout = operativeClass === 'HEX_SHOT'
    ? hexShotLoadout
    : operativeClass === 'ENVOY'
      ? envoyLoadout
      : aegisLoadout;

  const graftMap = operativeClass === 'HEX_SHOT'
    ? hexShotAbilityGrafts
    : operativeClass === 'ENVOY'
      ? envoyAbilityGrafts
      : abilityGrafts;

  for (const abilityId of loadout) {
    const graftId = graftMap[abilityId as keyof typeof graftMap];
    if (!graftId) continue;
    const graft = getClassGraftDefinition(operativeClass, graftId);
    pushUnique(icons, seen, {
      id: `graft-${graftId}`,
      kind: 'graft',
      label: abbreviate(graft.name),
      title: graft.name,
      accentColor: graft.accentColor,
    });
  }

  for (const mutationId of leyLineMutations) {
    const def = LEY_LINE_MUTATION_CATALOG[mutationId];
    pushUnique(icons, seen, {
      id: `mutation-${mutationId}`,
      kind: 'mutation',
      label: abbreviate(def?.name ?? mutationId),
      title: def?.name ?? mutationId,
      accentColor: MUTATION_TIER_COLOR[def?.tier ?? 'SYSTEM'],
    });
  }

  if (operativeClass === 'HEX_SHOT') {
    for (const boonId of hexShotBoons) {
      const def = HEX_SHOT_BOON_CATALOG[boonId];
      pushUnique(icons, seen, {
        id: `hex-boon-${boonId}`,
        kind: 'boon',
        label: abbreviate(def?.name ?? boonId),
        title: def?.name ?? boonId,
        accentColor: CLASS_BOON_TIER_COLOR[def?.tier ?? 'TIER_1'],
      });
    }
  }

  if (operativeClass === 'ENVOY') {
    for (const boonId of envoyBoons) {
      const def = ENVOY_BOON_CATALOG[boonId];
      pushUnique(icons, seen, {
        id: `envoy-boon-${boonId}`,
        kind: 'boon',
        label: abbreviate(def?.name ?? boonId),
        title: def?.name ?? boonId,
        accentColor: CLASS_BOON_TIER_COLOR[def?.tier ?? 'TIER_1'],
      });
    }
  }

  if (narrativeCombatBoons) {
    (Object.keys(NARRATIVE_BOON_COLOR) as Array<keyof PendingNarrativeCombatBoons>).forEach((key) => {
      if (!narrativeCombatBoons[key]) return;
      const boonKey = key === 'ghosted'
        ? 'Ghosted_Boon'
        : key === 'scouted'
          ? 'Scouted_Boon'
          : key === 'overcharged'
            ? 'Overcharged_Boon'
            : 'Veil_Ward_Boon';
      const meta = NARRATIVE_BOON_CATALOG[boonKey];
      pushUnique(icons, seen, {
        id: `narrative-${key}`,
        kind: 'narrative',
        label: abbreviate(meta.label),
        title: meta.statusLabel,
        accentColor: NARRATIVE_BOON_COLOR[key],
      });
    });
  }

  return icons;
}
