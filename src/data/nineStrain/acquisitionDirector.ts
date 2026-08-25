import type { ClassType, RunNodeType } from '../../types/game';
import type {
  NineStrainRuntimeState,
  StrainId,
  UniversalBoonDefinition,
} from '../../types/nineStrain';
import type { EligibilityOptions } from './ownership';
import type { PostCombatBoonOffer } from '../../types/classBoon';
import type { ScannerLabelCertainty } from '../scannerLabelCertaintyCatalog';
import { CONVERGENCE_IDS, SECTOR_1_STRAIN_IDS, SECTOR_2_STRAIN_IDS, SECTOR_3_STRAIN_IDS, SECTOR_4_STRAIN_IDS } from '../../types/convergence';
import { STRAIN_DISPLAY_NAMES } from './strainRegistry';
import { evaluateEligibility, previewAcquire } from './ownership';
import { createSeededRng } from '../boonOffer/boonOfferSelection';
import { getProductionOfferDefinitions, indexDefinitions } from './definitionCatalog';
import { NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE } from './contentConfiguration';
import { AFTERIMAGE_CORE_IDS } from '../../types/afterimage';

export const CONTACT_STRAIN_PREFIX = 'CONTACT_STRAIN:';

/** Stage E.3: wave 4 (Gravemark, Shardskin) is now live in production offer composition. */
function clampToProductionWave(maxWave: 1 | 2 | 3 | 4 | undefined): 1 | 2 | 3 | 4 | undefined {
  return maxWave;
}

export function unlockedStrainIds(maxWave: 1 | 2 | 3 | 4 | undefined): StrainId[] {
  if ((maxWave ?? 1) >= 4) return [...SECTOR_1_STRAIN_IDS, ...SECTOR_2_STRAIN_IDS, ...SECTOR_3_STRAIN_IDS, ...SECTOR_4_STRAIN_IDS];
  if ((maxWave ?? 1) >= 3) return [...SECTOR_1_STRAIN_IDS, ...SECTOR_2_STRAIN_IDS, ...SECTOR_3_STRAIN_IDS];
  if ((maxWave ?? 1) >= 2) return [...SECTOR_1_STRAIN_IDS, ...SECTOR_2_STRAIN_IDS];
  return [...SECTOR_1_STRAIN_IDS];
}

export function contactStrainOfferId(strainId: StrainId): string {
  return `${CONTACT_STRAIN_PREFIX}${strainId}`;
}

export function parseContactStrainOfferId(id: string): StrainId | null {
  if (!id.startsWith(CONTACT_STRAIN_PREFIX)) return null;
  const rest = id.slice(CONTACT_STRAIN_PREFIX.length);
  return (unlockedStrainIds(4) as readonly string[]).includes(rest) ? rest as StrainId : null;
}

export interface RewardTriggerInput {
  nodeType: RunNodeType | string;
  nodeId: string;
  depth: number;
  nodesCleared: number;
  isBoss: boolean;
  combatVictory: boolean;
}

export interface ComposedOffer {
  strainId: StrainId | null;
  cardIds: string[];
  diagnostic: string | null;
  rngCursor: number;
}

function definitions(state?: NineStrainRuntimeState): Map<string, UniversalBoonDefinition> {
  return indexDefinitions(getProductionOfferDefinitions(state?.maxAcquisitionWave ?? 1));
}

function liveDefs(state?: NineStrainRuntimeState): readonly UniversalBoonDefinition[] {
  return getProductionOfferDefinitions(state?.maxAcquisitionWave ?? 1);
}

function naturalContactCount(state: NineStrainRuntimeState): number {
  return state.contactedStrains.filter((row) => !row.exceptional).length;
}

function contactedIds(state: NineStrainRuntimeState): StrainId[] {
  return state.contactedStrains.map((row) => row.strainId);
}

function belongsToStrain(def: UniversalBoonDefinition, strainId: StrainId): boolean {
  return def.strainId === strainId || def.secondaryStrainId === strainId;
}

export function rewardSourceId(input: RewardTriggerInput): string {
  return `${input.nodeType}:${input.nodeId}:d${input.depth}`;
}

