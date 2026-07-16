/**
 * Shadowline Ascent — pure engine for the turn-based stealth minigame
 * (Mechanic_ShadowlineAscent). The Runner Trace climbs a vertical 3-lane × 9-step
 * detection shaft from the bottom-centre to the Exit Glyph at the top without
 * reaching 3 Exposure.
 *
 * Turn-based: every action (Ascend / Shift / Wait) advances detection by one
 * beat, then detection resolves against the Runner's new cell. Shadow Pockets
 * negate detection; the one-use Dampener makes a single action ignore detection.
 *
 * Deterministic when seeded. No run-state mutation. Fixed standard difficulty —
 * randomization comes from the exit lane, cover placement, scan timing, and the
 * safe route, never from depth/class scaling. Boards are solver-validated at
 * generation time so every board is fair (solvable at 0 Exposure, ideal route
 * 9–14 actions, cover meaningful, pure "ascend every turn" never a clean win).
 */

import { hashSeed } from '../../../data/narrative/narrativeAssemblyCore';

export type ShadowlineActionKind = 'ASCEND' | 'SHIFT_LEFT' | 'SHIFT_RIGHT' | 'WAIT';
export type ShadowlineDangerKind = 'CROSS' | 'WATCH' | 'SIGIL';
export type ShadowlineStatus = 'PLAYING' | 'SUCCESS' | 'FAILURE';

export interface ShadowCell {
  lane: number;
  row: number;
}

/** Horizontal red scanline that sweeps one row across all three lanes. */
export interface CrossScanPattern {
  period: number;
  phase: number;
  rows: number[];
}

/** A single lane becomes watched (whole column) for a beat. */
export interface LaneWatchPattern {
  period: number;
  phase: number;
  lanes: number[];
}

/** A single step is armed, then detonates one beat later. */
export interface SigilPulsePattern {
  period: number;
  phase: number;
  cells: ShadowCell[];
}

export interface ShadowlineBoard {
  boardId: string;
  exitLane: number;
  /** `${lane}:${row}` keys of Shadow Pockets. */
  shadowPockets: string[];
  crossScan: CrossScanPattern;
  laneWatch: LaneWatchPattern;
  sigilPulse: SigilPulsePattern;
}

export interface ShadowlineState {
  lane: number;
  row: number;
  /** Beats resolved so far (0 at start). Next action resolves at beat+1. */
  beat: number;
  exposure: number;
  dampCharges: number;
  status: ShadowlineStatus;
}

export interface BeatDangers {
  crossRow: number | null;
  watchLane: number | null;
  sigilCells: ShadowCell[];
}

export interface ShadowlineResolveResult {
  next: ShadowlineState;
  hit: boolean;
  hitKinds: ShadowlineDangerKind[];
  reachedExit: boolean;
  /** True if the Dampener was consumed by this action. */
  dampConsumed: boolean;
}

export const SHADOWLINE_CONFIG = {
  lanes: 3,
  steps: 9, // rows 0 (bottom) .. 8 (top / exit row)
  startLane: 1,
  startRow: 0,
  exitRow: 8,
  exposureLimit: 3,
  shadowPocketCount: 5,
  dampenerCharges: 1,
  minIdealActions: 9,
  maxIdealActions: 14,
  minUsefulPockets: 2,
  maxSearchBeat: 26,
} as const;

export function cellKey(lane: number, row: number): string {
  return `${lane}:${row}`;
}

export function isExitCell(board: ShadowlineBoard, lane: number, row: number): boolean {
  return lane === board.exitLane && row === SHADOWLINE_CONFIG.exitRow;
}

export function isShadowPocket(board: ShadowlineBoard, lane: number, row: number): boolean {
  return board.shadowPockets.includes(cellKey(lane, row));
}

function firesAt(period: number, phase: number, beat: number): number | null {
  if (beat < 1 || beat < phase) return null;
  if ((beat - phase) % period !== 0) return null;
  return (beat - phase) / period;
}

/** Resolved danger set active at a given beat (used for resolution + UI preview). */
export function dangersAtBeat(board: ShadowlineBoard, beat: number): BeatDangers {
  const cs = firesAt(board.crossScan.period, board.crossScan.phase, beat);
  const crossRow = cs != null && board.crossScan.rows.length > 0
    ? board.crossScan.rows[cs % board.crossScan.rows.length]!
    : null;

  const lw = firesAt(board.laneWatch.period, board.laneWatch.phase, beat);
  const watchLane = lw != null && board.laneWatch.lanes.length > 0
    ? board.laneWatch.lanes[lw % board.laneWatch.lanes.length]!
    : null;

  const sp = firesAt(board.sigilPulse.period, board.sigilPulse.phase, beat);
  const sigilCells = sp != null && board.sigilPulse.cells.length > 0
    ? [board.sigilPulse.cells[sp % board.sigilPulse.cells.length]!]
    : [];

  return { crossRow, watchLane, sigilCells };
}

