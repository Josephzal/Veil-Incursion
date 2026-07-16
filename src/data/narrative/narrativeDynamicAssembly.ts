import type { ClassType } from '../../types/game';
import type {
  BruteForceResolver,
  Cabal,
  ComplicationSeed,
  ContextSeed,
  ItemResolver,
  MechanicResolver,
  NarrativePenalty,
  NarrativeReward,
  OptionBResolver,
  ResolverSet,
} from '../../types/narrativeAssembly';
import {
  EXPANSION_RESOLVER_TEMPLATES,
  getExpansionResolverTemplateById,
  type ExpansionResolverTemplate,
} from './narrativeDnDExpansion';
import { hashSeed, pickFromPool } from './narrativeAssemblyCore';
import { pickActiveGenerationTensionMechanic } from './tensionMechanicRouting';

const EXPANSION_CABAL_MAP: Record<string, Cabal> = {
  SOLARIS: 'Solaris',
  TERRAN_GRID: 'Terran_Grid',
  LEGION: 'Legion',
  VOID_WEAVERS: 'Void_Weavers',
  THE_SYNDICATE: 'The_Syndicate',
  AEGIS_VANGUARD: 'Aegis_Vanguard',
};

export function formatPenaltyPreview(penalty: NarrativePenalty): string {
  if (penalty.type === 'HP') return `Cost: ${penalty.amount} HP`;
  return `Cost: +${penalty.amount} Resonance`;
}

export function formatRewardPreview(reward?: NarrativeReward): string {
  if (!reward) return 'Reward: Secured route';
  switch (reward.type) {
    case 'CREDITS':
      return `Reward: ${reward.amount} Credits`;
    case 'VEIL_RESIDUE':
      return `Reward: ${reward.amount} Veil Residue`;
    case 'RESOURCES':
      return `Reward: Resource cache (${reward.amount})`;
    case 'INTEL':
      return `Reward: Encrypted intel (${reward.amount})`;
    case 'ENCRYPTED_GRID_DRIVE':
      return `Reward: Encrypted Grid Drive (${reward.amount})`;
    case 'ANOMALOUS_CORE':
      return `Reward: Anomalous Core (${reward.amount})`;
    case 'LEY_SLAG':
      return `Reward: Ley Slag (${reward.amount})`;
    default:
      return `Reward: ${reward.type} (${reward.amount})`;
  }
}

export function creditsFromReward(reward?: NarrativeReward): number {
  if (!reward) return 0;
  if (reward.type === 'CREDITS') return reward.amount;
  return 0;
}

function buildMechanicOption(complication: ComplicationSeed, seed: string): MechanicResolver {
  // Do not include Mechanic_ScavengeBar in new generation pools (deprecated).
  // Tech / encrypted terminal / locked cache / black-site → Mechanic_CipherRite via routing.
  const tensionMechanic = pickActiveGenerationTensionMechanic(
    hashSeed(`${seed}:mechanic-a`),
    {
      flavorText: `${complication.id} ${complication.flavorText}`,
      tags: complication.requiredTags,
    },
  );
  const costPreview = formatPenaltyPreview(complication.defaultPenalty);
  const rewardPreview = formatRewardPreview(complication.defaultReward);
  if (tensionMechanic == null) {
    return {
      text: `Secure the cache. (${rewardPreview})`,
      onSuccess: rewardPreview,
      onFailure: costPreview,
    };
  }
  return {
    text: `Execute tension protocol. (${rewardPreview} // on fail: ${costPreview})`,
    tensionMechanic,
    onSuccess: rewardPreview,
    onFailure: costPreview,
  };
}

function buildBruteForceOption(complication: ComplicationSeed): BruteForceResolver {
  const costPreview = formatPenaltyPreview(complication.defaultPenalty);
  const rewardPreview = formatRewardPreview(complication.defaultReward);
  return {
    type: 'BruteForce',
    text: `Push through the hazard. (${costPreview} // ${rewardPreview})`,
    onSuccess: `${costPreview} — ${rewardPreview}`,
  };
}

function rewardSuccessText(complication: ComplicationSeed): string {
  return formatRewardPreview(complication.defaultReward);
}

function templateToOptionB(
  template: ExpansionResolverTemplate,
  complication: ComplicationSeed,
): OptionBResolver {
  const onSuccess = rewardSuccessText(complication);
  if (template.requires.type === 'CLASS') {
    return {
      text: template.text,
      requirementType: 'Class',
      requirementValue: template.requires.value as ClassType,
      onSuccess,
    };
  }
  return {
    text: template.text,
    requirementType: 'Cabal',
    requirementValue: EXPANSION_CABAL_MAP[template.requires.value] ?? 'Neutral',
    onSuccess,
  };
}

function templateToOptionC(
  template: ExpansionResolverTemplate,
  complication: ComplicationSeed,
): ItemResolver {
  return {
    text: template.text,
    requirementType: 'Item',
    requirementValue: template.requires.value,
    onSuccess: rewardSuccessText(complication),
  };
}

export interface DynamicAssemblySelection {
  cabalTemplateId: string;
  itemTemplateId: string;
}

export function pickDynamicResolverTemplates(seed: string): DynamicAssemblySelection {
  const cabalPool = EXPANSION_RESOLVER_TEMPLATES.filter(
    (entry) => entry.requires.type === 'CABAL' || entry.requires.type === 'CLASS',
  );
  const itemPool = EXPANSION_RESOLVER_TEMPLATES.filter((entry) => entry.requires.type === 'ITEM');
  const cabalTemplate = pickFromPool(cabalPool, `${seed}:cabal`, [], (entry) => entry.id);
  const itemTemplate = pickFromPool(itemPool, `${seed}:item`, [], (entry) => entry.id);
  return { cabalTemplateId: cabalTemplate.id, itemTemplateId: itemTemplate.id };
}

export function assembleDynamicResolverSet(
  complication: ComplicationSeed,
  seed: string,
  selection?: DynamicAssemblySelection,
): ResolverSet {
  const picked = selection ?? pickDynamicResolverTemplates(seed);
  const cabalTemplate = getExpansionResolverTemplateById(picked.cabalTemplateId);
  const itemTemplate = getExpansionResolverTemplateById(picked.itemTemplateId);
  if (!cabalTemplate || !itemTemplate) {
    throw new Error(`assembleDynamicResolverSet: missing templates for ${complication.id}`);
  }

  return {
    id: `dyn-${complication.id}-${hashSeed(seed)}`,
    complicationId: complication.id,
    optionA: buildMechanicOption(complication, seed),
    optionB: templateToOptionB(cabalTemplate, complication),
    optionC: templateToOptionC(itemTemplate, complication),
    optionD: buildBruteForceOption(complication),
    assemblyMode: 'dynamic-v2',
  };
}

export function reassembleDynamicResolverSet(
  context: ContextSeed,
  complication: ComplicationSeed,
  selection: DynamicAssemblySelection,
  seed: string,
): ResolverSet {
  void context;
  return assembleDynamicResolverSet(complication, seed, selection);
}

export function formatCriticalHazard(penalty: NarrativePenalty): string {
  if (penalty.type === 'HP') {
    return `[CRITICAL HAZARD: PROCEEDING WILL COST ${penalty.amount} HP]`;
  }
  return `[CRITICAL HAZARD: PROCEEDING WILL COST +${penalty.amount} RESONANCE]`;
}
