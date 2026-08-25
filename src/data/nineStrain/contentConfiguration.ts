/**
 * Stage E.3 content configuration. No account Blueprint / sector-unlock
 * authority currently stores a Strain acquisition wave, so production
 * builds expose the highest closed wave here. A run copies this value at
 * creation and keeps it fixed for that incursion — existing wave 1/2/3
 * saves are never upgraded (see persistence.ts resolveMaxAcquisitionWave).
 */
export const NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE: 1 | 2 | 3 | 4 = 4;
