import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { scoreToColor } from '../utils/formatting';

interface Props {
  rating: string;
  score: number;
  style?: ViewStyle;
}

export function RatingBadge({ rating, score, style }: Props) {
  const color = scoreToColor(score);

  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }, style]}>
      <Text style={[styles.text, { color }]}>{rating.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
