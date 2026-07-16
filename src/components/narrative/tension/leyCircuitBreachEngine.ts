/**
 * Ley Circuit Breach — pure engine for the 6×6 polarity routing puzzle
 * (Mechanic_LeyCircuitBreach). Force a corrupted signal from a Source Sigil
 * (left edge) to an Exit Seal (right edge) so it arrives connected AND in the
 * required Grid/Veil polarity. Inverter glyphs flip polarity in transit.
 *
 * Deterministic when seeded. No run-state mutation.
 *
 * Directions: 0=N, 1=E, 2=S, 3=W. Grid is row-major, index = row*size + col.
 */

import { hashSeed } from '../../../data/narrative/narrativeAssemblyCore';

export type Polarity = 'GRID' | 'VEIL';

export type LeyTileKind =
  | 'STRAIGHT'
  | 'ELBOW'
  | 'T'
  | 'CROSS'
  | 'INVERTER'
  | 'BLOCKER';

export interface LeyTile {
  kind: LeyTileKind;
  /** 0..3 — number of 90° clockwise rotations from the base shape. */
  rotation: number;
}

export interface LeyBoard {
  size: number;
  tiles: LeyTile[];
  sourceRow: number;
  exitRow: number;
  sourcePolarity: Polarity;
  requiredPolarity: Polarity;
  /** Solution rotations aligned to `tiles` (path cells authoritative). */
  solutionRotations: number[];
  /** Indices that form the intended solution conduit. */
  pathCells: number[];
}

export interface LeyFlowResult {
  /** Every cell the signal reaches from the source (full connected network). */
  energized: number[];
  depth: Record<number, number>;
  /** Side (0=N,1=E,2=S,3=W) the signal entered each energized cell from. */
  enterSide: Record<number, number>;
  polarityOut: Record<number, Polarity>;
  maxDepth: number;
  exitCell: number;
  exitConnected: boolean;
  deliveredPolarity: Polarity | null;
  exitDepth: number | null;
  success: boolean;
}

export const LEY_CIRCUIT_CONFIG = {
  size: 6,
  traceTimerSec: 75,
  gracePeriodSec: 3,
  signalStepSec: 0.65,
  shortCircuitTrace: 0.15,
  maxShortCircuits: 3,
} as const;

/** Base connections [N,E,S,W] at rotation 0. */
const BASE_CONNECTIONS: Record<LeyTileKind, readonly [boolean, boolean, boolean, boolean]> = {
  STRAIGHT: [true, false, true, false],
  ELBOW: [true, true, false, false],
  T: [true, true, true, false],
  CROSS: [true, true, true, true],
  INVERTER: [true, false, true, false],
  BLOCKER: [false, false, false, false],
};

/** Rotational symmetry period (identical appearance every `period` steps). */
export function symmetryPeriod(kind: LeyTileKind): number {
  switch (kind) {
    case 'STRAIGHT':
    case 'INVERTER':
      return 2;
    case 'ELBOW':
    case 'T':
      return 4;
    case 'CROSS':
    case 'BLOCKER':
    default:
      return 1;
  }
}

export function isRotatable(kind: LeyTileKind): boolean {
  return kind !== 'BLOCKER' && kind !== 'CROSS';
}

export function flipPolarity(p: Polarity): Polarity {
  return p === 'GRID' ? 'VEIL' : 'GRID';
}

function mod4(n: number): number {
  return ((n % 4) + 4) % 4;
}

/** Connected sides [N,E,S,W] for a tile at its current rotation. */
export function connectedSides(tile: LeyTile): [boolean, boolean, boolean, boolean] {
  const base = BASE_CONNECTIONS[tile.kind];
  const r = mod4(tile.rotation);
  return [
    base[mod4(0 - r)],
    base[mod4(1 - r)],
    base[mod4(2 - r)],
    base[mod4(3 - r)],
  ];
}

function opposite(dir: number): number {
  return (dir + 2) % 4;
}

function neighbor(row: number, col: number, dir: number): { row: number; col: number } {
  switch (dir) {
    case 0: return { row: row - 1, col };
    case 1: return { row, col: col + 1 };
    case 2: return { row: row + 1, col };
    default: return { row, col: col - 1 };
  }
}

/** Smallest CW taps to make `from` look like `to` (respecting symmetry). */
export function tapsToSolution(kind: LeyTileKind, from: number, to: number): number {
  const period = symmetryPeriod(kind);
  return ((to - from) % period + period) % period;
}

