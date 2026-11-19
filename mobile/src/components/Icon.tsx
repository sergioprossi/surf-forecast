/** Line icons (24×24, stroke-based) — same shapes as the Compare/Alerts design canvas. */
import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'waves' | 'scale' | 'bell' | 'user' | 'send' | 'mail' | 'plus';

interface Props {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color, strokeWidth = 2 }: Props) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === 'waves' && (
        <>
          <Path d="M2 7c2-2 4-2 6 0s4 2 6 0 4-2 6 0" {...common} />
          <Path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" {...common} />
          <Path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" {...common} />
        </>
      )}
      {name === 'scale' && (
        <>
          <Path d="M12 3v18" {...common} />
          <Path d="M5 7h14" {...common} />
          <Path d="M5 7l-3 7a3 3 0 0 0 6 0z" {...common} />
          <Path d="M19 7l-3 7a3 3 0 0 0 6 0z" {...common} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...common} />
          <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" {...common} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx="12" cy="8" r="4" {...common} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...common} />
        </>
      )}
      {name === 'send' && (
        <>
          <Path d="M22 2 11 13" {...common} />
          <Path d="M22 2 15 22l-4-9-9-4z" {...common} />
        </>
      )}
      {name === 'mail' && (
        <>
          <Rect x="2" y="4" width="20" height="16" rx="2" {...common} />
          <Path d="m22 7-10 6L2 7" {...common} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...common} />}
    </Svg>
  );
}
