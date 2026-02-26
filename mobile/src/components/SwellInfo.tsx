import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, spacing } from '../theme';
import { degreeToCompass, formatPeriod, formatWaveHeight } from '../utils/formatting';

interface Props {
  height: number | null;
  period: number | null;
  direction: number | null;
  label?: string;
  style?: ViewStyle;
}

export function SwellInfo({ height, period, direction, label, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Text style={styles.height}>{formatWaveHeight(height)}</Text>
      <View style={styles.details}>
        <Text style={styles.detail}>{formatPeriod(period)}</Text>
        <Text style={styles.separator}>·</Text>
        <Text style={styles.detail}>{degreeToCompass(direction)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  height: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  separator: {
    fontSize: 13,
    color: colors.textTertiary,
  },
});
