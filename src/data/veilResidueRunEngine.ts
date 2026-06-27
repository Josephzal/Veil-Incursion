import { MAX_RUN_CANISTER_RESIDUE } from '../constants/veilResidue';

/** Clamp vaulted residue loaded into the run canister at descent. */
export function resolveStartingRunCanisterResidue(vaultBalance: number): number {
  return Math.max(0, Math.min(MAX_RUN_CANISTER_RESIDUE, Math.floor(vaultBalance)));
}

/** Fill percentage for the harvest / resource canister UI. */
export function resolveVeilResidueCanisterFillPercent(canisterTotal: number): number {
  const clamped = Math.max(0, Math.min(MAX_RUN_CANISTER_RESIDUE, canisterTotal));
  return (clamped / MAX_RUN_CANISTER_RESIDUE) * 100;
}

/** Residue harvested or earned during the current run only (excludes carried-in baseline). */
export function resolveSessionVeilResidueGain(
  canisterTotal: number,
  runBaseline: number,
): number {
  return Math.max(0, Math.floor(canisterTotal) - Math.max(0, Math.floor(runBaseline)));
}