export function resolveNineStrainRewardTrigger(
  state: NineStrainRuntimeState,
  input: RewardTriggerInput,
): { offer: boolean; kind: NonNullable<NineStrainRuntimeState['acquisition']['pendingOffer']>['kind'] | null } {
  if (state.boonSystemMode !== 'NINE_STRAIN' || state.boonSystemConflict) {
    return { offer: false, kind: null };
  }
  const acq = state.acquisition;
  if (acq.pendingOffer) {
    return { offer: true, kind: acq.pendingOffer.kind };
  }
  const source = rewardSourceId(input);
  if (acq.consumedRewardSourceIds.includes(source)) {
    return { offer: false, kind: null };
  }
  if (input.isBoss || input.nodeType === 'BOSS_COMBAT') {
    if (input.depth >= 3) return { offer: false, kind: null };
    if (input.depth === 1 || input.depth === 2) return { offer: true, kind: 'BOSS_PREMIUM' };
    return { offer: false, kind: null };
  }
  if (input.nodeType === 'ELITE_COMBAT') {
    return { offer: true, kind: 'ELITE_CONTACT' };
  }
  if (!acq.firstOmenClaimed && (
    (input.combatVictory && acq.combatVictories === 0)
    || (input.nodesCleared + 1 >= 2)
  )) {
    return { offer: true, kind: 'FIRST_OMEN_STRAIN' };
  }
  if (input.nodeType === 'VEIL_BLEED_BOON') {
    return { offer: true, kind: 'CONTACT' };
  }
  if (input.combatVictory && (input.nodeType === 'STANDARD_COMBAT' || input.nodeType === 'COMBAT')) {
    const depth = Math.min(3, Math.max(1, input.depth)) as 1 | 2 | 3;
    if (!acq.guaranteedContactClaimedByDepth[depth] && acq.firstOmenClaimed) {
      return { offer: true, kind: 'CONTACT' };
    }
  }
  return { offer: false, kind: null };
}

export function shouldPresentNineStrainReward(
  state: NineStrainRuntimeState,
  input: RewardTriggerInput,
): boolean {
  return resolveNineStrainRewardTrigger(state, input).offer;
}

function eligibilityOptions(
  state: NineStrainRuntimeState,
  extra: {
    premium?: boolean;
    depth?: number;
    weaponFamilyId?: string;
    allowVerdictReplace?: boolean;
  } = {},
): EligibilityOptions {
  return {
    premiumVerdictSource: extra.premium === true,
    allowVerdictReplace: extra.allowVerdictReplace === true || extra.premium === true,
    combatDepth: extra.depth ?? state.counterfate?.combatDepth ?? 1,
    equippedWeaponFamilyId: extra.weaponFamilyId,
    maxAcquisitionWave: state.maxAcquisitionWave ?? 1,
  };
}

function isEligible(
  state: NineStrainRuntimeState,
  defs: Map<string, UniversalBoonDefinition>,
  id: string,
  options: EligibilityOptions,
): boolean {
  return evaluateEligibility(state, defs, id, options).length === 0;
}

function rolePriority(role: UniversalBoonDefinition['role'], boss: boolean): number {
  if (!boss) {
    if (role === 'CORE') return 4;
    if (role === 'SUPPORT') return 3;
    if (role === 'CONVERGENCE') return 2;
    if (role === 'MANIFESTATION') return 1;
    return 0;
  }
  if (role === 'CONVERGENCE') return 5;
  if (role === 'MANIFESTATION') return 4;
  if (role === 'VERDICT') return 4;
  if (role === 'CORE') return 2;
  return 1;
}

function softWeight(
  def: UniversalBoonDefinition,
  state: NineStrainRuntimeState,
  boss: boolean,
  firstOffer: boolean,
): number {
  let weight = 1 + rolePriority(def.role, boss);
  if (firstOffer && def.role === 'CORE') weight += 3;
  const liveCores = Object.values(state.cores).filter(Boolean);
  const prefix = def.strainId === 'COUNTERFATE' ? 'CF_'
    : def.strainId === 'RITUAL_CADENCE' ? 'RC_'
      : def.strainId === 'AFTERIMAGE' ? 'AI_'
        : def.strainId === 'STILLPOINT' ? 'SP_'
          : def.strainId === 'WOUNDWEAVE' ? 'WW_'
            : def.strainId === 'FAULTLINE' ? 'FL_'
              : '';
  if (prefix && liveCores.some((id) => id && id.startsWith(prefix))) {
    weight += 1;
  }
  if (def.role === 'CONVERGENCE') {
    weight += boss ? 2 : 1;
  }
  return weight;
}

