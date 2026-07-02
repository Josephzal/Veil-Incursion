import { Platform } from 'react-native';
import CataclysmSigilOverlayNative from './CataclysmSigilOverlay.native';
import CataclysmSigilOverlayWeb from './CataclysmSigilOverlay.web';

export default Platform.OS === 'web'
  ? CataclysmSigilOverlayWeb
  : CataclysmSigilOverlayNative;
