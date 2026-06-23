import { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

/** Hides OS status + Android navigation bars during combat; restores on unmount. */
export function useImmersiveCombatChrome(active = true): void {
  useEffect(() => {
    if (!active) return;

    StatusBar.setHidden(true, 'fade');

    let cancelled = false;

    if (Platform.OS === 'android') {
      void (async () => {
        try {
          await NavigationBar.setVisibilityAsync('hidden');
          await NavigationBar.setBackgroundColorAsync('#00000000');
          if (!cancelled) {
            await NavigationBar.setBehaviorAsync('overlay-swipe');
          }
        } catch {
          // Native module unavailable in some dev clients — non-fatal.
        }
      })();
    }

    return () => {
      cancelled = true;
      StatusBar.setHidden(false, 'fade');
      if (Platform.OS === 'android') {
        void NavigationBar.setVisibilityAsync('visible').catch(() => {});
      }
    };
  }, [active]);
}