/** Find the rotation whose connected sides match the requested side set. */
function rotationForSides(kind: LeyTileKind, sides: readonly boolean[]): number {
  for (let r = 0; r < 4; r += 1) {
    const test = connectedSides({ kind, rotation: r });
    if (test.every((v, i) => v === sides[i])) return r;
  }
  return 0;
}

/**
 * Simulate the signal flooding out from the Source Sigil. First-arrival BFS
 * fixes each cell's polarity; inverters flip polarity as the signal passes.
 */
export function computeLeyFlow(board: LeyBoard): LeyFlowResult {
  const { size, tiles } = board;
  const idx = (r: number, c: number): number => r * size + c;
  const sourceCell = idx(board.sourceRow, 0);
  const exitCell = idx(board.exitRow, size - 1);

  const depth: Record<number, number> = {};
  const enterSideMap: Record<number, number> = {};
  const polarityOut: Record<number, Polarity> = {};

  interface Entry { cell: number; enterSide: number; pIn: Polarity; d: number }
  const queue: Entry[] = [
    { cell: sourceCell, enterSide: 3, pIn: board.sourcePolarity, d: 0 },
  ];

  while (queue.length > 0) {
    const { cell, enterSide, pIn, d } = queue.shift()!;
    if (polarityOut[cell] !== undefined) continue;
    const tile = tiles[cell]!;
    const sides = connectedSides(tile);
    if (!sides[enterSide]) continue; // cannot accept signal from this side

    const pOut = tile.kind === 'INVERTER' ? flipPolarity(pIn) : pIn;
    polarityOut[cell] = pOut;
    depth[cell] = d;
    enterSideMap[cell] = enterSide;

    const row = Math.floor(cell / size);
    const col = cell % size;
    for (let dir = 0; dir < 4; dir += 1) {
      if (dir === enterSide || !sides[dir]) continue;
      const nb = neighbor(row, col, dir);
      if (nb.row < 0 || nb.row >= size || nb.col < 0 || nb.col >= size) continue;
      const nCell = idx(nb.row, nb.col);
      if (polarityOut[nCell] !== undefined) continue;
      const nSides = connectedSides(tiles[nCell]!);
      if (!nSides[opposite(dir)]) continue; // pipes must meet
      queue.push({ cell: nCell, enterSide: opposite(dir), pIn: pOut, d: d + 1 });
    }
  }

  const energized = Object.keys(polarityOut).map(Number);
  const maxDepth = energized.reduce((m, c) => Math.max(m, depth[c] ?? 0), 0);
  const exitVisited = polarityOut[exitCell] !== undefined;
  const exitEastOpen = connectedSides(tiles[exitCell]!)[1];
  const exitConnected = exitVisited && exitEastOpen;
  const deliveredPolarity = exitVisited ? polarityOut[exitCell]! : null;
  const success = exitConnected && deliveredPolarity === board.requiredPolarity;

  return {
    energized,
    depth,
    enterSide: enterSideMap,
    polarityOut,
    maxDepth,
    exitCell,
    exitConnected,
    deliveredPolarity,
    exitDepth: exitVisited ? depth[exitCell]! : null,
    success,
  };
}

