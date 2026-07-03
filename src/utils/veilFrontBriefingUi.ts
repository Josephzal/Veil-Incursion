import type { EchoActivityLevel, OperationObjectiveKind } from '../types/worldState';
import { hexToRgba } from './sectorInfluenceVisual';

const VEIL_SECTOR_PALETTE: Record<EchoActivityLevel, { fill: string; stroke: string }> = {
  LOW: { fill: '#0ea5e9', stroke: '#38bdf8' },
  ELEVATED: { fill: '#d97706', stroke: '#fbbf24' },
  CRITICAL: { fill: '#9333ea', stroke: '#c084fc' },
};

export function getVeilSectorFill(
  echoActivity: EchoActivityLevel,
  isActive: boolean,
): string {
  const base = VEIL_SECTOR_PALETTE[echoActivity].fill;
  return hexToRgba(base, isActive ? 0.22 : 0.12);
}

export function getVeilSectorStroke(
  echoActivity: EchoActivityLevel,
  isActive: boolean,
  accentColor: string,
): string {
  if (isActive) return accentColor;
  return hexToRgba(VEIL_SECTOR_PALETTE[echoActivity].stroke, 0.75);
}

export function qualitativeLevel(value: number): 'Low' | 'Medium' | 'High' | 'Extreme' {
  if (value <= 2) return 'Low';
  if (value <= 3) return 'Medium';
  if (value <= 4) return 'High';
  return 'Extreme';
}

export function formatEchoActivity(level: EchoActivityLevel): string {
  switch (level) {
    case 'LOW':
      return 'Low';
    case 'ELEVATED':
      return 'Elevated';
    case 'CRITICAL':
      return 'Critical';
    default:
      return level;
  }
}

export function formatOperationObjectiveKind(kind: OperationObjectiveKind): string {
  switch (kind) {
    case 'ANCHOR_ASSAULT':
      return 'Anchor Assault';
    case 'ECHO_RECOVERY':
      return 'Echo Recovery';
    case 'EXTRACTION_SURGE':
      return 'Extraction Surge';
    case 'RESOURCE_SURVEY':
      return 'Resource Survey';
    case 'BOSS_SUPPRESSION':
      return 'Boss Suppression';
    default:
      return kind;
  }
}

export function formatOperationObjective(title: string, objectiveKind?: OperationObjectiveKind): string {
  if (!objectiveKind) return title;
  return `${title} (${formatOperationObjectiveKind(objectiveKind)})`;
}
