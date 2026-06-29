import { Platform } from 'react-native';

/** RN Web has no native animated driver — avoid `useNativeDriver` warnings. */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';