function makeRng(seed: string): () => number {
  let s = hashSeed(seed) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function dirBetween(from: { row: number; col: number }, to: { row: number; col: number }): number {
  if (to.row < from.row) return 0;
  if (to.col > from.col) return 1;
  if (to.row > from.row) return 2;
  return 3;
}

interface BuiltPath {
  cells: { row: number; col: number }[];
}

/** Left→right self-avoiding walk (never moves left) from source to exit rows. */
function buildPath(size: number, sourceRow: number, exitRow: number, rng: () => number): BuiltPath {
  const cells: { row: number; col: number }[] = [];
  let row = sourceRow;
  let col = 0;
  const visited = new Set<string>();
  const push = (r: number, c: number): void => {
    cells.push({ row: r, col: c });
    visited.add(`${r},${c}`);
  };
  push(row, col);

  while (col < size - 1) {
    const homing = col === size - 2;
    if (homing) {
      while (row !== exitRow) {
        row += Math.sign(exitRow - row);
        push(row, col);
      }
      col += 1;
      push(row, col);
      break;
    }
    // Optional vertical detour to add turns/straights.
    if (rng() < 0.5) {
      const dir = rng() < 0.5 ? -1 : 1;
      const steps = 1 + (rng() < 0.5 ? 0 : 1);
      for (let i = 0; i < steps; i += 1) {
        const nr = row + dir;
        if (nr < 0 || nr >= size || visited.has(`${nr},${col}`)) break;
        row = nr;
        push(row, col);
      }
    }
    col += 1;
    push(row, col);
  }

  return { cells };
}

interface BuildAttempt {
  board: LeyBoard;
  solutionRotations: number[];
}

function tryBuildBoard(
  seed: string,
  size: number,
  rng: () => number,
): BuildAttempt | null {
  const sourceRow = Math.floor(rng() * size);
  const exitRow = Math.floor(rng() * size);
  const sourcePolarity: Polarity = rng() < 0.5 ? 'GRID' : 'VEIL';
  const requiredPolarity: Polarity = rng() < 0.5 ? 'GRID' : 'VEIL';

  const { cells } = buildPath(size, sourceRow, exitRow, rng);
  if (cells.length < 4) return null;

  const idx = (r: number, c: number): number => r * size + c;
  const pathIndex = new Set(cells.map((p) => idx(p.row, p.col)));

  // Determine, per path cell, the two open sides (toward prev/next + edges).
  const openSides: boolean[][] = cells.map(() => [false, false, false, false]);
  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i]!;
    if (i === 0) {
      openSides[i]![3] = true; // West → Source Sigil
    } else {
      openSides[i]![dirBetween(cell, cells[i - 1]!)] = true;
    }
    if (i === cells.length - 1) {
      openSides[i]![1] = true; // East → Exit Seal
    } else {
      openSides[i]![dirBetween(cell, cells[i + 1]!)] = true;
    }
  }

  // Straight path cells (opposite openings) are eligible for inverters.
  const straightPathPositions: number[] = [];
  openSides.forEach((sides, i) => {
    const [n, e, s, w] = sides;
    if ((n && s && !e && !w) || (e && w && !n && !s)) straightPathPositions.push(i);
  });

  // Parity: same polarity → even inverters; different → odd.
  const needOdd = sourcePolarity !== requiredPolarity;
  const maxInv = straightPathPositions.length;
  let inverterCount = needOdd ? 1 : 0;
  if (maxInv >= 3 && rng() < 0.5) inverterCount = needOdd ? 3 : 2;
  else if (maxInv >= 2 && !needOdd && rng() < 0.5) inverterCount = 2;
  if (inverterCount > maxInv) inverterCount = needOdd ? (maxInv >= 1 ? 1 : -1) : 0;
  if (inverterCount < 0) return null; // need at least 1 straight for odd parity

  // Pick inverter positions from straight path cells.
  const inverterPositions = new Set<number>();
  const shuffledStraights = [...straightPathPositions];
  for (let i = shuffledStraights.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledStraights[i], shuffledStraights[j]] = [shuffledStraights[j]!, shuffledStraights[i]!];
  }
  for (let i = 0; i < inverterCount; i += 1) inverterPositions.add(shuffledStraights[i]!);

  // Build tiles.
  const tiles: LeyTile[] = Array.from({ length: size * size }, () => ({
    kind: 'BLOCKER' as LeyTileKind,
    rotation: 0,
  }));
  const solutionRotations: number[] = new Array(size * size).fill(0);

  // Path tiles: straight/elbow (or inverter) with the exact solution rotation.
  cells.forEach((cell, i) => {
    const flat = idx(cell.row, cell.col);
    const sides = openSides[i]!;
    const isStraight = (sides[0] && sides[2] && !sides[1] && !sides[3])
      || (sides[1] && sides[3] && !sides[0] && !sides[2]);
    const kind: LeyTileKind = inverterPositions.has(i)
      ? 'INVERTER'
      : isStraight ? 'STRAIGHT' : 'ELBOW';
    const rotation = rotationForSides(kind, sides);
    tiles[flat] = { kind, rotation };
    solutionRotations[flat] = rotation;
  });

  // Non-path cells: decoy conduits + 4–6 blockers.
  const nonPath: number[] = [];
  for (let i = 0; i < size * size; i += 1) if (!pathIndex.has(i)) nonPath.push(i);
  for (let i = nonPath.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [nonPath[i], nonPath[j]] = [nonPath[j]!, nonPath[i]!];
  }
  const blockerCount = 4 + Math.floor(rng() * 3); // 4..6
  const decoyKinds: LeyTileKind[] = ['STRAIGHT', 'ELBOW', 'ELBOW', 'T', 'STRAIGHT', 'CROSS'];
  nonPath.forEach((flat, i) => {
    if (i < blockerCount) {
      tiles[flat] = { kind: 'BLOCKER', rotation: 0 };
      solutionRotations[flat] = 0;
    } else {
      const kind = decoyKinds[Math.floor(rng() * decoyKinds.length)]!;
      const rotation = Math.floor(rng() * 4);
      tiles[flat] = { kind, rotation };
      solutionRotations[flat] = rotation;
    }
  });

  const board: LeyBoard = {
    size,
    tiles,
    sourceRow,
    exitRow,
    sourcePolarity,
    requiredPolarity,
    solutionRotations,
    pathCells: cells.map((p) => idx(p.row, p.col)),
  };

  // Verify the intended solution actually succeeds.
  const solved = board.tiles.map((t, i) => ({ ...t, rotation: solutionRotations[i]! }));
  const checkBoard: LeyBoard = { ...board, tiles: solved };
  if (!computeLeyFlow(checkBoard).success) return null;

  return { board, solutionRotations };
}

