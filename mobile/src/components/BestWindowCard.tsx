import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { formatScore, scoreToColor } from '../utils/formatting';

interface Props {
  start: string;
  end: string;
  peakScore: number;
  rating: string;
  style?: ViewStyle;
}

export function BestWindowCard({ start, end, peakScore, rating, style }: Props) {
  const color = scoreToColor(peakScore);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{formatTime(start)} — {formatTime(end)}</Text>
      </View>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color }]}>{formatScore(peakScore)}</Text>
        <View style={[styles.ratingBadge, { backgroundColor: color + '22' }]}>
          <Text style={[styles.ratingText, { color }]}>{rating.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeRow: {
    flex: 1,
  },
  time: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  score: {
    fontSize: 22,
    fontWeight: '700',
  },
  ratingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
