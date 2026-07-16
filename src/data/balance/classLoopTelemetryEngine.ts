/**
 * Combat Refactor Phase 3 — per-class loop telemetry.
 */

export interface ClassLoopTelemetry {
  // Aegis
  parriesAttempted: number;
  parriesSuccessful: number;
  perfectParries: number;
  ripostesReady: number;
  ripostesConsumed: number;
  damagePreventedByParry: number;
  fracturesAppliedByClass: number;

  // Hex Shot
  reloadsUsed: number;
  perfectReloads: number;
  chamberBonusGranted: number;
  chamberBonusConsumed: number;
  armorStacksRemoved: number;
  wardStacksRemoved: number;
  panopticonInterrupts: number;
  ammoProfileUses: Partial<Record<string, number>>;

  // Envoy
  catalystsPrimed: number;
  catalystSequencesTriggered: number;
  wardsBroken: number;
  channelsDisrupted: number;
  fractureExploits: number;
  defensiveCatalystUses: number;
}

export function createEmptyClassLoopTelemetry(): ClassLoopTelemetry {
  return {
    parriesAttempted: 0,
    parriesSuccessful: 0,
    perfectParries: 0,
    ripostesReady: 0,
    ripostesConsumed: 0,
    damagePreventedByParry: 0,
    fracturesAppliedByClass: 0,
    reloadsUsed: 0,
    perfectReloads: 0,
    chamberBonusGranted: 0,
    chamberBonusConsumed: 0,
    armorStacksRemoved: 0,
    wardStacksRemoved: 0,
    panopticonInterrupts: 0,
    ammoProfileUses: {},
    catalystsPrimed: 0,
    catalystSequencesTriggered: 0,
    wardsBroken: 0,
    channelsDisrupted: 0,
    fractureExploits: 0,
    defensiveCatalystUses: 0,
  };
}

export function formatClassLoopTelemetrySummary(
  classId: string,
  t: ClassLoopTelemetry,
): string {
  const lines = [`CLASS LOOP TELEMETRY // ${classId}`];
  if (classId === 'AEGIS') {
    lines.push(
      `  Parries: ${t.parriesSuccessful}/${t.parriesAttempted} (perfect ${t.perfectParries})`,
      `  Ripostes: ready ${t.ripostesReady} / used ${t.ripostesConsumed}`,
      `  Dmg prevented: ${t.damagePreventedByParry} // Fractures: ${t.fracturesAppliedByClass}`,
    );
  } else if (classId === 'HEX_SHOT') {
    const profiles = Object.entries(t.ammoProfileUses)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ') || '—';
    lines.push(
      `  Reloads: ${t.reloadsUsed} (perfect ${t.perfectReloads})`,
      `  Chamber bonus: ${t.chamberBonusGranted} granted / ${t.chamberBonusConsumed} used`,
      `  KA−${t.armorStacksRemoved} OW−${t.wardStacksRemoved} // Panopticon ${t.panopticonInterrupts}`,
      `  Profiles: ${profiles}`,
    );
  } else if (classId === 'ENVOY') {
    lines.push(
      `  Catalysts primed: ${t.catalystsPrimed} // sequences: ${t.catalystSequencesTriggered}`,
      `  Wards broken: ${t.wardsBroken} // channels disrupted: ${t.channelsDisrupted}`,
      `  Fracture exploits: ${t.fractureExploits} // defensive: ${t.defensiveCatalystUses}`,
    );
  }
  return lines.join('\n');
}
