import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { degreeToCompass, formatWindSpeed, isNortadaWarning } from '../utils/formatting';

interface Props {
  speed: number | null;
  direction: number | null;
  windTrend?: number | null;
  style?: ViewStyle;
}

export function WindIndicator({ speed, direction, windTrend, style }: Props) {
  const showNortada = isNortadaWarning(windTrend);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <Text style={styles.arrow}>
          {direction != null ? '↑' : '--'}
        </Text>
        <View>
          <Text style={styles.speed}>{formatWindSpeed(speed)}</Text>
          <Text style={styles.direction}>{degreeToCompass(direction)}</Text>
        </View>
      </View>
      {showNortada && (
        <View style={styles.nortadaBadge}>
          <Text style={styles.nortadaText}>NORTADA</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  arrow: {
    fontSize: 24,
    color: colors.textPrimary,
    transform: [{ rotate: '0deg' }], // TODO: rotate based on direction
  },
  speed: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  direction: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  nortadaBadge: {
    backgroundColor: colors.nortadaBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  nortadaText: {
    color: colors.nortadaText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
