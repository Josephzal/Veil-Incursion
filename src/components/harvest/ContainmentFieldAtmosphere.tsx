import React from 'react';

interface ContainmentFieldAtmosphereProps {
  fieldCleared: boolean;
  clearSweepToken: number;
  lastClearCenter?: { x: number; y: number } | null;
  areaWidth: number;
  areaHeight: number;
}

/**
 * Cleared-field marker intentionally omitted — negative space stays environmental.
 * Props retained so call sites need not change.
 */
export default function ContainmentFieldAtmosphere(
  _props: ContainmentFieldAtmosphereProps,
): null {
  return null;
}