function pickWeighted(pool: { id: string; weight: number }[], rng: () => number): string | null {
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, row) => sum + Math.max(0.001, row.weight), 0);
  let roll = rng() * total;
  for (const row of pool) {
    roll -= Math.max(0.001, row.weight);
    if (roll <= 0) return row.id;
  }
  return pool[pool.length - 1]?.id ?? null;
}

function composeForStrain(
  state: NineStrainRuntimeState,
  strainId: StrainId,
  rng: () => number,
  args: {
    boss: boolean;
    depth: number;
    weaponFamilyId?: string;
    firstOffer: boolean;
  },
): string[] {
  const defs = definitions(state);
  const options = eligibilityOptions(state, {
    premium: args.boss,
    depth: args.depth,
    weaponFamilyId: args.weaponFamilyId,
    allowVerdictReplace: args.boss,
  });
  const candidates = liveDefs(state).filter((def) => {
    if (!belongsToStrain(def, strainId)) return false;
    if (def.role === 'VERDICT' && !args.boss) return false;
    if (def.id === CONVERGENCE_IDS.GHOST_THREAD && !loadoutCanMintHostileTrace(state)) return false;
    return isEligible(state, defs, def.id, options);
  });
  const picked: string[] = [];
  const remaining = () => candidates.filter((def) => !picked.includes(def.id));

  const take = (predicate: (def: UniversalBoonDefinition) => boolean) => {
    const pool = remaining()
      .filter(predicate)
      .map((def) => ({
        id: def.id,
        weight: softWeight(def, state, args.boss, args.firstOffer),
      }));
    const id = pickWeighted(pool, rng);
    if (id) picked.push(id);
  };

  if (args.boss) {
    take((def) => def.role === 'CONVERGENCE' || def.role === 'MANIFESTATION' || def.role === 'VERDICT');
  }
  if (args.firstOffer) {
    take((def) => def.role === 'CORE');
    take((def) => def.role === 'CORE' && defs.get(picked[0] ?? '')?.imprint !== def.imprint);
  }
  while (picked.length < 3) {
    const before = picked.length;
    take(() => true);
    if (picked.length === before) break;
  }

  if (args.firstOffer) {
    const cores = picked
      .map((id) => defs.get(id))
      .filter((def): def is UniversalBoonDefinition => def?.role === 'CORE');
    const imprints = new Set(cores.map((def) => def.imprint));
    if (cores.length < 2 || imprints.size < 2) {
      const extra = remaining().filter((def) => def.role === 'CORE' && !imprints.has(def.imprint));
      if (extra[0]) {
        const replaceIndex = picked.findIndex((id) => defs.get(id)?.role !== 'CORE');
        if (replaceIndex >= 0) picked[replaceIndex] = extra[0].id;
        else if (picked.length < 3) picked.push(extra[0].id);
      }
    }
  }

  return picked.slice(0, 3);
}

function composeAcrossContacted(
  state: NineStrainRuntimeState,
  rng: () => number,
  args: {
    boss: boolean;
    depth: number;
    weaponFamilyId?: string;
    firstOffer: boolean;
  },
): string[] {
  const contacted = contactedIds(state);
  if (contacted.length === 0) return [];
  const defs = definitions(state);
  const options = eligibilityOptions(state, {
    premium: args.boss,
    depth: args.depth,
    weaponFamilyId: args.weaponFamilyId,
    allowVerdictReplace: args.boss,
  });
  const candidates = liveDefs(state).filter((def) => {
    if (!contacted.some((id) => belongsToStrain(def, id))) return false;
    if (def.role === 'VERDICT' && !args.boss) return false;
    if (def.id === CONVERGENCE_IDS.GHOST_THREAD && !loadoutCanMintHostileTrace(state)) return false;
    return isEligible(state, defs, def.id, options);
  });
  const picked: string[] = [];
  while (picked.length < 3) {
    const pool = candidates
      .filter((def) => !picked.includes(def.id))
      .map((def) => ({
        id: def.id,
        weight: softWeight(def, state, args.boss, args.firstOffer),
      }));
    const id = pickWeighted(pool, rng);
    if (!id) break;
    picked.push(id);
  }
  return picked.slice(0, 3);
}

