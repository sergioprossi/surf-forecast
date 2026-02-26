import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { BestWindow, ForecastSlot, SpotSnapshot } from '../api/types';
import { colors, radius, spacing } from '../theme';
import {
  degreeToCompass,
  formatPeriod,
  formatScore,
  formatWaveHeight,
  formatWindSpeed,
  scoreToColor,
} from '../utils/formatting';
import { HourlyMiniChart } from './HourlyMiniChart';

interface Props {
  snapshot: SpotSnapshot;
  bestWindow?: BestWindow;
  hourlySlots?: ForecastSlot[];
  onPress: () => void;
  style?: ViewStyle;
}

export function SpotCard({ snapshot, bestWindow, hourlySlots, onPress, style }: Props) {
  const { spot, total_score, rating } = snapshot;
  const color = scoreToColor(total_score);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        style,
      ]}
    >
      {/* Header: name + score */}
      <View style={styles.header}>
        <View style={styles.nameCol}>
          <Text style={styles.spotName}>{spot.name}</Text>
          <View style={[styles.ratingBadge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.ratingText, { color }]}>{rating.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={[styles.score, { color }]}>{formatScore(total_score)}</Text>
      </View>

      {/* Conditions row */}
      <View style={styles.conditionsRow}>
        <ConditionChip label="Wave" value={formatWaveHeight(null)} />
        <ConditionChip label="Period" value={formatPeriod(null)} />
        <ConditionChip label="Wind" value={formatWindSpeed(null)} />
        <ConditionChip label="Dir" value={degreeToCompass(null)} />
      </View>

      {/* Mini chart */}
      {hourlySlots && hourlySlots.length > 0 && (
        <HourlyMiniChart slots={hourlySlots} />
      )}

      {/* Best window */}
      {bestWindow && (
        <View style={styles.bestWindow}>
          <Text style={styles.bestLabel}>BEST WINDOW</Text>
          <Text style={styles.bestTime}>
            {new Date(bestWindow.start).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
            {' — '}
            {new Date(bestWindow.end).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function ConditionChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  pressed: {
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameCol: {
    gap: spacing.xs,
  },
  spotName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ratingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  score: {
    fontSize: 32,
    fontWeight: '700',
  },
  conditionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  chipLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  chipValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  bestWindow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bestLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  bestTime: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
