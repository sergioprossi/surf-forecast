import React from 'react';
import { StyleSheet, View, ViewStyle, Text } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import type { ForecastSlot } from '../api/types';
import { colors, radius, spacing } from '../theme';

interface Props {
  slots: ForecastSlot[];
  style?: ViewStyle;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 100;
const PADDING = { top: 10, bottom: 25, left: 30, right: 10 };

export function TideChart({ slots, style }: Props) {
  const tideSlots = slots.filter((s) => s.conditions.tide_height != null);

  if (tideSlots.length < 2) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.noData}>No tide data available</Text>
      </View>
    );
  }

  const heights = tideSlots.map((s) => s.conditions.tide_height!);
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  const rangeH = maxH - minH || 1;

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const points = tideSlots.map((s, i) => {
    const x = PADDING.left + (i / (tideSlots.length - 1)) * plotW;
    const y = PADDING.top + plotH - ((s.conditions.tide_height! - minH) / rangeH) * plotH;
    return { x, y, hour: new Date(s.time).getHours(), height: s.conditions.tide_height! };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Find current hour marker
  const now = new Date();
  const currentHour = now.getHours();
  const currentPoint = points.find((p) => p.hour === currentHour);

  return (
    <View style={[styles.container, style]}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* Y-axis labels */}
        <SvgText x={2} y={PADDING.top + 4} fontSize={9} fill={colors.textTertiary}>
          {maxH.toFixed(1)}m
        </SvgText>
        <SvgText x={2} y={PADDING.top + plotH + 4} fontSize={9} fill={colors.textTertiary}>
          {minH.toFixed(1)}m
        </SvgText>

        {/* Tide line */}
        <Path d={pathD} stroke={colors.info} strokeWidth={2} fill="none" />

        {/* Hour labels */}
        {points
          .filter((_, i) => i % 4 === 0)
          .map((p) => (
            <SvgText
              key={p.hour}
              x={p.x}
              y={CHART_HEIGHT - 4}
              fontSize={9}
              fill={colors.textTertiary}
              textAnchor="middle"
            >
              {p.hour}h
            </SvgText>
          ))}

        {/* Current marker */}
        {currentPoint && (
          <>
            <Line
              x1={currentPoint.x}
              y1={PADDING.top}
              x2={currentPoint.x}
              y2={PADDING.top + plotH}
              stroke={colors.accent}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
            <Circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r={4}
              fill={colors.accent}
            />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  noData: {
    color: colors.textTertiary,
    fontSize: 13,
    padding: spacing.xl,
  },
});
