import type { CabalScannerTheme } from '../../types/scanner';

export const TERMINAL_GREEN = '#00ff33';
export const VOID_BLACK = '#090d16';
export const STRUCTURAL_GRAY = '#1a2332';
export const STRUCTURAL_GRAY_DIM = 'rgba(100, 116, 139, 0.22)';
export const EDGE_DIM = 'rgba(100, 116, 139, 0.12)';

export interface OverworldPalette {
  terminalGreen: string;
  voidBlack: string;
  gridLine: string;
  edgeActive: string;
  edgeDim: string;
  nodeFill: string;
  nodeFillSelected: string;
  nodeStroke: string;
  zoneLine: string;
}

export function resolveOverworldPalette(zoneTint?: Partial<CabalScannerTheme>): OverworldPalette {
  const zoneLine = zoneTint?.line ?? '#3f6212';
  return {
    terminalGreen: TERMINAL_GREEN,
    voidBlack: VOID_BLACK,
    gridLine: STRUCTURAL_GRAY,
    edgeActive: 'rgba(0, 255, 51, 0.34)',
    edgeDim: EDGE_DIM,
    nodeFill: 'rgba(0, 255, 51, 0.16)',
    nodeFillSelected: 'rgba(0, 255, 51, 0.34)',
    nodeStroke: TERMINAL_GREEN,
    zoneLine,
  };
}
