import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { AlertChannel, SpotInfo } from '../api/types';
import { colors, radius, spacing } from '../theme';
import {
  AlertFormValues,
  DEFAULT_FORM,
  FormErrors,
  MIN_SCORE_STEP,
  formatHourLabel,
  stepHour,
  stepScore,
  validateAlertForm,
} from '../utils/alerts';
import { formatScore, scoreToColor } from '../utils/formatting';

interface Props {
  visible: boolean;
  /** Present when editing; channel + destination are then read-only */
  initial?: AlertFormValues;
  isEditing: boolean;
  spots: SpotInfo[];
  isSaving: boolean;
  onCancel: () => void;
  onSave: (values: AlertFormValues) => void;
}

export function AlertEditor({ visible, initial, isEditing, spots, isSaving, onCancel, onSave }: Props) {
  const [values, setValues] = useState<AlertFormValues>(initial ?? DEFAULT_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  // Reset each time the sheet opens
  useEffect(() => {
    if (visible) {
      setValues(initial ?? DEFAULT_FORM);
      setErrors({});
    }
  }, [visible, initial]);

  const set = <K extends keyof AlertFormValues>(key: K, v: AlertFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const toggleSpot = (id: string) =>
    set(
      'spotIds',
      values.spotIds.includes(id) ? values.spotIds.filter((s) => s !== id) : [...values.spotIds, id],
    );

  const submit = () => {
    const errs = validateAlertForm(values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSave(values);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.toolbar}>
          <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button">
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.toolbarTitle}>{isEditing ? 'Edit alert' : 'New alert'}</Text>
          <Pressable onPress={submit} disabled={isSaving} hitSlop={12} accessibilityRole="button">
            {isSaving ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.save}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Channel */}
          <Text style={styles.label}>NOTIFY ME VIA</Text>
          <View style={styles.segment}>
            {(['telegram', 'email'] as AlertChannel[]).map((ch) => {
              const active = values.channel === ch;
              return (
                <Pressable
                  key={ch}
                  disabled={isEditing}
                  onPress={() => {
                    set('channel', ch);
                    set('destination', '');
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: isEditing }}
                  style={[styles.segmentItem, active && styles.segmentActive, isEditing && !active && styles.dim]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {ch === 'telegram' ? 'Telegram' : 'Email'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={values.destination}
            onChangeText={(t) => set('destination', t)}
            editable={!isEditing}
            placeholder={values.channel === 'telegram' ? 'Telegram chat ID, e.g. 123456789' : 'you@example.com'}
            placeholderTextColor={colors.textTertiary}
            keyboardType={values.channel === 'telegram' ? 'number-pad' : 'email-address'}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={values.channel === 'telegram' ? 21 : 128}
            style={[styles.input, isEditing && styles.dim, errors.destination && styles.inputError]}
            accessibilityLabel={values.channel === 'telegram' ? 'Telegram chat ID' : 'Email address'}
          />
          {errors.destination ? <Text style={styles.error}>{errors.destination}</Text> : null}
          <Text style={styles.hint}>
            {isEditing
              ? 'To change where alerts go, delete this alert and create a new one.'
              : values.channel === 'telegram'
                ? 'Your numeric Telegram chat ID (groups start with -).'
                : 'Alerts go to this address. To change it later, create a new alert.'}
          </Text>

          {/* Spots */}
          <Text style={styles.label}>SPOTS</Text>
          <View style={styles.spotChips}>
            {spots.map((s) => {
              const active = values.spotIds.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggleSpot(s.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  style={[styles.spotChip, active && styles.spotChipActive]}
                >
                  <Text style={[styles.spotChipText, active && styles.spotChipTextActive]}>
                    {active ? '✓ ' : ''}
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.spotIds ? <Text style={styles.error}>{errors.spotIds}</Text> : null}

          {/* Min score */}
          <Text style={styles.label}>ALERT WHEN SCORE IS AT LEAST</Text>
          <Stepper
            value={formatScore(values.minScore)}
            valueColor={scoreToColor(values.minScore)}
            onDecrement={() => set('minScore', stepScore(values.minScore, -MIN_SCORE_STEP))}
            onIncrement={() => set('minScore', stepScore(values.minScore, MIN_SCORE_STEP))}
            label="Minimum score"
          />

          {/* Quiet hours */}
          <Text style={styles.label}>QUIET HOURS (UTC)</Text>
          <View style={styles.quietRow}>
            <View style={styles.quietCol}>
              <Text style={styles.quietCaption}>From</Text>
              <Stepper
                value={formatHourLabel(values.quietStartHour)}
                onDecrement={() => set('quietStartHour', stepHour(values.quietStartHour, -1))}
                onIncrement={() => set('quietStartHour', stepHour(values.quietStartHour, 1))}
                label="Quiet hours start"
              />
            </View>
            <View style={styles.quietCol}>
              <Text style={styles.quietCaption}>To</Text>
              <Stepper
                value={formatHourLabel(values.quietEndHour)}
                onDecrement={() => set('quietEndHour', stepHour(values.quietEndHour, -1))}
                onIncrement={() => set('quietEndHour', stepHour(values.quietEndHour, 1))}
                label="Quiet hours end"
              />
            </View>
          </View>
          <Text style={styles.hint}>No alerts are sent during quiet hours. Set both to the same hour to turn them off.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Stepper({
  value,
  valueColor,
  onDecrement,
  onIncrement,
  label,
}: {
  value: string;
  valueColor?: string;
  onDecrement: () => void;
  onIncrement: () => void;
  label: string;
}) {
  return (
    <View style={styles.stepper} accessibilityLabel={`${label}: ${value}`}>
      <Pressable onPress={onDecrement} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Decrease ${label}`}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={[styles.stepValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Pressable onPress={onIncrement} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`Increase ${label}`}>
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  toolbarTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  cancel: { fontSize: 16, color: colors.textSecondary },
  save: { fontSize: 16, fontWeight: '700', color: colors.accent },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  label: { fontSize: 12, fontWeight: '600', color: colors.textTertiary, letterSpacing: 1, marginTop: spacing.md },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.background },
  dim: { opacity: 0.5 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputError: { borderColor: colors.error },
  error: { fontSize: 12, color: colors.error, marginTop: -spacing.xs },
  hint: { fontSize: 12, color: colors.textTertiary, lineHeight: 17 },
  spotChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  spotChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  spotChipActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  spotChipText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  spotChipTextActive: { color: colors.accent },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.xs,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 22, color: colors.textPrimary, fontWeight: '500' },
  stepValue: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  quietRow: { flexDirection: 'row', gap: spacing.md },
  quietCol: { flex: 1, gap: spacing.xs },
  quietCaption: { fontSize: 12, color: colors.textSecondary },
});
