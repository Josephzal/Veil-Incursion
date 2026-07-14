import {
  SCANNER_LABEL_BASE_DEGRADE_CHANCE,
  SCANNER_LABEL_DEGRADE_CHANCE_CAP,
  SCANNER_LABEL_IMMUNE_TYPES,
  DEGRADED_TYPE_SWAPS,
  STRANGE_SCANNER_LABELS,
} from './scannerLabelCertaintyCatalog';
import {
  resolveScannerLabelDegradeChance,
  rollScannerLabelOverlay,
  reconcileScannerLieWithLethal,
  makeReliableScannerLabel,
} from './scannerLabelCertaintyEngine';
import { getDepthIdentityScanBias } from './depthIdentityCatalog';
import type { NodeContextModifiers } from '../types/worldState';
import type { ProceduralNodeType } from '../types/proceduralRunTree';

export interface ScannerLabelValidationIssue {
  code: string;
  message: string;
}

export function validateScannerLabelCertainty(): ScannerLabelValidationIssue[] {
  const issues: ScannerLabelValidationIssue[] = [];

  for (const depth of [1, 2, 3] as const) {
    const base = SCANNER_LABEL_BASE_DEGRADE_CHANCE[depth];
    if (base < 0 || base > SCANNER_LABEL_DEGRADE_CHANCE_CAP) {
      issues.push({
        code: 'BASE_CHANCE',
        message: `D${depth} base degrade ${base} out of band`,
      });
    }
  }

  if (!(SCANNER_LABEL_BASE_DEGRADE_CHANCE[1] < SCANNER_LABEL_BASE_DEGRADE_CHANCE[2]
    && SCANNER_LABEL_BASE_DEGRADE_CHANCE[2] < SCANNER_LABEL_BASE_DEGRADE_CHANCE[3])) {
    issues.push({
      code: 'DEPTH_BAND',
      message: 'Base degrade chances must increase D1 < D2 < D3',
    });
  }

  for (const type of Object.keys(DEGRADED_TYPE_SWAPS) as ProceduralNodeType[]) {
    if (DEGRADED_TYPE_SWAPS[type].length === 0) {
      issues.push({ code: 'SWAP_EMPTY', message: `${type} has no degrade swaps` });
    }
    if (STRANGE_SCANNER_LABELS[type].length === 0) {
      issues.push({ code: 'STRANGE_EMPTY', message: `${type} has no strange labels` });
    }
  }

  // Identity merge must not exceed cap.
  const memBias = getDepthIdentityScanBias('MEMORY_CONTAMINATION', null);
  const merged = resolveScannerLabelDegradeChance(3, memBias);
  if (merged > SCANNER_LABEL_DEGRADE_CHANCE_CAP + 1e-6) {
    issues.push({ code: 'CAP', message: `Merged degrade ${merged} exceeds cap` });
  }

  // Immune types stay reliable.
  let i = 0;
  const rng = () => {
    i += 1;
    return 0.01; // force corrupt attempt
  };
  for (const immune of SCANNER_LABEL_IMMUNE_TYPES) {
    const overlay = rollScannerLabelOverlay(immune, 3, rng, memBias);
    if (overlay.certainty !== 'RELIABLE') {
      issues.push({ code: 'IMMUNE', message: `${immune} must remain reliable` });
    }
  }

  // Anti-stack: false extraction clears type lie.
  const corrupt = rollScannerLabelOverlay('COMBAT', 2, () => 0, null);
  // Force a corrupted overlay for test
  const forcedCorrupt = {
    certainty: 'DEGRADED' as const,
    displayedType: 'ANOMALY' as ProceduralNodeType,
  };
  const mods: NodeContextModifiers = {
    depthStage: 'BREACH',
    nodePressureBand: 'MEDIUM',
    twistedTemplate: 'FALSE_EXTRACTION_SIGNAL',
  };
  const reconciled = reconcileScannerLieWithLethal('COMBAT', forcedCorrupt, mods);
  if (reconciled.overlay.certainty !== 'RELIABLE') {
    issues.push({
      code: 'ANTI_STACK_FALSE_EXTRACT',
      message: 'False Extraction must clear corrupted node-type label',
    });
  }

  // Anti-stack: lethal without highRisk forces telegraph.
  const folded = reconcileScannerLieWithLethal(
    'COMBAT',
    forcedCorrupt,
    {
      depthStage: 'DEEP_VEIL',
      nodePressureBand: 'HIGH',
      encounterModifier: 'FOLDED',
    },
  );
  if (!folded.modifiers.highRisk) {
    issues.push({
      code: 'ANTI_STACK_LETHAL',
      message: 'Corrupt label + FOLDED must force HIGH RISK telegraph',
    });
  }

  // Reliable identity when no roll.
  const reliable = makeReliableScannerLabel('RESOURCE');
  if (reliable.displayedType !== 'RESOURCE' || reliable.certainty !== 'RELIABLE') {
    issues.push({ code: 'RELIABLE', message: 'makeReliableScannerLabel failed' });
  }

  // Unused: silence if degrade always forced somehow.
  void corrupt;

  return issues;
}

export function verifyScannerLabelCertainty(): void {
  const issues = validateScannerLabelCertainty();
  if (issues.length > 0) {
    throw new Error(
      `verifyScannerLabelCertainty:\n${issues.map((i) => `- [${i.code}] ${i.message}`).join('\n')}`,
    );
  }
}

export function debugPrintScannerLabelCertainty(): string {
  const lines = [
    '=== SCANNER LABEL CERTAINTY (Phase F) ===',
    `base D1/D2/D3: ${SCANNER_LABEL_BASE_DEGRADE_CHANCE[1]}/${SCANNER_LABEL_BASE_DEGRADE_CHANCE[2]}/${SCANNER_LABEL_BASE_DEGRADE_CHANCE[3]}`,
    `cap: ${SCANNER_LABEL_DEGRADE_CHANCE_CAP}`,
    `immune: ${SCANNER_LABEL_IMMUNE_TYPES.join(', ')}`,
  ];
  for (const depth of [1, 2, 3] as const) {
    lines.push(
      `effective D${depth} (no bias): ${resolveScannerLabelDegradeChance(depth, null).toFixed(2)}`,
    );
  }
  return lines.join('\n');
}
