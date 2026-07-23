import type { ReactNode } from 'react';
import { getCabalScannerTheme } from './cabalScannerThemes';
import { mergeScannerThemes } from './zoneScannerThemes';
import type { CabalScannerTheme, ScannerCabal } from '../../types/scanner';
import type { RadarDot } from '../../types/run';
import { primaryScannerSignalAccent } from '../../data/scannerSignalEngine';
import { scannerRevealColorForNodeType } from '../../utils/scannerNodeRevealColor';

export const SCAN_SWEEP_MS = 2200;
export const SCAN_ROTATIONS = 3;
export const SCAN_DURATION_MS = SCAN_SWEEP_MS * SCAN_ROTATIONS;
export const SCANNER_CEASE_SLOT_HEIGHT = 40;

export function getScannerShellHeight(scannerSize: number, includeCeaseSlot = true): number {
  return scannerSize + (includeCeaseSlot ? SCANNER_CEASE_SLOT_HEIGHT : 0);
}

export const SWEEP_HIT_THRESHOLD_DEG = 3;
export const SWEEP_ARM_HYSTERESIS_DEG = 8;
export const PHOSPHOR_DECAY_MS = 1500;
export const PHOSPHOR_IDLE_OPACITY = 0.05;
export const BLOOM_SCALE = 1.3;
export const BLOOM_SETTLE_MS = 140;
export const DOT_HIT_SIZE = 44;
export const DOT_VISUAL_SIZE = 12;
export const BOSS_DOT_SIZE = 16;
/** Phosphor sweep sector (~24°) — timing unchanged (SCAN_SWEEP_MS). */
export const SWEEP_TRAIL_ACTIVE_DEG = 24;
export const STROKE_THIN = 1;
export const STRUCTURAL_LINE_ALPHA = 0.48;
export const CEASE_DECEL_MS = 400;
export const CEASE_FOG_MS = 900;
export const SIPHON_EXTRACT_MS = 280;
export const SIPHON_RING_PEAK_SCALE = 2.5;
export const SIPHON_ILLUMINATE_MIN_OPACITY = 0.35;
export const MIN_SIPHONS_TO_CEASE = 1;
export const SELECTION_GLOW_FADE_MS = 800;
export const SELECTION_GLOW_INNER_SCALE = 1.9;
export const SELECTION_GLOW_OUTER_SCALE = 2.75;
export const SIPHON_HAPTIC_MS = 12;
/** Combat / danger contact core — restrained coral. */
export const HOSTILE_PATROL_COLOR = '#C87682';
export const SWEEP_GRADIENT_LEAD_DEG = 360;
export const SWEEP_GRADIENT_TRAIL_START_DEG = 360 - SWEEP_TRAIL_ACTIVE_DEG;
/** Unselected core radius (~13.4px diameter). */
export const CONTACT_CORE_RADIUS = 6.7;
/** Selected core radius (~18px diameter). */
export const CONTACT_CORE_RADIUS_SELECTED = 9;
/** Unselected soft glow radius (~44px diameter). */
export const CONTACT_GLOW_RADIUS = 22;
/** Selected soft glow radius (~68px diameter). */
export const CONTACT_GLOW_RADIUS_SELECTED = 34;
/** Bottom telemetry rail height reserved so the circular aperture is not clipped. */
export const SCANNER_TELEMETRY_RAIL_HEIGHT = 56;
/** Extra inset so the outer rim clears the rail / bezel edge. */
export const SCANNER_APERTURE_SAFE_INSET = 14;
/** Live phosphor mint — sweep / selection / ready action. */
export const SCANNER_PHOSPHOR = '#64C9B1';
/** Veil interference / unknown signals. */
export const SCANNER_VEIL_VIOLET = '#81738F';
/** Keyboard/controller focus — pale cool neutral, distinct from mint selection. */
export const SCANNER_FOCUS_NEUTRAL = '#C5D0CD';
export const SCANNER_TEXT_PRIMARY = '#DCE4E0';
export const SCANNER_TEXT_SECONDARY = '#7F8C87';
export const SCANNER_PAGE_BG = '#050707';
export const SCANNER_HEADER_BG = '#050808';
export const SCANNER_FIELD_SURROUND = '#070B0B';
export const SCANNER_APERTURE_CENTER = '#030808';
export const SCANNER_APERTURE_EDGE = '#010505';
export const SCANNER_DOSSIER_SURFACE = '#070C0B';
export const SCANNER_INSTRUMENT_SURFACE = '#070B0B';
/** Quiet mint-gray border. */
export const SCANNER_BORDER_QUIET = 'rgba(108, 156, 143, 0.18)';
/** @deprecated Prefer SCANNER_FIELD_SURROUND. */
export const RADAR_CANVAS_BACKDROP = SCANNER_FIELD_SURROUND;

export interface VectorScannerProps {
  cabal: ScannerCabal;
  zoneTint?: Partial<CabalScannerTheme>;
  scannerSize: number;
  active: boolean;
  activeNodes: RadarDot[];
  coreScale?: number;
  contactsLocked?: boolean;
  continuousScan?: boolean;
  selectedNodeId?: string | null;
  typeColoredNodeIds?: ReadonlySet<string>;
  proximityGhost?: { x: number; y: number } | null;
  onSweepComplete?: () => void;
  onSelectNode?: (nodeId: string) => void;
  onSiphonedNodesChange?: (nodeIds: string[]) => void;
  children?: ReactNode;
}

export interface BlipRenderState {
  opacity: number;
  scale: number;
  bloomUntil: number;
  decayStart: number | null;
  siphoned: boolean;
}

export interface NodeBearing {
  node: RadarDot;
  id: string;
  canvasX: number;
  canvasY: number;
  bearingDeg: number;
  visualRadius: number;
  visualSize: number;
  isHostilePatrol: boolean;
}

export function polarAngleDeg(x: number, y: number, cx: number, cy: number): number {
  const rad = Math.atan2(y - cy, x - cx);
  return ((rad * 180) / Math.PI + 360) % 360;
}

export function angularDifference(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function accentWithAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba')) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function resolveBlipAccent(
  node: RadarDot,
  opts: {
    selected: boolean;
    siphoned: boolean;
    typeColored: boolean;
    isHostilePatrol: boolean;
    uniformSelectable: boolean;
    selectionAccent: string;
    defaultAccent: string;
  },
): string {
  if (opts.isHostilePatrol) return HOSTILE_PATROL_COLOR;
  if (opts.uniformSelectable) return opts.selectionAccent;
  if ((opts.typeColored || opts.selected) && opts.siphoned && node.nodeType) {
    const signalAccent = primaryScannerSignalAccent(node.veilSignals);
    if (signalAccent) return signalAccent;
    return scannerRevealColorForNodeType(node.nodeType);
  }
  if (opts.selected) return opts.selectionAccent;
  return opts.defaultAccent;
}

export function resolveScannerTheme(
  cabal: ScannerCabal,
  zoneTint?: Partial<CabalScannerTheme>,
): CabalScannerTheme {
  return zoneTint
    ? mergeScannerThemes(getCabalScannerTheme(cabal), zoneTint)
    : getCabalScannerTheme(cabal);
}
