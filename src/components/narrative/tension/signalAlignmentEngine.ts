/**
 * Veil Lock — glyph-key insertion puzzle engine for Mechanic_SignalAlignment.
 *
 * The player slots limited, rotatable glyph keys into concentric rings to route
 * a signal from the outer ring to the core. Each key is consumed on use. Rings
 * complete outer → inner. Puzzles are generated solution-first, so a valid path
 * always exists. Deterministic when seeded. No run-state mutation.
 *
 * (Player-facing title is VEIL LOCK; internal names keep the SignalAlignment
 * identifiers so the Mechanic_SignalAlignment routing/imports stay stable.)
 */

import { hashSeed } from '../../../data/narrative/narrativeAssemblyCore';

export type SignalAlignmentDifficulty = 'LOW' | 'MEDIUM' | 'HIGH' | 'APEX';

/** Occult "frequency" glyph families for key art variety. */
export type VeilGlyphFamily = 'NULL' | 'ASH' | 'BONE' | 'VEIL' | 'ECHO';

export interface VeilLockRing {
  ringIndex: number;
  socketCount: number;
  /** Sockets that must be filled to complete the ring (open conduit gaps). */
  requiredSockets: number[];
  /** Sockets already filled by inserted keys. */
  filledSockets: number[];
  complete: boolean;
}

export interface VeilGlyphKey {
  keyId: string;
  /** Normalized tooth offsets (smallest = 0). Occupied = (tooth + rotation) mod socketCount. */
  teeth: number[];
  family: VeilGlyphFamily;
  currentRotation: number;
  used: boolean;
  /** Ring index this key was inserted into (for per-ring reset). */
  usedOnRing?: number;
  decoy: boolean;
}

export interface VeilLockPuzzle {
  puzzleId: string;
  difficulty: SignalAlignmentDifficulty;
  socketCount: number;
  rings: VeilLockRing[];
  keys: VeilGlyphKey[];
  currentRingIndex: number;
  maxResets: number;
  resetsUsed: number;
}

export type VeilFitReason = 'FITS' | 'BLOCKED' | 'OVERLAP' | 'USED' | 'RING_DONE';

export interface VeilFitResult {
  fits: boolean;
  reason: VeilFitReason;
  /** Absolute sockets the key would occupy at its current rotation. */
  occupied: number[];
}

/** Back-compat alias for older imports. */
export type SignalAlignmentPuzzle = VeilLockPuzzle;

export interface GenerateVeilLockOptions {
  difficulty?: SignalAlignmentDifficulty;
  seed?: string;
  ringCount?: number;
  socketCount?: number;
  maxResets?: number;
}

/** Back-compat alias for older imports. */
export type GenerateSignalAlignmentOptions = GenerateVeilLockOptions;

interface DifficultyPreset {
  ringCount: number;
  socketCount: number;
  requiredPerRing: number;
  /** Max teeth per solution key (arc chunk size). */
  pieceMax: number;
  decoyCount: number;
  maxResets: number;
}

const PRESETS: Record<SignalAlignmentDifficulty, DifficultyPreset> = {
  LOW: {
    ringCount: 2,
    socketCount: 8,
    requiredPerRing: 3,
    pieceMax: 3,
    decoyCount: 1,
    maxResets: 3,
  },
  MEDIUM: {
    ringCount: 2,
    socketCount: 8,
    requiredPerRing: 4,
    pieceMax: 2,
    decoyCount: 1,
    maxResets: 2,
  },
  HIGH: {
    ringCount: 3,
    socketCount: 10,
    requiredPerRing: 4,
    pieceMax: 2,
    decoyCount: 2,
    maxResets: 2,
  },
  APEX: {
    ringCount: 3,
    socketCount: 12,
    requiredPerRing: 4,
    pieceMax: 2,
    decoyCount: 2,
    maxResets: 1,
  },
};

const FAMILIES: readonly VeilGlyphFamily[] = ['NULL', 'ASH', 'BONE', 'VEIL', 'ECHO'];

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function degreesPerSocket(socketCount: number): number {
  return 360 / socketCount;
}

/** Absolute sockets a key occupies at a given rotation. */
export function keyOccupiedSockets(
  key: Pick<VeilGlyphKey, 'teeth'>,
  rotation: number,
  socketCount: number,
): number[] {
  return key.teeth.map((t) => mod(t + rotation, socketCount)).sort((a, b) => a - b);
}

export function isRingComplete(ring: VeilLockRing): boolean {
  return ring.requiredSockets.every((s) => ring.filledSockets.includes(s));
}

export function isPuzzleComplete(puzzle: VeilLockPuzzle): boolean {
  return puzzle.rings.every((r) => isRingComplete(r));
}

export function activeRing(puzzle: VeilLockPuzzle): VeilLockRing | undefined {
  return puzzle.rings[puzzle.currentRingIndex];
}