function rotationsNeededOnPath(board: LeyBoard): number {
  return board.pathCells.reduce((sum, flat) => {
    const tile = board.tiles[flat]!;
    return sum + tapsToSolution(tile.kind, tile.rotation, board.solutionRotations[flat]!);
  }, 0);
}

function randomizePathRotations(board: LeyBoard, rng: () => number): void {
  for (const flat of board.pathCells) {
    const tile = board.tiles[flat]!;
    if (!isRotatable(tile.kind)) continue;
    tile.rotation = Math.floor(rng() * 4);
  }
}

/**
 * Generate a solvable Ley Circuit Breach board. Solution-first: build the path,
 * satisfy polarity parity, add decoys/blockers, then scramble rotations so the
 * board is not already solved and needs ~8–16 rotations.
 */
export function generateLeyCircuitBoard(seed = 'ley:default'): LeyBoard {
  const size = LEY_CIRCUIT_CONFIG.size;
  let fallback: LeyBoard | null = null;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const rng = makeRng(`${seed}:build:${attempt}`);
    const built = tryBuildBoard(seed, size, rng);
    if (!built) continue;
    const { board } = built;

    for (let scramble = 0; scramble < 40; scramble += 1) {
      const rng2 = makeRng(`${seed}:scramble:${attempt}:${scramble}`);
      randomizePathRotations(board, rng2);
      if (computeLeyFlow(board).success) continue; // must not start solved
      const need = rotationsNeededOnPath(board);
      if (need >= 8 && need <= 16) {
        return board;
      }
      if (need >= 4 && !fallback) {
        fallback = { ...board, tiles: board.tiles.map((t) => ({ ...t })) };
      }
    }
  }

  if (fallback) return fallback;

  // Last-resort guaranteed board (straight horizontal corridor, no inverters).
  return buildFallbackBoard(seed, size);
}

function buildFallbackBoard(seed: string, size: number): LeyBoard {
  const rng = makeRng(`${seed}:fallback`);
  const row = Math.floor(rng() * size);
  const pol: Polarity = rng() < 0.5 ? 'GRID' : 'VEIL';
  const tiles: LeyTile[] = Array.from({ length: size * size }, () => ({
    kind: 'BLOCKER' as LeyTileKind,
    rotation: 0,
  }));
  const solutionRotations = new Array(size * size).fill(0);
  const pathCells: number[] = [];
  for (let c = 0; c < size; c += 1) {
    const flat = row * size + c;
    const sol = rotationForSides('STRAIGHT', [false, true, false, true]); // E+W
    tiles[flat] = { kind: 'STRAIGHT', rotation: (sol + 1) % 2 === 0 ? 1 : (sol + 1) % 4 };
    solutionRotations[flat] = sol;
    pathCells.push(flat);
  }
  const board: LeyBoard = {
    size,
    tiles,
    sourceRow: row,
    exitRow: row,
    sourcePolarity: pol,
    requiredPolarity: pol,
    solutionRotations,
    pathCells,
  };
  return board;
}

export function polarityLabel(p: Polarity): string {
  return p === 'GRID' ? 'GRID' : 'VEIL';
}
