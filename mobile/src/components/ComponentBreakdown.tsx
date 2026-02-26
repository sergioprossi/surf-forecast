import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { ComponentScores } from '../api/types';
import { colors, spacing } from '../theme';
import { scoreToColor } from '../utils/formatting';

interface Props {
  components: ComponentScores;
  style?: ViewStyle;
}

const LABELS: Record<keyof ComponentScores, string> = {
  swell_quality: 'Swell Quality',
  swell_direction: 'Swell Direction',
  period: 'Period',
  spectral_purity: 'Spectral Purity',
  wind: 'Wind',
  wind_trend: 'Wind Trend',
  tide: 'Tide',
  tide_bathy_interaction: 'Tide/Bathy',
  consistency: 'Consistency',
};

export function ComponentBreakdown({ components, style }: Props) {
  const entries = Object.entries(LABELS) as [keyof ComponentScores, string][];

  return (
    <View style={[styles.container, style]}>
      {entries.map(([key, label]) => {
        const value = components[key];
        const pct = Math.round(value * 100);
        const barColor = scoreToColor(value * 10);

        return (
          <View key={key} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.barContainer}>
              <View style={[styles.bar, { width: `${pct}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[styles.value, { color: barColor }]}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    width: 110,
    fontSize: 12,
    color: colors.textSecondary,
  },
  barContainer: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
  value: {
    width: 36,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
});
