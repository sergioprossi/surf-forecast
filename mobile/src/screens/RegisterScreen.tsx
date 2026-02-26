import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../hooks/useAuth';
import type { AuthStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password || !confirm) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password);
      navigation.getParent()?.goBack();
    } catch {
      Alert.alert('Registration failed', 'This email may already be registered. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.form}>
        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.subheading}>Join to rate sessions and get surf alerts</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Password (min 8 characters)"
          placeholderTextColor={colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor={colors.textTertiary}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
        />

        <Pressable
          onPress={handleRegister}
          disabled={loading}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
        >
          <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Account'}</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>
            Already have an account? <Text style={styles.linkBold}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  form: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: spacing.lg,
    fontSize: 16,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  linkBold: {
    color: colors.accent,
    fontWeight: '600',
  },
});