/** Which detection kinds threaten (lane,row) at this beat (ignoring cover). */
export function dangerKindsAtCell(
  board: ShadowlineBoard,
  beat: number,
  lane: number,
  row: number,
): ShadowlineDangerKind[] {
  const d = dangersAtBeat(board, beat);
  const kinds: ShadowlineDangerKind[] = [];
  if (d.crossRow === row) kinds.push('CROSS');
  if (d.watchLane === lane) kinds.push('WATCH');
  if (d.sigilCells.some((c) => c.lane === lane && c.row === row)) kinds.push('SIGIL');
  return kinds;
}

export function initialShadowlineState(): ShadowlineState {
  return {
    lane: SHADOWLINE_CONFIG.startLane,
    row: SHADOWLINE_CONFIG.startRow,
    beat: 0,
    exposure: 0,
    dampCharges: SHADOWLINE_CONFIG.dampenerCharges,
    status: 'PLAYING',
  };
}

function actionTarget(state: ShadowlineState, action: ShadowlineActionKind): ShadowCell | null {
  switch (action) {
    case 'ASCEND':
      return state.row < SHADOWLINE_CONFIG.exitRow ? { lane: state.lane, row: state.row + 1 } : null;
    case 'SHIFT_LEFT':
      return state.lane > 0 ? { lane: state.lane - 1, row: state.row } : null;
    case 'SHIFT_RIGHT':
      return state.lane < SHADOWLINE_CONFIG.lanes - 1 ? { lane: state.lane + 1, row: state.row } : null;
    case 'WAIT':
    default:
      return { lane: state.lane, row: state.row };
  }
}

export function isActionLegal(state: ShadowlineState, action: ShadowlineActionKind): boolean {
  if (state.status !== 'PLAYING') return false;
  return actionTarget(state, action) != null;
}

/**
 * Resolve one action. The Runner moves, detection advances a beat, and the new
 * cell is checked. Shadow Pockets and (once) the Dampener negate a hit.
 */
export function applyShadowlineAction(
  board: ShadowlineBoard,
  state: ShadowlineState,
  action: ShadowlineActionKind,
  useDamp: boolean,
): ShadowlineResolveResult {
  const target = actionTarget(state, action);
  if (state.status !== 'PLAYING' || target == null) {
    return { next: state, hit: false, hitKinds: [], reachedExit: false, dampConsumed: false };
  }

  const beat = state.beat + 1;
  const canDamp = useDamp && state.dampCharges > 0;
  const dampCharges = canDamp ? state.dampCharges - 1 : state.dampCharges;

  if (isExitCell(board, target.lane, target.row)) {
    return {
      next: { ...state, lane: target.lane, row: target.row, beat, dampCharges, status: 'SUCCESS' },
      hit: false,
      hitKinds: [],
      reachedExit: true,
      dampConsumed: canDamp,
    };
  }

  const inShadow = isShadowPocket(board, target.lane, target.row);
  const kinds = dangerKindsAtCell(board, beat, target.lane, target.row);
  const hit = kinds.length > 0 && !inShadow && !canDamp;
  const exposure = state.exposure + (hit ? 1 : 0);
  const status: ShadowlineStatus = exposure >= SHADOWLINE_CONFIG.exposureLimit ? 'FAILURE' : 'PLAYING';

  return {
    next: { ...state, lane: target.lane, row: target.row, beat, exposure, dampCharges, status },
    hit,
    hitKinds: hit ? kinds : [],
    reachedExit: false,
    dampConsumed: canDamp,
  };
}

// --- Solver (generation-time validation) ------------------------------------

const ACTIONS: readonly ShadowlineActionKind[] = ['ASCEND', 'SHIFT_LEFT', 'SHIFT_RIGHT', 'WAIT'];

interface SearchNode {
  lane: number;
  row: number;
  beat: number;
  dampUsed: boolean;
  exposure: number;
  actions: number;
}

interface PathStep {
  lane: number;
  row: number;
  beat: number;
  damped: boolean;
}

export interface ShadowlineSolution {
  exposure: number;
  actions: number;
  path: PathStep[];
}

function nodeKey(lane: number, row: number, beat: number, dampUsed: boolean): string {
  return `${lane}:${row}:${beat}:${dampUsed ? 1 : 0}`;
}

/**
 * Dijkstra over (lane,row,beat,dampUsed) minimising (exposure, actions).
 * Returns the lexicographically-best route to the Exit Glyph, or null.
 */
