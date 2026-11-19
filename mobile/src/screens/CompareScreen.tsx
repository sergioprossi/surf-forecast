import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SpotSnapshot } from '../api/types';
import { ErrorState, LoadingSpinner, RatingBadge } from '../components';
import { useCompare } from '../hooks/useCompare';
import { useSpots } from '../hooks/useForecast';
import type { MainTabParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { buildMetricRows, buildTimeOptions, rankSnapshots } from '../utils/compare';
import { formatScore, scoreToColor } from '../utils/formatting';

type NavigationProp = BottomTabNavigationProp<MainTabParamList, 'CompareTab'>;

export function CompareScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // Recomputed when the screen mounts; "Now" always means the server's current hour
  const timeOptions = useMemo(() => buildTimeOptions(new Date()), []);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const spots = useSpots();
  const spotIds = useMemo(() => spots.data?.spots.map((s) => s.id) ?? [], [spots.data]);
  const compare = useCompare(spotIds, selectedTime);

  const ranked = useMemo(() => rankSnapshots(compare.data?.spots ?? []), [compare.data]);
  const metricRows = useMemo(() => buildMetricRows(ranked), [ranked]);

  const openSpot = useCallback(
    (s: SpotSnapshot) =>
      navigation.navigate('HomeTab', {
        screen: 'SpotDetail',
        params: { spotId: s.spot.id, spotName: s.spot.name },
      }),
    [navigation],
  );

  if (spots.isLoading || (compare.isLoading && !compare.data)) {
    return <LoadingSpinner message="Comparing spots..." />;
  }

  if (spots.isError || compare.isError) {
    return (
      <ErrorState
        message="Couldn't load the comparison. Check your connection."
        onRetry={() => (spots.isError ? spots.refetch() : compare.refetch())}
      />
    );
  }

  const best = ranked[0];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={compare.isRefetching && !compare.isPlaceholderData}
          onRefresh={() => compare.refetch()}
          tintColor={colors.accent}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Compare</Text>
        <Text style={styles.subtitle}>Which spot is working best?</Text>
      </View>

      {/* Time selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsScroller}
      >
        {timeOptions.map((opt) => {
          const active = opt.value === selectedTime;
          return (
            <Pressable
              key={opt.value ?? 'now'}
              onPress={() => setSelectedTime(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${opt.sublabel} ${opt.label}`}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
              <Text style={[styles.chipSub, active && styles.chipSubActive]}>{opt.sublabel}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {ranked.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No forecast for this time</Text>
          <Text style={styles.emptyDesc}>
            Data may not have been collected yet. Try another time or pull to refresh.
          </Text>
        </View>
      ) : (
        <>
          {/* Best bet */}
          <Pressable
            onPress={() => openSpot(best)}
            accessibilityRole="button"
            accessibilityLabel={`Best bet: ${best.spot.name}, score ${formatScore(best.total_score)}`}
            style={({ pressed }) => [styles.bestCard, pressed && styles.pressed]}
          >
            <Text style={styles.bestLabel}>BEST BET</Text>
            <View style={styles.bestRow}>
              <View style={styles.bestInfo}>
                <Text style={styles.bestName}>{best.spot.name}</Text>
                <RatingBadge rating={best.rating} score={best.total_score} />
              </View>
              <Text style={[styles.bestScore, { color: scoreToColor(best.total_score) }]}>
                {formatScore(best.total_score)}
              </Text>
            </View>
            <Text style={styles.summary} numberOfLines={2}>
              {best.summary}
            </Text>
          </Pressable>

          {/* Ranking */}
          <Text style={styles.sectionTitle}>RANKING</Text>
          <View style={styles.card}>
            {ranked.map((s, i) => (
              <Pressable
                key={s.spot.id}
                onPress={() => openSpot(s)}
                accessibilityRole="button"
                accessibilityLabel={`${i + 1}. ${s.spot.name}, score ${formatScore(s.total_score)}`}
                style={({ pressed }) => [
                  styles.rankRow,
                  i > 0 && styles.rowDivider,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.rank}>{i + 1}</Text>
                <View style={styles.rankBody}>
                  <View style={styles.rankHeader}>
                    <Text style={styles.rankName}>{s.spot.name}</Text>
                    <Text style={[styles.rankScore, { color: scoreToColor(s.total_score) }]}>
                      {formatScore(s.total_score)}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.max(2, Math.min(100, s.total_score * 10))}%`,
                          backgroundColor: scoreToColor(s.total_score),
                        },
                      ]}
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Side-by-side conditions */}
          {ranked.length > 1 && (
            <>
              <Text style={styles.sectionTitle}>CONDITIONS</Text>
              <View style={styles.card}>
                <View style={styles.tableRow}>
                  <Text style={[styles.tableLabel, styles.tableHead]} />
                  {ranked.map((s) => (
                    <Text key={s.spot.id} style={[styles.tableCell, styles.tableHead]} numberOfLines={1}>
                      {s.spot.name}
                    </Text>
                  ))}
                </View>
                {metricRows.map((row) => (
                  <View key={row.key} style={[styles.tableRow, styles.rowDivider]}>
                    <Text style={styles.tableLabel}>{row.label}</Text>
                    {row.values.map((v, i) => (
                      <Text
                        key={ranked[i].spot.id}
                        style={[styles.tableCell, row.bestIndex === i && styles.tableBest]}
                        numberOfLines={1}
                      >
                        {v}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
              <Text style={styles.footnote}>Highlighted values score best for that factor</Text>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  header: { gap: spacing.xs },
  title: { fontSize: 32, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 15, color: colors.textSecondary },
  chipsScroller: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: 'center',
    minWidth: 64,
  },
  chipActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  chipLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  chipLabelActive: { color: colors.accent },
  chipSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  chipSubActive: { color: colors.accentLight },
  pressed: { opacity: 0.8 },
  bestCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  bestLabel: { fontSize: 11, fontWeight: '700', color: colors.accent, letterSpacing: 1 },
  bestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bestInfo: { gap: spacing.sm, flex: 1 },
  bestName: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  bestScore: { fontSize: 44, fontWeight: '700', letterSpacing: -1 },
  summary: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: colors.textTertiary, letterSpacing: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  rank: { width: 20, fontSize: 15, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' },
  rankBody: { flex: 1, gap: spacing.sm },
  rankHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  rankName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  rankScore: { fontSize: 16, fontWeight: '700' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceLight, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  tableHead: { fontSize: 11, fontWeight: '600', color: colors.textTertiary },
  tableLabel: { width: 72, fontSize: 13, color: colors.textSecondary },
  tableCell: { flex: 1, fontSize: 13, color: colors.textPrimary, textAlign: 'center' },
  tableBest: { color: colors.accent, fontWeight: '700' },
  footnote: { fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: -spacing.sm },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  emptyDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});
