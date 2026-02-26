import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorState, LoadingSpinner, SpotCard } from '../components';
import { useBestWindows, useCurrentConditions } from '../hooks/useForecast';
import type { HomeStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';
import { isNortadaWarning } from '../utils/formatting';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const conditions = useCurrentConditions();
  const bestWindows = useBestWindows();

  const isLoading = conditions.isLoading;
  const isError = conditions.isError;
  const isRefreshing = conditions.isRefetching && !conditions.isLoading;

  const onRefresh = useCallback(() => {
    conditions.refetch();
    bestWindows.refetch();
  }, [conditions, bestWindows]);

  if (isLoading) {
    return <LoadingSpinner message="Checking the surf..." />;
  }

  if (isError || !conditions.data) {
    return (
      <ErrorState
        message="Couldn't load conditions. Check your connection."
        onRetry={() => conditions.refetch()}
      />
    );
  }

  const { spots: snapshots, updated_at } = conditions.data;
  const windows = bestWindows.data?.windows ?? [];

  // Check if any spot has nortada warning (we'd need component data for this —
  // for now, show based on summary text containing "nortada")
  const hasNortada = snapshots.some((s) =>
    s.summary.toLowerCase().includes('nortada'),
  );

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Porto Surf</Text>
        <Text style={styles.date}>{today}</Text>
      </View>

      {/* Nortada alert */}
      {hasNortada && (
        <View style={styles.nortadaBanner}>
          <Text style={styles.nortadaIcon}>!</Text>
          <View style={styles.nortadaContent}>
            <Text style={styles.nortadaTitle}>Nortada Alert</Text>
            <Text style={styles.nortadaDesc}>
              N/NE wind building — afternoon conditions may deteriorate
            </Text>
          </View>
        </View>
      )}

      {/* Spots section */}
      <Text style={styles.sectionTitle}>MY SPOTS</Text>

      {snapshots.map((snapshot) => {
        const spotWindow = windows.find(
          (w) => w.spot.id === snapshot.spot.id,
        );

        return (
          <SpotCard
            key={snapshot.spot.id}
            snapshot={snapshot}
            bestWindow={spotWindow}
            onPress={() =>
              navigation.navigate('SpotDetail', {
                spotId: snapshot.spot.id,
                spotName: snapshot.spot.name,
              })
            }
          />
        );
      })}

      {/* Updated at */}
      <Text style={styles.updatedAt}>
        Updated {new Date(updated_at).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  date: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  nortadaBanner: {
    flexDirection: 'row',
    backgroundColor: colors.nortadaBg,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  nortadaIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.nortadaText,
    width: 28,
    height: 28,
    textAlign: 'center',
    lineHeight: 28,
    borderRadius: 14,
    backgroundColor: colors.nortadaText + '33',
    overflow: 'hidden',
  },
  nortadaContent: {
    flex: 1,
    gap: 2,
  },
  nortadaTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.nortadaText,
  },
  nortadaDesc: {
    fontSize: 12,
    color: colors.nortadaText,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  updatedAt: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
