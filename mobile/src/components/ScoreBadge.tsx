import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, typography } from '../theme';
import { formatScore, scoreToColor } from '../utils/formatting';

interface Props {
  score: number;
  size?: 'large' | 'medium' | 'small';
  style?: ViewStyle;
}

export function ScoreBadge({ score, size = 'medium', style }: Props) {
  const color = scoreToColor(score);
  const textStyle = size === 'large' ? typography.scoreHero
    : size === 'medium' ? typography.scoreMedium
    : typography.h4;

  return (
    <View style={[styles.container, style]}>
      <Text style={[textStyle, { color }]}>{formatScore(score)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