export function strainCanComposeThree(
  state: NineStrainRuntimeState,
  strainId: StrainId,
  args: { boss: boolean; depth: number; weaponFamilyId?: string; firstOffer: boolean },
): boolean {
  const rng = createSeededRng(`probe:${strainId}:${args.depth}`);
  return composeForStrain(state, strainId, rng, args).length === 3;
}

function loadoutCanMintHostileTrace(state: NineStrainRuntimeState): boolean {
  const cores = Object.values(state.cores);
  return cores.includes(AFTERIMAGE_CORE_IDS.PHANTOM_IMPACT)
    || cores.includes(AFTERIMAGE_CORE_IDS.LINGERING_INVOCATION)
    || cores.includes(AFTERIMAGE_CORE_IDS.REFLEX_REMNANT);
}

function legalContactStrains(
  state: NineStrainRuntimeState,
  args: { boss: boolean; depth: number; weaponFamilyId?: string; firstOffer: boolean },
): StrainId[] {
  const atCap = naturalContactCount(state) >= 3;
  const unlocked = unlockedStrainIds(clampToProductionWave(state.maxAcquisitionWave));
  const pool: StrainId[] = atCap
    ? contactedIds(state).filter((id) => unlocked.includes(id))
    : unlocked;
  const preferred = args.boss
    ? pool.filter((id) => contactedIds(state).includes(id))
    : pool;
  return preferred.filter((id) => strainCanComposeThree(state, id, args));
}

export function composeThreeCardOffer(
  state: NineStrainRuntimeState,
  identified: StrainId | null,
  seed: string,
  args: { boss: boolean; depth: number; weaponFamilyId?: string; firstOffer: boolean },
): ComposedOffer {
  const rng = createSeededRng(seed);
  let cursor = 0;
  const wrapped = () => {
    cursor += 1;
    return rng();
  };
  const legal = legalContactStrains(state, args);
  const tryOrder: StrainId[] = [];
  if (identified && legal.includes(identified)) tryOrder.push(identified);
  for (const id of legal) {
    if (!tryOrder.includes(id)) tryOrder.push(id);
  }
  for (const strainId of tryOrder) {
    const cards = composeForStrain(state, strainId, wrapped, args);
    if (cards.length === 3 && new Set(cards).size === 3) {
      return { strainId, cardIds: cards, diagnostic: null, rngCursor: cursor };
    }
  }
  const mixed = composeAcrossContacted(state, wrapped, args);
  if (mixed.length === 3 && new Set(mixed).size === 3) {
    return {
      strainId: identified && contactedIds(state).includes(identified) ? identified : contactedIds(state)[0] ?? identified,
      cardIds: mixed,
      diagnostic: null,
      rngCursor: cursor,
    };
  }
  return {
    strainId: identified,
    cardIds: [],
    diagnostic: 'NINE-STRAIN OFFER FAIL-CLOSED — no legal three-card composition.',
    rngCursor: cursor,
  };
}