/**
 * Evaluate whether a key (at its current rotation) can be inserted into the
 * active ring. FITS only if every tooth lands on an unfilled REQUIRED socket.
 */
export function evaluateKeyFit(
  puzzle: VeilLockPuzzle,
  key: VeilGlyphKey,
  rotationOverride?: number,
): VeilFitResult {
  const ring = activeRing(puzzle);
  const rotation = rotationOverride ?? key.currentRotation;
  const occupied = keyOccupiedSockets(key, rotation, puzzle.socketCount);

  if (key.used) return { fits: false, reason: 'USED', occupied };
  if (!ring || ring.complete) return { fits: false, reason: 'RING_DONE', occupied };

  for (const socket of occupied) {
    if (ring.filledSockets.includes(socket)) {
      return { fits: false, reason: 'OVERLAP', occupied };
    }
    if (!ring.requiredSockets.includes(socket)) {
      return { fits: false, reason: 'BLOCKED', occupied };
    }
  }
  return { fits: true, reason: 'FITS', occupied };
}

export function rotateKey(key: VeilGlyphKey, delta: number, socketCount: number): VeilGlyphKey {
  return { ...key, currentRotation: mod(key.currentRotation + delta, socketCount) };
}

/**
 * Insert a key into the active ring if it fits. Returns a new puzzle with the
 * key consumed, sockets filled, and ring/currentRingIndex advanced if complete.
 * Returns null when the key does not fit (caller shows the fit reason).
 */
export function insertKey(puzzle: VeilLockPuzzle, keyId: string): VeilLockPuzzle | null {
  const key = puzzle.keys.find((k) => k.keyId === keyId);
  if (!key) return null;
  const fit = evaluateKeyFit(puzzle, key);
  if (!fit.fits) return null;

  const ringIndex = puzzle.currentRingIndex;
  const rings = puzzle.rings.map((ring) => {
    if (ring.ringIndex !== ringIndex) return ring;
    const filledSockets = [...ring.filledSockets, ...fit.occupied].sort((a, b) => a - b);
    const complete = ring.requiredSockets.every((s) => filledSockets.includes(s));
    return { ...ring, filledSockets, complete };
  });

  const keys = puzzle.keys.map((k) =>
    k.keyId === keyId ? { ...k, used: true, usedOnRing: ringIndex } : k,
  );

  let nextRingIndex = ringIndex;
  const insertedRing = rings[ringIndex];
  if (insertedRing?.complete) {
    const nextIncomplete = rings.findIndex((r, i) => i > ringIndex && !r.complete);
    nextRingIndex = nextIncomplete === -1 ? ringIndex : nextIncomplete;
  }

  return { ...puzzle, rings, keys, currentRingIndex: nextRingIndex };
}

/** Any unused key that fits the active ring at any rotation? */
export function hasAnyValidMove(puzzle: VeilLockPuzzle): boolean {
  const ring = activeRing(puzzle);
  if (!ring || ring.complete) return true;
  return puzzle.keys.some((key) => {
    if (key.used) return false;
    for (let r = 0; r < puzzle.socketCount; r += 1) {
      if (evaluateKeyFit(puzzle, key, r).fits) return true;
    }
    return false;
  });
}

/** Dead-end: current ring incomplete and no unused key can fit it. */
export function isDeadEnd(puzzle: VeilLockPuzzle): boolean {
  if (isPuzzleComplete(puzzle)) return false;
  return !hasAnyValidMove(puzzle);
}

/**
 * Reset the active ring's fills to empty and return the keys spent on it to the
 * unused pool. Earlier completed rings stay locked. Costs one reset.
 */
export function resetActiveRing(puzzle: VeilLockPuzzle): VeilLockPuzzle | null {
  if (puzzle.resetsUsed >= puzzle.maxResets) return null;
  const ringIndex = puzzle.currentRingIndex;
  const rings = puzzle.rings.map((ring) =>
    ring.ringIndex === ringIndex
      ? { ...ring, filledSockets: [], complete: false }
      : ring,
  );
  const keys = puzzle.keys.map((k) =>
    k.usedOnRing === ringIndex
      ? { ...k, used: false, usedOnRing: undefined }
      : k,
  );
  return {
    ...puzzle,
    rings,
    keys,
    resetsUsed: puzzle.resetsUsed + 1,
  };
}

function familyForSeed(seed: string, salt: number): VeilGlyphFamily {
  return FAMILIES[hashSeed(`${seed}:fam:${salt}`) % FAMILIES.length]!;
}

