import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from '../theme';

interface Props {
  message?: string;
  style?: ViewStyle;
}

export function LoadingSpinner({ message = 'Loading...', style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
