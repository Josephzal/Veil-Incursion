import type { NarrativeChoiceEffectPreview, NarrativeEventNode } from '../types/game';

type ChoiceKey = 'A' | 'B';

export type CityChoiceEffectPreview = NarrativeChoiceEffectPreview;

type CityEventPreviews = Record<ChoiceKey, CityChoiceEffectPreview>;

const CITY_CHOICE_PREVIEWS: Record<string, CityEventPreviews> = {
  'city-01': {
    A: { onSuccess: '+5% Max Shield', onFailure: '-10% Current Shield' },
    B: { onSuccess: '+10% Current Energy', onFailure: '-5% Max HP' },
  },
  'city-02': {
    A: { guaranteed: '-10% Current Shield · FLAG: saved_operative' },
    B: { guaranteed: '+10% Crypto-Glimmer · FLAG: looted_operative' },
  },
  'city-03': {
    A: { onSuccess: 'Next depth: Sanctuary route', onFailure: 'Combat ambush' },
    B: { guaranteed: '+5% Max Shield / -5% Max Stamina' },
  },
  'city-04': {
    A: { onSuccess: '+10% Current Energy · FLAG: void_attuned', onFailure: '-10% Current HP' },
    B: { guaranteed: '+5% Max Stamina / -5% Max Shield' },
  },
  'city-05': {
    A: { onSuccess: '+10% combat damage (next fight)', onFailure: '-10% Current HP' },
    B: { onSuccess: '+5% Crypto-Glimmer', onFailure: 'No reward' },
  },
  'city-07': {
    A: { onSuccess: '+15% Shield Integrity', onFailure: '-10% Current HP' },
    B: { guaranteed: '-5% Max Stamina · FLAG: shattered_focus_lens' },
  },
  'city-08': {
    A: { onSuccess: '+20% Energy', onFailure: '-15% Current HP' },
    B: { onSuccess: '+10% crit damage (next 3 combats)', onFailure: '-30% Crypto-Glimmer' },
  },
  'city-09': {
    A: { onSuccess: '+20% Crypto-Glimmer', onFailure: '-5% Current HP / -10% Current Shield' },
    B: { guaranteed: '+15% Current HP' },
  },
  'city-10': {
    A: { onSuccess: '+20% Shield Integrity', onFailure: 'Combat ambush' },
    B: { onSuccess: 'FLAG: scavengers_eye', onFailure: 'Combat ambush' },
  },
  'city-11': {
    A: { onSuccess: 'FLAG: focused_sight', onFailure: 'No reward' },
    B: { guaranteed: '-15% Stamina / +15% stability (next 2 combats)' },
  },
  'city-12': {
    A: { onSuccess: 'FLAG: hallowed_rosary', onFailure: '-15% HP · Combat ambush' },
    B: { guaranteed: '+10% HP · Enemies +10% damage (3 nodes) · FLAG: haunted_echo' },
  },
  'city-13': {
    A: { guaranteed: '+15% Max Shield' },
    B: { onSuccess: '+30% Energy', onFailure: '-10% Current HP / -10% Current Shield' },
  },
  'city-14': {
    A: { guaranteed: '+20% Max Stamina' },
    B: { onSuccess: 'FLAG: void_weft_tonal', onFailure: '-15% Current HP' },
  },
  'city-15': {
    A: { onSuccess: '+10% Energy', onFailure: 'No reward' },
    B: { guaranteed: '+15% Crypto-Glimmer / -15% Current Stamina' },
  },
  'city-16': {
    A: { onSuccess: '+20% Shield / +30% Crypto-Glimmer', onFailure: '-15% Current HP' },
    B: { guaranteed: '+30% Energy' },
  },
  'city-17': {
    A: { onSuccess: '+10% Max HP', onFailure: '-10% Max Stamina' },
    B: { guaranteed: '+40% Crypto-Glimmer' },
  },
  'city-18': {
    A: { onSuccess: 'FLAG: intel_override', onFailure: '-10% Current Shield' },
    B: { onSuccess: '+20% Max Stamina', onFailure: 'No reward' },
  },
  'city-19': {
    A: { onSuccess: '+15% Max Shield', onFailure: '-10% Current HP' },
    B: { guaranteed: '+25% Energy' },
  },
  'city-20': {
    A: { guaranteed: '-10% Current Shield / +15% boss damage' },
    B: { onSuccess: '+50% Crypto-Glimmer', onFailure: 'Combat ambush' },
  },
};

/** Flag-dependent previews for conditional city chain events. */
export function getCity06ChoicePreview(collectedFlags: readonly string[]): CityChoiceEffectPreview {
  if (collectedFlags.includes('saved_operative')) {
    return { guaranteed: '+5% Max Stamina (saved_operative flag)' };
  }
  if (collectedFlags.includes('looted_operative')) {
    return { guaranteed: '-10% Current Shield (looted_operative flag)' };
  }
  return { guaranteed: 'Resolves from operative flag (city-02 choice)' };
}

export function getCityStreetsChoicePreview(
  matrixId: string,
  choice: ChoiceKey,
  collectedFlags: readonly string[] = [],
): CityChoiceEffectPreview | null {
  if (matrixId === 'city-06') {
    return getCity06ChoicePreview(collectedFlags);
  }
  return CITY_CHOICE_PREVIEWS[matrixId]?.[choice] ?? null;
}

export function applyCityStreetsChoicePreviews(
  node: NarrativeEventNode,
  collectedFlags: readonly string[] = [],
): NarrativeEventNode {
  const matrixId = node.matrixEventId ?? node.id;
  if (!matrixId.startsWith('city-')) return node;

  const previewA = getCityStreetsChoicePreview(matrixId, 'A', collectedFlags);
  const previewB = getCityStreetsChoicePreview(matrixId, 'B', collectedFlags);

  return {
    ...node,
    choiceA: { ...node.choiceA, effectPreview: previewA ?? undefined },
    choiceB: { ...node.choiceB, effectPreview: previewB ?? undefined },
  };
}
