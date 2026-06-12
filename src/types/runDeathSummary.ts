/** Snapshot captured when a run ends in failure — survives `endRun` state reset. */
export interface RunDeathSummary {
  /** Wall-clock duration from run start to termination. */
  timeAliveMs: number;
  /** Hostile designation or fallback termination reason. */
  causeOfDeath: string;
  /** Local level within the active district (1–15). */
  sectorLevel: number;
  /** District depth layer (1–3). */
  depthLayer: 1 | 2 | 3;
}

export function formatTimeAliveMmSs(timeAliveMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timeAliveMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