export function solveShadowline(board: ShadowlineBoard, allowDamp: boolean): ShadowlineSolution | null {
  const start: SearchNode = {
    lane: SHADOWLINE_CONFIG.startLane,
    row: SHADOWLINE_CONFIG.startRow,
    beat: 0,
    dampUsed: false,
    exposure: 0,
    actions: 0,
  };
  const cost = (n: SearchNode): number => n.exposure * 100000 + n.actions;

  const best = new Map<string, number>();
  const parent = new Map<string, { key: string | null; step: PathStep | null }>();
  const startKey = nodeKey(start.lane, start.row, start.beat, start.dampUsed);
  best.set(startKey, cost(start));
  parent.set(startKey, { key: null, step: null });

  // Simple array-backed priority queue (state space is tiny).
  const queue: SearchNode[] = [start];

  const popMin = (): SearchNode | undefined => {
    let bi = -1;
    let bc = Infinity;
    for (let i = 0; i < queue.length; i += 1) {
      const c = cost(queue[i]!);
      if (c < bc) {
        bc = c;
        bi = i;
      }
    }
    if (bi < 0) return undefined;
    return queue.splice(bi, 1)[0];
  };

  while (queue.length > 0) {
    const cur = popMin()!;
    const curKey = nodeKey(cur.lane, cur.row, cur.beat, cur.dampUsed);
    if (cost(cur) > (best.get(curKey) ?? Infinity)) continue;

    if (cur.row === SHADOWLINE_CONFIG.exitRow && cur.lane === board.exitLane) {
      // Reconstruct path.
      const path: PathStep[] = [];
      let k: string | null = curKey;
      while (k != null) {
        const p = parent.get(k);
        if (!p) break;
        if (p.step) path.push(p.step);
        k = p.key;
      }
      path.reverse();
      return { exposure: cur.exposure, actions: cur.actions, path };
    }

    if (cur.beat >= SHADOWLINE_CONFIG.maxSearchBeat) continue;

    const beat = cur.beat + 1;
    for (const action of ACTIONS) {
      const target = actionTarget({ ...initialShadowlineState(), lane: cur.lane, row: cur.row }, action);
      if (!target) continue;

      const isExit = isExitCell(board, target.lane, target.row);
      const dangerous = !isExit
        && !isShadowPocket(board, target.lane, target.row)
        && dangerKindsAtCell(board, beat, target.lane, target.row).length > 0;

      // Normal (undampened) transition.
      const addExp = dangerous ? 1 : 0;
      if (cur.exposure + addExp < SHADOWLINE_CONFIG.exposureLimit) {
        const nn: SearchNode = {
          lane: target.lane,
          row: target.row,
          beat,
          dampUsed: cur.dampUsed,
          exposure: cur.exposure + addExp,
          actions: cur.actions + 1,
        };
        const nk = nodeKey(nn.lane, nn.row, nn.beat, nn.dampUsed);
        if (cost(nn) < (best.get(nk) ?? Infinity)) {
          best.set(nk, cost(nn));
          parent.set(nk, { key: curKey, step: { lane: nn.lane, row: nn.row, beat: nn.beat, damped: false } });
          queue.push(nn);
        }
      }

      // Dampened transition (once) — only meaningful when it prevents a hit.
      if (allowDamp && !cur.dampUsed && dangerous) {
        const nn: SearchNode = {
          lane: target.lane,
          row: target.row,
          beat,
          dampUsed: true,
          exposure: cur.exposure,
          actions: cur.actions + 1,
        };
        const nk = nodeKey(nn.lane, nn.row, nn.beat, nn.dampUsed);
        if (cost(nn) < (best.get(nk) ?? Infinity)) {
          best.set(nk, cost(nn));
          parent.set(nk, { key: curKey, step: { lane: nn.lane, row: nn.row, beat: nn.beat, damped: true } });
          queue.push(nn);
        }
      }
    }
  }

  return null;
}

/** Count distinct Shadow Pockets that actually saved the route from a hit. */
function usefulPocketsOnPath(board: ShadowlineBoard, path: PathStep[]): number {
  const used = new Set<string>();
  for (const step of path) {
    if (step.damped) continue;
    if (!isShadowPocket(board, step.lane, step.row)) continue;
    if (dangerKindsAtCell(board, step.beat, step.lane, step.row).length > 0) {
      used.add(cellKey(step.lane, step.row));
    }
  }
  return used.size;
}

/** Does a naive "ascend every turn" (no shifting/damp) cleanly reach the exit? */
function pureAscendCleanWin(board: ShadowlineBoard): boolean {
  let state = initialShadowlineState();
  for (let i = 0; i < SHADOWLINE_CONFIG.steps; i += 1) {
    if (!isActionLegal(state, 'ASCEND')) break;
    const res = applyShadowlineAction(board, state, 'ASCEND', false);
    state = res.next;
    if (res.reachedExit) return state.exposure === 0;
    if (res.hit) return false;
    if (state.status === 'FAILURE') return false;
  }
  return false;
}

