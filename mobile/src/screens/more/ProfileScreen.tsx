import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ScreenContainer, Header, Input, Button, Modal } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { useData } from '../../hooks/useData';
import { authService } from '../../services/authService';

export function ProfileScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { user, profile, logout, refreshProfile } = useAuth();
  const { trades } = useData();

  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [timezone, setTimezone] = useState(profile?.timezone || 'America/New_York');
  const [saving, setSaving] = useState(false);

  const handleUpdate = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      await authService.updateProfile(user.id, {
        fullName: fullName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        timezone: timezone.trim(),
      });
      await refreshProfile();
      setEditOpen(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const initial = (profile?.fullName || user?.email || 'T')[0].toUpperCase();

  return (
    <ScreenContainer scrollable>
      <Header
        title="Trader Profile"
        subtitle="Personal Details & Security"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
        rightAction={
          <TouchableOpacity onPress={() => {
            setFullName(profile?.fullName || '');
            setUsername(profile?.username || '');
            setBio(profile?.bio || '');
            setTimezone(profile?.timezone || 'America/New_York');
            setEditOpen(true);
          }}>
            <Text style={{ color: theme.colors.accent, fontSize: 15, fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
        }
      />

      {/* Hero Avatar Box */}
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
          },
          theme.shadows.card,
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.colors.accentDim, borderColor: theme.colors.accent }]}>
          <Text style={[styles.avatarText, { color: theme.colors.accent }]}>{initial}</Text>
        </View>
        <Text style={[styles.name, { color: theme.colors.text }]}>
          {profile?.fullName || 'Active Trader'}
        </Text>
        {profile?.username ? (
          <Text style={[styles.username, { color: theme.colors.accent }]}>@{profile.username}</Text>
        ) : null}
        <Text style={[styles.email, { color: theme.colors.textMuted }]}>{user?.email || ''}</Text>
      </View>

      {/* Account & Trading Statistics */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Journal Statistics</Text>
        <View
          style={[
            styles.infoBox,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.base },
          ]}
        >
          <View style={styles.infoRow}>
            <Text style={[styles.infoKey, { color: theme.colors.textMuted }]}>Total Lifetime Trades</Text>
            <Text style={[styles.infoVal, { color: theme.colors.text }]}>{trades.length}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoKey, { color: theme.colors.textMuted }]}>Timezone</Text>
            <Text style={[styles.infoVal, { color: theme.colors.text }]}>{profile?.timezone || 'America/New_York'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoKey, { color: theme.colors.textMuted }]}>User ID</Text>
            <Text style={[styles.infoVal, { color: theme.colors.textFaint, fontSize: 11 }]}>
              {user?.id ? `${user.id.slice(0, 16)}...` : 'Demo'}
            </Text>
          </View>
        </View>
      </View>

      {/* Bio / Trading Philosophy */}
      {profile?.bio ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trading Philosophy</Text>
          <View
            style={[
              styles.infoBox,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.base },
            ]}
          >
            <Text style={[styles.bioText, { color: theme.colors.text }]}>{profile.bio}</Text>
          </View>
        </View>
      ) : null}

      {/* Sign Out Button */}
      <Button
        title="Sign Out of EdgeJournal"
        onPress={() => logout()}
        variant="danger"
        size="md"
        style={styles.logoutBtn}
      />

      {/* Edit Profile Modal */}
      <Modal visible={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile Details">
        <Input label="Full Name" value={fullName} onChangeText={setFullName} />
        <Input label="Username / Handle" placeholder="trader_pro" value={username} onChangeText={setUsername} />
        <Input label="Trading Timezone" placeholder="America/New_York" value={timezone} onChangeText={setTimezone} />
        <Input
          label="Trading Bio / Philosophy"
          placeholder="Systematic trend follower, risk management first..."
          multiline
          numberOfLines={3}
          value={bio}
          onChangeText={setBio}
          inputStyle={{ minHeight: 70 }}
        />
        <Button
          title="Save Profile"
          onPress={handleUpdate}
          loading={saving}
          variant="primary"
          size="md"
          style={{ marginTop: 8 }}
        />
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
    marginTop: 12,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoBox: {
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoKey: {
    fontSize: 13,
  },
  infoVal: {
    fontSize: 14,
    fontWeight: '600',
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  logoutBtn: {
    marginTop: 30,
    marginBottom: 30,
  },
});
