import React from 'react';
import { ImageBackground, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { HUB_ATMOSPHERE_BACKGROUND, HUB_ATMOSPHERE_SCRIM } from '../../constants/hubAtmosphere';
import { LANDSCAPE_PANEL_PADDING } from '../../constants/landscapeLayout';
import { resolveImmersiveFooterInset, resolveImmersiveTopInset } from '../../constants/immersiveLayout';
import { useLandscapeMetrics } from '../../hooks/useLandscapeMetrics';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { HubLayoutProvider } from '../../context/HubLayoutContext';
import VeilTopbar from '../hub/VeilTopbar';
import TerminalOverlay from '../TerminalOverlay';
import HubViewport from './HubViewport';
import TerminalGlitchTransition from '../ui/TerminalGlitchTransition';
import type { TerminalView } from '../../types/terminalNav';

interface TerminalHubLayoutProps {
  activeView: TerminalView;
  onSelectView: (view: TerminalView) => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  mainStyle?: StyleProp<ViewStyle>;
}

/** Shared top inset so content aligns under immersive safe area. */
export function resolveHubContentTopInset(
  safeTop: number,
  panelPadding: number = LANDSCAPE_PANEL_PADDING,
): number {
  return panelPadding + resolveImmersiveTopInset(safeTop);
}

/** Overworld hub shell — atmospheric backdrop, top navigation, main viewport. */
export default function TerminalHubLayout({
  activeView,
  onSelectView,
  children,
  style,
  mainStyle,
}: TerminalHubLayoutProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const { safeTop, safeBottom, safeRight, panelPadding } = useLandscapeMetrics();
  const { scaleSpacing } = layout;
  const contentTopInset = resolveHubContentTopInset(safeTop, panelPadding);
  const contentBottomInset = resolveImmersiveFooterInset(safeBottom);
  // Theater workstations fill edge-to-edge under the top bar (no HubViewport max-width).
  const theaterBleed = activeView === 'MAP'
    || activeView === 'CONTRACTS'
    || activeView === 'BLACK_MARKET'
    || activeView === 'LOADOUT';
  const mainPadStyle = theaterBleed
    ? {
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      }
    : {
        paddingTop: Math.max(0, contentTopInset - 68),
        paddingRight: Math.max(scaleSpacing(6), safeRight),
        paddingBottom: contentBottomInset,
        paddingLeft: scaleSpacing(2),
      };

  return (
    <ImageBackground
      source={HUB_ATMOSPHERE_BACKGROUND}
      style={[styles.root, style]}
      resizeMode="cover"
    >
      <View style={[styles.scrim, styles.scrimPointerLock]} />
      <HubLayoutProvider value={layout}>
        <View style={styles.shell}>
          <VeilTopbar activeView={activeView} onSelectView={onSelectView} />
          <View style={[styles.main, mainPadStyle, mainStyle]}>
            <View style={styles.terminalOverlayHost} pointerEvents="none">
              <TerminalOverlay />
            </View>
            <HubViewport fullBleed={theaterBleed}>
              <TerminalGlitchTransition transitionKey={activeView} style={styles.glitchViewport}>
                {children}
              </TerminalGlitchTransition>
            </HubViewport>
          </View>
        </View>
      </HubLayoutProvider>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    zIndex: 1,
    backgroundColor: '#010304',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: HUB_ATMOSPHERE_SCRIM,
  },
  scrimPointerLock: {
    pointerEvents: 'none',
  },
  shell: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    maxWidth: '100%',
    zIndex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    maxWidth: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  terminalOverlayHost: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  glitchViewport: {
    zIndex: 1,
  },
});
