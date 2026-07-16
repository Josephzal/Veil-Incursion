/**
 * Cipher Rite — pure narrative hacking / occult decryption engine.
 * No run-state mutation. Deterministic when seeded.
 */

import { hashSeed } from '../../../data/narrative/narrativeAssemblyCore';

export type CipherRiteDifficulty = 'LOW' | 'MEDIUM' | 'HIGH' | 'APEX';

export type CipherCorruptionProfile = 'mild' | 'moderate' | 'strong' | 'apex';

export interface CipherRitePuzzle {
  puzzleId: string;
  correctCipher: string;
  candidates: readonly string[];
  maxAttempts: number;
  difficulty: CipherRiteDifficulty;
  corruptionProfile: CipherCorruptionProfile;
  cipherLength: number;
}

export interface CipherGuessScore {
  alignedCount: number;
  totalCount: number;
  isCorrect: boolean;
}

export interface GenerateCipherRitePuzzleOptions {
  difficulty?: CipherRiteDifficulty;
  seed?: string;
  candidateCount?: number;
  cipherLength?: number;
  maxAttempts?: number;
}

/** Veil-flavored cipher phrase pool (uppercase, single spaces). */
export const CIPHER_PHRASE_POOL: readonly string[] = [
  'NULL GATE',
  'ASH VEIN',
  'BLACK STATIC',
  'MIRROR BONE',
  'SAINT LOCK',
  'HOLLOW SIGNAL',
  'RIFT CROWN',
  'DEAD FREQUENCY',
  'LEY WOUND',
  'ECHO KEY',
  'VEIL INDEX',
  'GRAVE CIRCUIT',
  'ANCHOR THREAD',
  'CIPHER ASH',
  'BLOOD CHANNEL',
  'GLASS SIGIL',
  'STATIC BONE',
  'NULL CROWN',
  'ASHEN GATE',
  'MIRROR LOCK',
  'BLACK VEIN',
  'VOID INDEX',
  'GRID WOUND',
  'SAINT ASH',
  'HOLLOW KEY',
  'RIFT SIGNAL',
  'ECHO CROWN',
  'LEY STATIC',
  'GLASS BONE',
  'VEIL CROWN',
  'GRAVE LOCK',
  'ANCHOR ASH',
  // Extra short/mid phrases so LOW/MEDIUM can pad without truncating.
  'NULL KEY',
  'ASH LOCK',
  'VOID GATE',
  'LEY KEY',
  'RIFT ASH',
  'ECHO LOCK',
  'GRID KEY',
  'VEIL ASH',
  'BONE GATE',
  'SIGIL KEY',
  'DEAD LOCK',
  'STATIC KEY',
  // Length ≤ 6 for LOW cipherLength targets.
  'ASH KEY',
  'LEY CUT',
  'VOID ID',
  'RIFT',
  'NULL',
  'GATE',
  'SIGIL',
  'BONE',
  'VEIL',
  'ECHO',
  'GRID',
  'LOCK',
] as const;

interface DifficultyConfig {
  candidateCount: number;
  cipherLength: number;
  maxAttempts: number;
  corruptionProfile: CipherCorruptionProfile;
}

const DIFFICULTY_CONFIG: Record<CipherRiteDifficulty, DifficultyConfig> = {
  LOW: { candidateCount: 6, cipherLength: 6, maxAttempts: 4, corruptionProfile: 'mild' },
  MEDIUM: { candidateCount: 8, cipherLength: 8, maxAttempts: 4, corruptionProfile: 'moderate' },
  HIGH: { candidateCount: 10, cipherLength: 10, maxAttempts: 4, corruptionProfile: 'strong' },
  APEX: { candidateCount: 12, cipherLength: 11, maxAttempts: 5, corruptionProfile: 'apex' },
};

function normalizePhrase(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Pad or trim to exact glyph length for fair positional scoring. */
export function normalizeCipherLength(phrase: string, length: number): string {
  const cleaned = normalizePhrase(phrase);
  if (cleaned.length === length) return cleaned;
  if (cleaned.length > length) return cleaned.slice(0, length);
  return cleaned.padEnd(length, ' ');
}

function seededPick<T>(pool: readonly T[], seed: string, salt: string): T {
  if (pool.length === 0) {
    throw new Error('seededPick: empty pool');
  }
  const index = hashSeed(`${seed}:${salt}`) % pool.length;
  return pool[index]!;
}

function shuffleDeterministic<T>(items: readonly T[], seed: string): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = hashSeed(`${seed}:swap:${i}`) % (i + 1);
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return next;
}

/**
 * Build a same-length phrase set. Only pad pool phrases (never truncate mid-word).
 * Extra candidates come from deterministic near-miss mutations.
 */
