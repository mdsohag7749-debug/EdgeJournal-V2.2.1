import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export interface OfflineBannerProps {
  isOffline: boolean;
  pendingCount: number;
  onSyncPress?: () => void;
  lastSynced?: string;
}

export function OfflineBanner({
  isOffline,
  pendingCount,
  onSyncPress,
  lastSynced,
}: OfflineBannerProps) {
  const { theme } = useTheme();

  if (!isOffline && pendingCount === 0) return null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isOffline
            ? theme.colors.semantic.warningDim
            : theme.colors.semantic.aiAccentDim,
          borderColor: isOffline
            ? theme.colors.semantic.warning
            : theme.colors.semantic.aiAccent,
        },
      ]}
    >
      <View style={styles.textCol}>
        <Text
          style={[
            styles.title,
            {
              color: isOffline
                ? theme.colors.semantic.warning
                : theme.colors.semantic.aiAccent,
            },
          ]}
        >
          {isOffline ? '⚡ Offline Mode' : '🔄 Syncing Changes'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          {pendingCount > 0
            ? `${pendingCount} pending change${pendingCount > 1 ? 's' : ''} queued`
            : lastSynced
            ? `Cached data • Last synced ${lastSynced}`
            : 'Viewing cached journal data'}
        </Text>
      </View>

      {onSyncPress && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onSyncPress}
          style={[
            styles.syncBtn,
            {
              backgroundColor: isOffline
                ? theme.colors.semantic.warning
                : theme.colors.semantic.aiAccent,
            },
          ]}
        >
          <Text style={styles.syncBtnText}>Sync Now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  syncBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 10,
  },
  syncBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '700',
  },
});
