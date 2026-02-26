import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';

interface Props {
  onPress: () => void;
  style?: ViewStyle;
}

export function FeedbackCTA({ onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.text}>Rate Your Session</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
