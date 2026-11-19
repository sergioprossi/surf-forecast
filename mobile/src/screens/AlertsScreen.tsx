import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AlertConfig } from '../api/types';
import { AlertEditor, ErrorState, Icon, LoadingSpinner } from '../components';
import { useAlerts, useCreateAlert, useDeleteAlert, useUpdateAlert } from '../hooks/useAlerts';
import { useAuth } from '../hooks/useAuth';
import { useSpots } from '../hooks/useForecast';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import {
  AlertFormValues,
  alertToForm,
  extractApiError,
  formatQuietHours,
  maskDestination,
  spotNames,
  toCreatePayload,
  toUpdatePayload,
} from '../utils/alerts';
import { formatScore, scoreToColor } from '../utils/formatting';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const alerts = useAlerts();
  const spots = useSpots();
  const createAlert = useCreateAlert();
  const updateAlert = useUpdateAlert();
  const deleteAlert = useDeleteAlert();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AlertConfig | null>(null);

  const spotList = spots.data?.spots ?? [];
  const nameById = useMemo(
    () => Object.fromEntries(spotList.map((s) => [s.id, s.name])),
    [spotList],
  );
  const editingForm = useMemo(() => (editing ? alertToForm(editing) : undefined), [editing]);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (a: AlertConfig) => {
    setEditing(a);
    setEditorOpen(true);
  };

  const onSave = (values: AlertFormValues) => {
    const done = { onSuccess: () => setEditorOpen(false), onError: showError };
    if (editing) {
      updateAlert.mutate({ id: editing.id, body: toUpdatePayload(values) }, done);
    } else {
      createAlert.mutate(toCreatePayload(values), done);
    }
  };

  const confirmDelete = (a: AlertConfig) =>
    Alert.alert('Delete alert?', spotNames(a.spot_ids, nameById), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteAlert.mutate(a.id, { onError: showError }),
      },
    ]);

  if (authLoading) return <LoadingSpinner />;

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.iconCircle}>
          <Icon name="bell" size={34} color={colors.accent} />
        </View>
        <Text style={styles.signedOutTitle}>Never miss a session</Text>
        <Text style={styles.signedOutDesc}>
          Sign in to get Telegram or email alerts when your spots hit your score.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Auth', { screen: 'Login' })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (alerts.isLoading) return <LoadingSpinner message="Loading alerts..." />;

  if (alerts.isError) {
    return (
      <ErrorState
        message={extractApiError(alerts.error, "Couldn't load your alerts.")}
        onRetry={() => alerts.refetch()}
      />
    );
  }

  const items = alerts.data ?? [];

  return (
    <>
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={alerts.isRefetching}
            onRefresh={() => alerts.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Alerts</Text>
            <Text style={styles.subtitle}>Get pinged when it's firing</Text>
          </View>
          <Pressable
            onPress={openNew}
            accessibilityRole="button"
            accessibilityLabel="New alert"
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          >
            <Icon name="plus" size={16} color={colors.accent} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>New</Text>
          </Pressable>
        </View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No alerts yet</Text>
            <Text style={styles.emptyDesc}>
              Pick your spots and a minimum score. We'll message you when the forecast beats it.
            </Text>
            <Pressable
              onPress={openNew}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Create alert</Text>
            </Pressable>
          </View>
        ) : (
          items.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => openEdit(a)}
              onLongPress={() => confirmDelete(a)}
              accessibilityRole="button"
              accessibilityHint="Tap to edit, long press to delete"
              style={({ pressed }) => [styles.card, !a.enabled && styles.cardDisabled, pressed && styles.pressed]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.channelRow}>
                  <View style={styles.channelIcon}>
                    <Icon name={a.channel === 'telegram' ? 'send' : 'mail'} size={20} color={colors.accent} />
                  </View>
                  <View>
                    <Text style={styles.channelName}>
                      {a.channel === 'telegram' ? 'Telegram' : 'Email'}
                    </Text>
                    <Text style={styles.destination}>{maskDestination(a)}</Text>
                  </View>
                </View>
                <Switch
                  value={a.enabled}
                  onValueChange={(enabled) =>
                    updateAlert.mutate({ id: a.id, body: { enabled } }, { onError: showError })
                  }
                  trackColor={{ false: colors.surfaceLight, true: colors.accent }}
                  thumbColor={colors.textPrimary}
                  accessibilityLabel={a.enabled ? 'Disable alert' : 'Enable alert'}
                />
              </View>

              <Text style={styles.spots}>{spotNames(a.spot_ids, nameById)}</Text>

              <View style={styles.metaRow}>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>Score ≥ </Text>
                  <Text style={[styles.pillValue, { color: scoreToColor(a.min_score) }]}>
                    {formatScore(a.min_score)}
                  </Text>
                </View>
                <View style={styles.pill}>
                  <Text style={styles.pillLabel}>Quiet </Text>
                  <Text style={styles.pillValue}>
                    {formatQuietHours(a.quiet_start_hour, a.quiet_end_hour)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => confirmDelete(a)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Delete alert"
                  style={styles.deleteBtn}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
        {items.length > 0 && (
          <Text style={styles.footerHint}>Tap a card to edit · long press to delete</Text>
        )}
      </ScrollView>

      <AlertEditor
        visible={editorOpen}
        initial={editingForm}
        isEditing={editing != null}
        spots={spotList}
        isSaving={createAlert.isPending || updateAlert.isPending}
        onCancel={() => setEditorOpen(false)}
        onSave={onSave}
      />
    </>
  );
}

function showError(err: unknown) {
  Alert.alert("Couldn't save", extractApiError(err));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  pressed: { opacity: 0.8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { gap: spacing.xs },
  title: { fontSize: 32, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 15, color: colors.textSecondary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    backgroundColor: colors.accentDim,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
  },
  addBtnText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  signedOutTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  signedOutDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  primaryBtnText: { color: colors.background, fontWeight: '700', fontSize: 15 },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  emptyDesc: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  cardDisabled: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  destination: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  spots: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillLabel: { fontSize: 12, color: colors.textSecondary },
  pillValue: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  deleteBtn: { marginLeft: 'auto', minHeight: 44, justifyContent: 'center' },
  footerHint: { fontSize: 12, color: colors.textTertiary, textAlign: 'center' },
  deleteText: { fontSize: 13, color: colors.error, fontWeight: '600' },
});
