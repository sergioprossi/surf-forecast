import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { ForecastSlot } from '../api/types';
import { colors, radius, spacing } from '../theme';
import { scoreToColor } from '../utils/formatting';

interface Props {
  slots: ForecastSlot[];
  maxSlots?: number;
  style?: ViewStyle;
}

export function HourlyMiniChart({ slots, maxSlots = 12, style }: Props) {
  const visible = slots.slice(0, maxSlots);
  const maxScore = 10;

  return (
    <View style={[styles.container, style]}>
      {visible.map((slot, i) => {
        const height = Math.max(4, (slot.total_score / maxScore) * 40);
        const barColor = scoreToColor(slot.total_score);
        const hour = new Date(slot.time).getHours();

        return (
          <View key={i} style={styles.barWrapper}>
            <View style={styles.barArea}>
              <View
                style={[styles.bar, { height, backgroundColor: barColor }]}
              />
            </View>
            {i % 3 === 0 && (
              <Text style={styles.hourLabel}>{hour}h</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 56,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  barArea: {
    height: 40,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 6,
    borderRadius: 3,
    minHeight: 4,
  },
  hourLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