export function firstOmenStrainIds(
  state: NineStrainRuntimeState,
  depth: number,
  weaponFamilyId?: string,
  seed = 'omen',
): StrainId[] {
  const unlocked = unlockedStrainIds(clampToProductionWave(state.maxAcquisitionWave));
  const legal = unlocked.filter((id) => strainCanComposeThree(state, id, {
    boss: false,
    depth,
    weaponFamilyId,
    firstOffer: true,
  }));
  if (legal.length <= 3) return legal;
  const rng = createSeededRng(`first-omen:${seed}:${legal.join(',')}`);
  const pool = [...legal];
  const picked: StrainId[] = [];
  while (picked.length < 3 && pool.length > 0) {
    const index = Math.floor(rng() * pool.length) % pool.length;
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function replacementPreviewFor(
  state: NineStrainRuntimeState,
  cardIds: readonly string[],
  options: EligibilityOptions,
): Record<string, string> {
  const defs = definitions(state);
  const preview: Record<string, string> = {};
  for (const id of cardIds) {
    const result = previewAcquire(state, defs, id, options);
    const names = result.dependentDisplayNames;
    const parts: string[] = [];
    if (result.overwrittenCoreId) {
      parts.push(`Replaces ${defs.get(result.overwrittenCoreId)?.displayName ?? 'occupied Core'}`);
    }
    if (result.overwrittenVerdictId) {
      parts.push(`Replaces ${defs.get(result.overwrittenVerdictId)?.displayName ?? 'current Verdict'}`);
    }
    if (names.length > 0) {
      parts.push(`Affects ${names.join(', ')}`);
    }
    if (parts.length > 0) preview[id] = parts.join('. ');
  }
  return preview;
}

function roleLabel(role: UniversalBoonDefinition['role']): string {
  if (role === 'CORE') return 'Core';
  if (role === 'SUPPORT') return 'Support';
  if (role === 'MANIFESTATION') return 'Manifestation';
  if (role === 'VERDICT') return 'Verdict';
  return 'Convergence';
}

function imprintLabel(def: UniversalBoonDefinition): string {
  if (def.role !== 'CORE' || !def.imprint) return def.role === 'CONVERGENCE' ? 'No Imprint' : roleLabel(def.role);
  if (def.imprint === 'ARMAMENT') return 'Armament';
  if (def.imprint === 'DISCIPLINE') return 'Discipline';
  if (def.imprint === 'INSTINCT') return 'Instinct';
  return 'Current';
}

export function toNineStrainOffers(
  state: NineStrainRuntimeState,
  classId: ClassType,
  cardIds: readonly string[],
  extra: {
    strainId: StrainId | null;
    kind: string;
    replacementPreview: Readonly<Record<string, string>>;
  },
): PostCombatBoonOffer[] {
  const defs = definitions(state);
  const pool = `${contactedIds(state).length} / 3`;
  const imprintSlots = (['ARMAMENT', 'DISCIPLINE', 'INSTINCT', 'CURRENT'] as const)
    .map((slot) => {
      const owned = state.cores[slot];
      const name = owned ? defs.get(owned)?.displayName ?? 'Occupied' : 'Open';
      const label = slot === 'ARMAMENT' ? 'Armament' : slot === 'DISCIPLINE' ? 'Discipline' : slot === 'INSTINCT' ? 'Instinct' : 'Current';
      return `${label}: ${name}`;
    })
    .join(' · ');
  return cardIds.map((id) => {
    const strainPick = parseContactStrainOfferId(id);
    if (strainPick) {
      return {
        id,
        classId,
        name: STRAIN_DISPLAY_NAMES[strainPick],
        tier: 'CONTACT',
        tierLabel: 'Strain Contact',
        catalog: 'STRAIN_CONTACT',
        strainLabel: STRAIN_DISPLAY_NAMES[strainPick],
        contactedPoolLabel: pool,
        description: `Contact ${STRAIN_DISPLAY_NAMES[strainPick]}. Opens a three-card offer from this Strain. The Strain is added only after a boon is accepted.`,
        effect: 'Choose this Strain to view three legal cards.',
      };
    }
    const def = defs.get(id);
    if (!def) {
      return {
        id,
        classId,
        name: 'Unavailable',
        tier: 'CORE',
        tierLabel: 'Unknown',
        catalog: 'NINE_STRAIN',
        description: 'This card is no longer legal.',
        effect: 'Fail closed.',
      };
    }
    const parentHint = def.role === 'CONVERGENCE' && def.secondaryStrainId
      ? (() => {
        const liveA = Object.values(state.cores).some((id) => id && defs.get(id)?.strainId === def.strainId && defs.get(id)?.role === 'CORE');
        const liveB = Object.values(state.cores).some((id) => id && defs.get(id)?.strainId === def.secondaryStrainId && defs.get(id)?.role === 'CORE');
        return `Requires a live ${STRAIN_DISPLAY_NAMES[def.strainId]} Core (${liveA ? 'live' : 'missing'}) and a live ${STRAIN_DISPLAY_NAMES[def.secondaryStrainId]} Core (${liveB ? 'live' : 'missing'}).`;
      })()
      : '';
    const overwrite = extra.replacementPreview[id] ?? '';
    return {
      id,
      classId,
      name: def.displayName,
      tier: def.role,
      tierLabel: roleLabel(def.role),
      catalog: 'NINE_STRAIN',
      strainLabel: extra.strainId ? STRAIN_DISPLAY_NAMES[extra.strainId] : STRAIN_DISPLAY_NAMES[def.strainId],
      roleLabel: roleLabel(def.role),
      imprintLabel: imprintLabel(def),
      overwritePreview: overwrite || undefined,
      verdictPreview: def.role === 'VERDICT' && state.boundVerdict
        ? `Replaces ${defs.get(state.boundVerdict)?.displayName ?? 'current Verdict'}. Native ultimate rules are unchanged.`
        : undefined,
      prerequisiteHint: parentHint || undefined,
      contactedPoolLabel: `${pool} · ${imprintSlots}`,
      description: [
        def.playerFacingSummary,
        parentHint,
        overwrite,
      ].filter(Boolean).join(' '),
      effect: `${roleLabel(def.role)}${def.imprint ? ` · ${imprintLabel(def)}` : ''}. Trigger and payoff as written.`,
    };
  });
}

export function sealPendingOffer(
  state: NineStrainRuntimeState,
  input: RewardTriggerInput,
  kind: NonNullable<NineStrainRuntimeState['acquisition']['pendingOffer']>['kind'],
  weaponFamilyId?: string,
  identified?: StrainId | null,
): NineStrainRuntimeState {
  const acq = state.acquisition;
  if (acq.pendingOffer) return state;
  const source = rewardSourceId(input);
  const seed = `${source}:${acq.acceptedSelectionCount}:${weaponFamilyId ?? 'none'}`;
  if (kind === 'FIRST_OMEN_STRAIN') {
    const strains = firstOmenStrainIds(state, input.depth, weaponFamilyId, seed);
    return {
      ...state,
      acquisition: {
        ...acq,
        firstOmenPending: true,
        pendingOffer: {
          kind,
          sourceId: source,
          nodeId: input.nodeId,
          depth: input.depth,
          strainId: null,
          cardIds: strains.map(contactStrainOfferId),
          seed,
          rngCursor: 0,
          replacementPreview: {},
          failClosedDiagnostic: strains.length === 3 ? null : 'FIRST OMEN FAIL-CLOSED — Strain Contacts unavailable.',
        },
      },
    };
  }
  const firstOffer = acq.acceptedSelectionCount === 0;
  const composed = composeThreeCardOffer(state, identified ?? pickDirectorStrain(state, input.depth, weaponFamilyId, kind === 'BOSS_PREMIUM'), seed, {
    boss: kind === 'BOSS_PREMIUM',
    depth: input.depth,
    weaponFamilyId,
    firstOffer,
  });
  if (composed.cardIds.length !== 3) {
    return {
      ...state,
      acquisition: {
        ...acq,
        lastFailClosedDiagnostic: composed.diagnostic,
        pendingOffer: {
          kind,
          sourceId: source,
          nodeId: input.nodeId,
          depth: input.depth,
          strainId: composed.strainId,
          cardIds: [],
          seed,
          rngCursor: composed.rngCursor,
          replacementPreview: {},
          failClosedDiagnostic: composed.diagnostic,
        },
      },
    };
  }
  const options = eligibilityOptions(state, {
    premium: kind === 'BOSS_PREMIUM',
    depth: input.depth,
    weaponFamilyId,
  });
  return {
    ...state,
    acquisition: {
      ...acq,
      pendingOffer: {
        kind,
        sourceId: source,
        nodeId: input.nodeId,
        depth: input.depth,
        strainId: composed.strainId,
        cardIds: composed.cardIds,
        seed,
        rngCursor: composed.rngCursor,
        replacementPreview: replacementPreviewFor(state, composed.cardIds, options),
        failClosedDiagnostic: null,
      },
    },
  };
}

function pickDirectorStrain(
  state: NineStrainRuntimeState,
  depth: number,
  weaponFamilyId: string | undefined,
  boss: boolean,
): StrainId | null {
  const legal = legalContactStrains(state, {
    boss,
    depth,
    weaponFamilyId,
    firstOffer: state.acquisition.acceptedSelectionCount === 0,
  });
  const contacted = legal.filter((id) => contactedIds(state).includes(id));
  if (naturalContactCount(state) < 3) {
    const fresh = legal.filter((id) => !contactedIds(state).includes(id));
    return fresh[0] ?? contacted[0] ?? legal[0] ?? null;
  }
  return contacted[0] ?? legal[0] ?? null;
}

export function selectPendingStrain(
  state: NineStrainRuntimeState,
  strainId: StrainId,
  weaponFamilyId?: string,
): NineStrainRuntimeState {
  const pending = state.acquisition.pendingOffer;
  if (!pending || pending.kind !== 'FIRST_OMEN_STRAIN') return state;
  const composed = composeThreeCardOffer(state, strainId, `${pending.seed}:${strainId}`, {
    boss: false,
    depth: pending.depth,
    weaponFamilyId,
    firstOffer: true,
  });
  const options = eligibilityOptions(state, { depth: pending.depth, weaponFamilyId });
  return {
    ...state,
    acquisition: {
      ...state.acquisition,
      pendingOffer: {
        ...pending,
        kind: 'CONTACT',
        strainId,
        cardIds: composed.cardIds,
        rngCursor: composed.rngCursor,
        replacementPreview: replacementPreviewFor(state, composed.cardIds, options),
        failClosedDiagnostic: composed.diagnostic,
      },
    },
  };
}

export function markRewardConsumed(state: NineStrainRuntimeState): NineStrainRuntimeState {
  const pending = state.acquisition.pendingOffer;
  if (!pending) return state;
  const depth = Math.min(3, Math.max(1, pending.depth)) as 1 | 2 | 3;
  const guaranteed = pending.kind === 'CONTACT'
    && !state.acquisition.firstOmenPending
    && !state.acquisition.guaranteedContactClaimedByDepth[depth];
  return {
    ...state,
    acquisition: {
      ...state.acquisition,
      firstOmenClaimed: state.acquisition.firstOmenClaimed || state.acquisition.firstOmenPending || pending.kind === 'FIRST_OMEN_STRAIN',
      firstOmenPending: false,
      guaranteedContactClaimedByDepth: guaranteed
        ? { ...state.acquisition.guaranteedContactClaimedByDepth, [depth]: true }
        : state.acquisition.guaranteedContactClaimedByDepth,
      consumedRewardSourceIds: state.acquisition.consumedRewardSourceIds.includes(pending.sourceId)
        ? state.acquisition.consumedRewardSourceIds
        : [...state.acquisition.consumedRewardSourceIds, pending.sourceId],
      pendingOffer: null,
      acceptedSelectionCount: state.acquisition.acceptedSelectionCount + 1,
    },
  };
}

export function noteCombatVictory(state: NineStrainRuntimeState): NineStrainRuntimeState {
  return {
    ...state,
    acquisition: {
      ...state.acquisition,
      combatVictories: state.acquisition.combatVictories + 1,
    },
  };
}

export function previewEliteContactStrain(args: {
  certainty: ScannerLabelCertainty;
  nodeId: string;
  seed: string;
  maxAcquisitionWave?: 1 | 2 | 3 | 4;
}): string | null {
  if (args.certainty !== 'RELIABLE') return null;
  const pool = unlockedStrainIds(args.maxAcquisitionWave ?? NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE);
  const rng = createSeededRng(`elite-preview:${args.nodeId}:${args.seed}`);
  const index = Math.floor(rng() * pool.length) % pool.length;
  return STRAIN_DISPLAY_NAMES[pool[index]];
}

export function elitePreviewRevealed(certainty: ScannerLabelCertainty | string | null | undefined): boolean {
  return certainty === 'RELIABLE';
}

export function eliteStrainIntelLine(args: {
  nodeType: string;
  certainty: ScannerLabelCertainty | string | null | undefined;
  nodeId: string;
  seed: string;
}): string | null {
  const elite = args.nodeType === 'ELITE_COMBAT' || args.nodeType === 'ELITE';
  if (!elite) return null;
  const name = previewEliteContactStrain({
    certainty: (args.certainty === 'RELIABLE' ? 'RELIABLE' : 'DEGRADED'),
    nodeId: args.nodeId,
    seed: args.seed,
  });
  if (!name || !elitePreviewRevealed(args.certainty)) return null;
  return `> IDENTIFIED STRAIN: ${name.toUpperCase()}`;
}