// --- Board generation -------------------------------------------------------

interface Rng {
  next: () => number;
  int: (minInclusive: number, maxInclusive: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  sample: <T>(arr: readonly T[], k: number) => T[];
}

function makeRng(seed: string): Rng {
  let s = hashSeed(seed) >>> 0;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)]!;
  const sample = <T>(arr: readonly T[], k: number): T[] => {
    const pool = [...arr];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return pool.slice(0, k);
  };
  return { next, int, pick, sample };
}

function buildCandidateBoard(seed: string, rng: Rng): ShadowlineBoard {
  const { lanes } = SHADOWLINE_CONFIG;
  const exitLane = rng.int(0, lanes - 1);

  // Shadow Pockets: distinct cells on the interior rows (1..7).
  const interiorCells: ShadowCell[] = [];
  for (let row = 1; row <= 7; row += 1) {
    for (let lane = 0; lane < lanes; lane += 1) {
      interiorCells.push({ lane, row });
    }
  }
  const pockets = rng.sample(interiorCells, SHADOWLINE_CONFIG.shadowPocketCount)
    .map((c) => cellKey(c.lane, c.row));

  const scanRows = rng.sample([2, 3, 4, 5, 6, 7], rng.int(2, 3));
  const watchLanes = rng.sample([0, 1, 2], 2);
  const pulseCells = rng.sample(interiorCells, rng.int(2, 3));

  return {
    boardId: seed,
    exitLane,
    shadowPockets: pockets,
    crossScan: { period: rng.int(3, 4), phase: rng.int(0, 3), rows: scanRows },
    laneWatch: { period: rng.int(3, 4), phase: rng.int(0, 3), lanes: watchLanes },
    sigilPulse: { period: rng.int(4, 5), phase: rng.int(1, 4), cells: pulseCells },
  };
}

interface AcceptResult {
  ok: boolean;
  noDamp: ShadowlineSolution | null;
}

function evaluateBoard(board: ShadowlineBoard, strict: boolean): AcceptResult {
  const noDamp = solveShadowline(board, false);
  if (!noDamp || noDamp.exposure !== 0) return { ok: false, noDamp };
  if (noDamp.actions < SHADOWLINE_CONFIG.minIdealActions) return { ok: false, noDamp };
  if (noDamp.actions > SHADOWLINE_CONFIG.maxIdealActions) return { ok: false, noDamp };
  if (pureAscendCleanWin(board)) return { ok: false, noDamp };

  if (!strict) return { ok: true, noDamp };

  if (usefulPocketsOnPath(board, noDamp.path) < SHADOWLINE_CONFIG.minUsefulPockets) {
    return { ok: false, noDamp };
  }
  const withDamp = solveShadowline(board, true);
  if (!withDamp || withDamp.actions >= noDamp.actions) return { ok: false, noDamp };

  return { ok: true, noDamp };
}

/**
 * Generate a solver-validated Shadowline board. Reject-samples for the strict
 * ideal (cover meaningful + Dampener helpful), then relaxes to a core-fair board
 * (solvable at 0 Exposure, 9–14 ideal actions, pure-ascend never a clean win) so
 * a playable board is always returned.
 */
export function generateShadowlineBoard(seed = 'shadowline:default'): ShadowlineBoard {
  let relaxedFallback: ShadowlineBoard | null = null;

  for (let attempt = 0; attempt < 600; attempt += 1) {
    const attemptSeed = `${seed}:attempt:${attempt}`;
    const rng = makeRng(attemptSeed);
    const board = buildCandidateBoard(attemptSeed, rng);

    const strict = evaluateBoard(board, true);
    if (strict.ok) return board;

    if (!relaxedFallback) {
      const relaxed = evaluateBoard(board, false);
      if (relaxed.ok) relaxedFallback = board;
    }
  }

  if (relaxedFallback) return relaxedFallback;

  // Guaranteed hand-tuned fallback: a gentle board that is always solvable.
  return {
    boardId: `${seed}:fallback`,
    exitLane: 0,
    shadowPockets: [cellKey(1, 2), cellKey(0, 3), cellKey(2, 4), cellKey(1, 5), cellKey(0, 6)],
    crossScan: { period: 4, phase: 2, rows: [3, 5] },
    laneWatch: { period: 3, phase: 1, lanes: [2, 0] },
    sigilPulse: { period: 5, phase: 3, cells: [{ lane: 1, row: 4 }, { lane: 2, row: 6 }] },
  };
}
