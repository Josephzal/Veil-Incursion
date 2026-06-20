import type { DistrictId } from './districtPacing';

export type EncounterOrigin = 'CABAL' | 'VEIL';

const COMBAT_NODES_PER_DEPTH = 11;

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function shuffleDeck<T>(items: T[], seed: string): T[] {
  const rand = seededRandom(seed);
  const deck = [...items];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function breakAdjacentCabal(deck: EncounterOrigin[]): EncounterOrigin[] {
  const next = [...deck];
  for (let i = 1; i < next.length; i += 1) {
    if (next[i] === 'CABAL' && next[i - 1] === 'CABAL') {
      const swapIdx = next.findIndex((v, idx) => idx > i && v === 'VEIL');
      if (swapIdx >= 0) {
        [next[i], next[swapIdx]] = [next[swapIdx], next[i]];
      }
    }
  }
  return next;
}

export function cabalPctForDepth(district: DistrictId): number {
  return district === 3 ? 0.15 : 0.35;
}

export function buildOriginDeck(district: DistrictId, seed: string): EncounterOrigin[] {
  const cabalPct = cabalPctForDepth(district);
  const cabalCount = Math.round(COMBAT_NODES_PER_DEPTH * cabalPct);
  const veilCount = Math.max(0, COMBAT_NODES_PER_DEPTH - cabalCount);
  const raw: EncounterOrigin[] = [
    ...Array(cabalCount).fill('CABAL' as const),
    ...Array(veilCount).fill('VEIL' as const),
  ];
  const shuffled = shuffleDeck(raw, `${seed}:origin-deck:d${district}`);
  return breakAdjacentCabal(shuffled);
}

export function peekEncounterOrigin(
  deck: EncounterOrigin[],
  combatEncounterIndex: number,
  district: DistrictId,
  lastOrigin: EncounterOrigin | null,
  seed: string,
): EncounterOrigin {
  if (combatEncounterIndex < deck.length) {
    return deck[combatEncounterIndex];
  }
  let p = cabalPctForDepth(district);
  if (lastOrigin === 'CABAL') p *= 0.25;
  const rand = seededRandom(`${seed}:origin-fallback:${combatEncounterIndex}`);
  return rand() < p ? 'CABAL' : 'VEIL';
}
