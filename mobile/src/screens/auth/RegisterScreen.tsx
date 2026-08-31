import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, Input, Button } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

export function RegisterScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.header}>
        <Text style={[styles.brand, { color: theme.colors.accent }]}>EdgeJournal</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Build your disciplined trading edge today
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {error ? <Text style={[styles.errorText, { color: theme.colors.semantic.danger }]}>{error}</Text> : null}

        <Input
          label="Full Name"
          placeholder="Alex Mercer"
          value={name}
          onChangeText={setName}
        />

        <Input
          label="Email Address"
          placeholder="trader@edgejournal.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Input
          label="Password"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Button
          title="Sign Up"
          onPress={handleRegister}
          loading={loading}
          variant="primary"
          size="lg"
          style={styles.button}
        />

        <View style={styles.footerRow}>
          <Text style={{ color: theme.colors.textMuted }}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={{ color: theme.colors.accent, fontWeight: '600' }}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 40,
    marginBottom: 30,
    alignItems: 'center',
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
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