/** Split a contiguous required arc into chunks of size 2..pieceMax. */
function chunkArc(arc: number[], pieceMax: number, seed: string, ringIndex: number): number[][] {
  const chunks: number[][] = [];
  let i = 0;
  let salt = 0;
  while (i < arc.length) {
    const remaining = arc.length - i;
    let size = Math.min(pieceMax, remaining);
    // Prefer size 2 when pieceMax is 2; otherwise vary 2..pieceMax for texture.
    if (pieceMax > 2 && remaining > pieceMax) {
      size = 2 + (hashSeed(`${seed}:chunk:${ringIndex}:${salt}`) % (pieceMax - 1));
    }
    // Avoid leaving a lonely size-1 tail: merge if it would strand a single.
    if (remaining - size === 1) size = remaining;
    chunks.push(arc.slice(i, i + size));
    i += size;
    salt += 1;
  }
  return chunks;
}

export function generateVeilLockPuzzle(
  options: GenerateVeilLockOptions = {},
): VeilLockPuzzle {
  const difficulty = options.difficulty ?? 'MEDIUM';
  const preset = PRESETS[difficulty];
  const seed = options.seed ?? `veil-lock:${difficulty}:default`;
  const ringCount = options.ringCount ?? preset.ringCount;
  const socketCount = options.socketCount ?? preset.socketCount;
  const maxResets = options.maxResets ?? preset.maxResets;

  const rings: VeilLockRing[] = [];
  const solutionKeys: VeilGlyphKey[] = [];
  let famSalt = 0;

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const start = hashSeed(`${seed}:arc:${ringIndex}`) % socketCount;
    const len = preset.requiredPerRing;
    const arc: number[] = [];
    for (let k = 0; k < len; k += 1) arc.push(mod(start + k, socketCount));
    // Required list is the arc (sorted for stable display/compare).
    const requiredSockets = [...arc].sort((a, b) => a - b);

    rings.push({
      ringIndex,
      socketCount,
      requiredSockets,
      filledSockets: [],
      complete: false,
    });

    // Solution keys tile the arc exactly (in arc order, not sorted).
    const chunks = chunkArc(arc, preset.pieceMax, seed, ringIndex);
    chunks.forEach((chunk, ci) => {
      const base = chunk[0]!;
      const teeth = chunk.map((s) => mod(s - base, socketCount)).sort((a, b) => a - b);
      solutionKeys.push({
        keyId: `k-${ringIndex}-${ci}`,
        teeth,
        family: familyForSeed(seed, famSalt++),
        currentRotation: hashSeed(`${seed}:rot:${ringIndex}:${ci}`) % socketCount,
        used: false,
        decoy: false,
      });
    });
  }

  // Decoy keys: shapes that generally waste or mislead. Non-contiguous teeth so
  // they rarely tile an arc cleanly (they can still "fit" — fit != correct).
  const decoyKeys: VeilGlyphKey[] = [];
  for (let d = 0; d < preset.decoyCount; d += 1) {
    const size = 2 + (hashSeed(`${seed}:decoy:size:${d}`) % 2); // 2..3
    const teeth = [0];
    let gapSalt = 0;
    while (teeth.length < size) {
      const gap = 2 + (hashSeed(`${seed}:decoy:gap:${d}:${gapSalt}`) % 2); // gap of 2..3
      const nextTooth = teeth[teeth.length - 1]! + gap;
      if (nextTooth >= socketCount) break;
      teeth.push(nextTooth);
      gapSalt += 1;
    }
    decoyKeys.push({
      keyId: `d-${d}`,
      teeth,
      family: familyForSeed(seed, famSalt++),
      currentRotation: hashSeed(`${seed}:decoy:rot:${d}`) % socketCount,
      used: false,
      decoy: true,
    });
  }

  // Shuffle keys deterministically.
  const allKeys = [...solutionKeys, ...decoyKeys];
  const keys = shuffleDeterministic(allKeys, `${seed}:shuffle`);

  const puzzle: VeilLockPuzzle = {
    puzzleId: `veil-${hashSeed(seed).toString(36)}`,
    difficulty,
    socketCount,
    rings,
    keys,
    currentRingIndex: 0,
    maxResets,
    resetsUsed: 0,
  };

  return puzzle;
}

/** Back-compat alias — older code imported generateSignalAlignmentPuzzle. */
export const generateSignalAlignmentPuzzle = generateVeilLockPuzzle;

function shuffleDeterministic<T>(items: readonly T[], seed: string): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = hashSeed(`${seed}:${i}`) % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export function fitReasonLabel(reason: VeilFitReason): string {
  switch (reason) {
    case 'FITS': return 'KEY FITS';
    case 'BLOCKED': return 'SOCKET BLOCKED';
    case 'OVERLAP': return 'GLYPH OVERLAP';
    case 'USED': return 'KEY SPENT';
    case 'RING_DONE': return 'RING COMPLETE';
    default: return '';
  }
}

export function signalDifficultyFromDepth(depth: number | null | undefined): SignalAlignmentDifficulty {
  if (depth == null || !Number.isFinite(depth)) return 'MEDIUM';
  if (depth <= 1) return 'LOW';
  if (depth === 2) return 'MEDIUM';
  if (depth === 3) return 'HIGH';
  return 'APEX';
}
