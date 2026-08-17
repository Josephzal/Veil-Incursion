/**
 * Stage C content configuration. No account Blueprint / sector-unlock
 * authority currently stores a Strain acquisition wave, so production
 * Stage C builds expose wave 2 here. A run copies this value at creation
 * and keeps it fixed for that incursion.
 */
export const NINE_STRAIN_CONTENT_MAX_ACQUISITION_WAVE: 1 | 2 | 3 = 2;