function buildLengthBucket(cipherLength: number, seed: string): string[] {
  const seen = new Set<string>();
  const bucket: string[] = [];

  const padFriendly = CIPHER_PHRASE_POOL
    .map((phrase) => normalizePhrase(phrase))
    .filter((cleaned) => cleaned.length > 0 && cleaned.length <= cipherLength)
    .sort((a, b) => (cipherLength - a.length) - (cipherLength - b.length) || a.localeCompare(b));

  for (const cleaned of padFriendly) {
    const normalized = normalizeCipherLength(cleaned, cipherLength);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    bucket.push(normalized);
  }

  // Guarantee enough unique candidates via deterministic near-misses.
  let salt = 0;
  const basePool = bucket.length > 0
    ? bucket
    : [normalizeCipherLength(seededPick(CIPHER_PHRASE_POOL, seed, 'fallback'), cipherLength)];
  while (bucket.length < 16) {
    const base = seededPick(basePool, seed, `fill-base:${salt}`);
    const mutated = mutateCipher(base, seed, salt);
    if (!seen.has(mutated) && mutated.length === cipherLength) {
      seen.add(mutated);
      bucket.push(mutated);
    }
    salt += 1;
    if (salt > 200) break;
  }

  return bucket;
}

const GLYPH_SWAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';

function mutateCipher(source: string, seed: string, salt: number): string {
  const chars = source.split('');
  const swaps = 2 + (hashSeed(`${seed}:mut-count:${salt}`) % 3);
  for (let i = 0; i < swaps; i += 1) {
    const idx = hashSeed(`${seed}:mut-idx:${salt}:${i}`) % chars.length;
    const glyphIdx = hashSeed(`${seed}:mut-glyph:${salt}:${i}`) % GLYPH_SWAP.length;
    chars[idx] = GLYPH_SWAP[glyphIdx]!;
  }
  return chars.join('');
}

export function scoreCipherGuess(guess: string, correctCipher: string): CipherGuessScore {
  const totalCount = Math.max(guess.length, correctCipher.length);
  const a = normalizeCipherLength(guess, totalCount);
  const b = normalizeCipherLength(correctCipher, totalCount);
  let alignedCount = 0;
  for (let i = 0; i < totalCount; i += 1) {
    if (a[i] === b[i]) alignedCount += 1;
  }
  return {
    alignedCount,
    totalCount,
    isCorrect: a === b,
  };
}

export function formatCipherAlignmentFeedback(score: CipherGuessScore): string {
  return `${score.alignedCount} / ${score.totalCount} glyphs aligned`;
}

export function generateCipherRitePuzzle(
  options: GenerateCipherRitePuzzleOptions = {},
): CipherRitePuzzle {
  const difficulty = options.difficulty ?? 'MEDIUM';
  const config = DIFFICULTY_CONFIG[difficulty];
  const seed = options.seed ?? `cipher-rite:${difficulty}:default`;
  const candidateCount = options.candidateCount ?? config.candidateCount;
  const cipherLength = options.cipherLength ?? config.cipherLength;
  const maxAttempts = options.maxAttempts ?? config.maxAttempts;

  const bucket = buildLengthBucket(cipherLength, seed);
  const shuffled = shuffleDeterministic(bucket, `${seed}:shuffle`);
  const correctCipher = shuffled[0] ?? normalizeCipherLength('NULL GATE', cipherLength);

  const candidates: string[] = [correctCipher];
  const seen = new Set<string>([correctCipher]);
  for (const entry of shuffled.slice(1)) {
    if (candidates.length >= candidateCount) break;
    if (seen.has(entry)) continue;
    seen.add(entry);
    candidates.push(entry);
  }

  let fillSalt = 0;
  while (candidates.length < candidateCount) {
    const miss = mutateCipher(correctCipher, seed, fillSalt);
    fillSalt += 1;
    if (seen.has(miss)) continue;
    seen.add(miss);
    candidates.push(miss);
    if (fillSalt > 300) break;
  }

  const ordered = shuffleDeterministic(candidates, `${seed}:order`);

  return {
    puzzleId: `cipher-${hashSeed(seed).toString(36)}`,
    correctCipher,
    candidates: ordered,
    maxAttempts,
    difficulty,
    corruptionProfile: config.corruptionProfile,
    cipherLength,
  };
}

/** Map procedural depth (1–3) to Cipher Rite difficulty. */
export function cipherDifficultyFromDepth(depth: number | null | undefined): CipherRiteDifficulty {
  if (depth == null || !Number.isFinite(depth)) return 'MEDIUM';
  if (depth <= 1) return 'LOW';
  if (depth === 2) return 'MEDIUM';
  if (depth === 3) return 'HIGH';
  return 'APEX';
}

/** Corruption intensity 0–1 from wrong-guess count and profile. */
export function corruptionLevelForAttempts(
  wrongGuesses: number,
  maxAttempts: number,
  profile: CipherCorruptionProfile,
): number {
  const base =
    profile === 'mild' ? 0.12
      : profile === 'moderate' ? 0.18
        : profile === 'strong' ? 0.26
          : 0.32;
  const step =
    profile === 'mild' ? 0.12
      : profile === 'moderate' ? 0.16
        : profile === 'strong' ? 0.18
          : 0.14;
  const spent = Math.max(0, wrongGuesses);
  const capped = Math.min(1, base + spent * step);
  // Soft ceiling so text stays readable even at max attempts.
  const readableCap = profile === 'apex' ? 0.72 : 0.65;
  void maxAttempts;
  return Math.min(readableCap, capped);
}
