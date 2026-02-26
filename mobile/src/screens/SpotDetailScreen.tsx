import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  BestWindowCard,
  ComponentBreakdown,
  ErrorState,
  FeedbackCTA,
  LoadingSpinner,
  RatingBadge,
  ScoreBadge,
  SwellInfo,
  TideChart,
  WindIndicator,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { useBestWindows, useForecast } from '../hooks/useForecast';
import type { HomeStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import {
  degreeToCompass,
  formatPeriod,
  formatWaveHeight,
  formatWindSpeed,
  scoreToColor,
} from '../utils/formatting';

type Props = NativeStackScreenProps<HomeStackParamList, 'SpotDetail'>;

export function SpotDetailScreen({ route, navigation }: Props) {
  const { spotId } = route.params;
  const { isAuthenticated } = useAuth();
  const forecast = useForecast(spotId);
  const bestWindows = useBestWindows();

  if (forecast.isLoading) {
    return <LoadingSpinner message="Loading forecast..." />;
  }

  if (forecast.isError || !forecast.data) {
    return (
      <ErrorState
        message="Couldn't load forecast data"
        onRetry={() => forecast.refetch()}
      />
    );
  }

  const { spot, forecast: slots } = forecast.data;
  const current = slots[0];
  if (!current) {
    return <ErrorState message="No forecast data available for this spot" />;
  }

  const { conditions, components } = current;
  const spotWindows = (bestWindows.data?.windows ?? []).filter(
    (w) => w.spot.id === spotId,
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Score hero */}
      <View style={styles.hero}>
        <ScoreBadge score={current.total_score} size="large" />
        <RatingBadge rating={current.rating} score={current.total_score} />
        <Text style={styles.heroDate}>
          {new Date(current.time).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
        </Text>
      </View>

      {/* Quick condition tags */}
      <View style={styles.tagsRow}>
        <Tag label={formatWaveHeight(conditions.wave_height)} sublabel="Wave" />
        <Tag label={formatPeriod(conditions.wave_period)} sublabel="Period" />
        <Tag label={formatWindSpeed(conditions.wind_speed)} sublabel="Wind" />
      </View>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        <StatCard
          title="Wave Height"
          value={formatWaveHeight(conditions.wave_height)}
          subtitle={degreeToCompass(conditions.wave_direction)}
        />
        <StatCard
          title="Period"
          value={formatPeriod(conditions.wave_period)}
          subtitle="Wave period"
        />
        <StatCard
          title="Wind"
          value={formatWindSpeed(conditions.wind_speed)}
          subtitle={degreeToCompass(conditions.wind_direction)}
        />
      </View>

      {/* Tide chart */}
      <SectionHeader title="TIDE" />
      <TideChart slots={slots} />

      {/* Swell details */}
      <SectionHeader title="SWELL" />
      <View style={styles.swellRow}>
        <SwellInfo
          label="Primary"
          height={conditions.swell_height}
          period={conditions.swell_period}
          direction={conditions.swell_direction}
          style={styles.swellCard}
        />
      </View>

      {/* Wind */}
      <SectionHeader title="WIND" />
      <View style={styles.windCard}>
        <WindIndicator
          speed={conditions.wind_speed}
          direction={conditions.wind_direction}
          windTrend={components.wind_trend}
        />
      </View>

      {/* Component breakdown */}
      <SectionHeader title="SCORE BREAKDOWN" />
      <View style={styles.breakdownCard}>
        <ComponentBreakdown components={components} />
      </View>

      {/* Hourly forecast */}
      <SectionHeader title="HOURLY FORECAST" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.hourlyRow}>
          {slots.slice(0, 24).map((slot, i) => {
            const h = new Date(slot.time).getHours();
            const slotColor = scoreToColor(slot.total_score);
            return (
              <View key={i} style={styles.hourBlock}>
                <Text style={styles.hourTime}>{h}h</Text>
                <View
                  style={[
                    styles.hourScoreBox,
                    { backgroundColor: slotColor + '22' },
                  ]}
                >
                  <Text style={[styles.hourScore, { color: slotColor }]}>
                    {slot.total_score.toFixed(1)}
                  </Text>
                </View>
                <Text style={styles.hourRating}>
                  {slot.rating.slice(0, 4)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Best windows */}
      {spotWindows.length > 0 && (
        <>
          <SectionHeader title="BEST WINDOWS" />
          {spotWindows.map((w, i) => (
            <BestWindowCard
              key={i}
              start={w.start}
              end={w.end}
              peakScore={w.peak_score}
              rating={w.rating}
            />
          ))}
        </>
      )}

      {/* Feedback CTA */}
      <FeedbackCTA
        onPress={() => {
          if (!isAuthenticated) {
            Alert.alert(
              'Sign in required',
              'You need to sign in to rate your session.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign In',
                  onPress: () => {
                    // Navigate to auth — would need root navigator ref
                    // For MVP, just alert
                  },
                },
              ],
            );
          } else {
            Alert.alert('Coming soon', 'Session rating will be available in the next update.');
          }
        }}
        style={styles.feedbackButton}
      />

      {/* Summary */}
      <Text style={styles.summary}>{current.summary}</Text>
    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Tag({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagValue}>{label}</Text>
      <Text style={styles.tagLabel}>{sublabel}</Text>
    </View>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
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
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  heroDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tag: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  tagValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tagLabel: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  statTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  swellRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  swellCard: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  windCard: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  breakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  hourlyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hourBlock: {
    alignItems: 'center',
    gap: 4,
    width: 48,
  },
  hourTime: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  hourScoreBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourScore: {
    fontSize: 13,
    fontWeight: '700',
  },
  hourRating: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  feedbackButton: {
    marginTop: spacing.sm,
  },
  summary: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
});
