import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, Input, Button } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

export function ForgotPasswordScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { theme } = useTheme();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(route?.params?.email || '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(trimmed);
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to send a reset link right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.header}>
        <Text style={[styles.brand, { color: theme.colors.accent }]}>EdgeJournal</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {sent
            ? `If an account exists for ${email.trim()}, a reset link is on its way.`
            : "Enter the email tied to your account and we'll send you a password reset link."}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {sent ? (
          <View style={styles.successBox}>
            <View style={[styles.successIconCircle, { backgroundColor: 'rgba(46, 213, 115, 0.15)' }]}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={[styles.successTitle, { color: theme.colors.text }]}>Reset Link Sent</Text>
            <Text style={[styles.successSubtitle, { color: theme.colors.textMuted }]}>
              Check your inbox (and spam folder) for password reset instructions.
            </Text>

            <Button
              title="Back to Sign In"
              onPress={() => navigation.navigate('Login')}
              variant="primary"
              size="lg"
              style={styles.button}
            />

            <TouchableOpacity onPress={() => setSent(false)} style={styles.retryLink}>
              <Text style={{ color: theme.colors.accent, fontSize: 13.5, fontWeight: '600' }}>
                Try a different email
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {error ? <Text style={[styles.errorText, { color: theme.colors.semantic.danger }]}>{error}</Text> : null}

            <Input
              label="Email Address"
              placeholder="trader@edgejournal.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError('');
              }}
            />

            <Button
              title="Send Reset Link"
              onPress={handleReset}
              loading={loading}
              variant="primary"
              size="lg"
              style={styles.button}
            />

            <View style={styles.footerRow}>
              <Text style={{ color: theme.colors.textMuted }}>Remembered your password? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 40,
    marginBottom: 30,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  brand: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successIconText: {
    color: '#2ed573',
    fontSize: 26,
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  retryLink: {
    marginTop: 16,
    padding: 6,
  },
});
