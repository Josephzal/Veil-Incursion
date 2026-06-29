import { Platform, type TextStyle, type ViewStyle } from 'react-native';

interface ShadowSpec {
  color: string;
  opacity?: number;
  radius?: number;
  offset?: { width: number; height: number };
}

function shadowColorWithOpacity(color: string, opacity: number): string {
  if (color.startsWith('rgba')) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${opacity})`);
  }
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

export function viewShadow(spec: ShadowSpec): ViewStyle {
  const opacity = spec.opacity ?? 1;
  const radius = spec.radius ?? 0;
  const offset = spec.offset ?? { width: 0, height: 0 };

  if (Platform.OS === 'web') {
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${shadowColorWithOpacity(spec.color, opacity)}`,
    };
  }

  return {
    shadowColor: spec.color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: offset,
  };
}

export function textGlow(spec: ShadowSpec): TextStyle {
  const radius = spec.radius ?? 0;
  const offset = spec.offset ?? { width: 0, height: 0 };

  if (Platform.OS === 'web') {
    return {
      textShadow: `${offset.width}px ${offset.height}px ${radius}px ${spec.color}`,
    };
  }

  return {
    textShadowColor: spec.color,
    textShadowRadius: radius,
    textShadowOffset: offset,
  };
}
