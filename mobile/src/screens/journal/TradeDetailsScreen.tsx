import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ScreenContainer, Header, Badge, Button, Modal } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '../../hooks/useData';
import { Trade } from '../../types/models';
import { formatCurrency, formatDate } from '../../utils/formatters';

export function TradeDetailsScreen({ navigation, route }: { navigation: any; route: any }) {
  const { theme } = useTheme();
  const { deleteTrade, trades } = useData();
  const tradeParam = route?.params?.trade;
  const tradeIdParam = route?.params?.tradeId;
  const trade: Trade | undefined =
    tradeParam || trades.find((t) => t.id === (tradeIdParam || tradeParam?.id));

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!trade) {
    return (
      <ScreenContainer scrollable>
        <Header
          title="Trade Details"
          leftAction={
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
            </TouchableOpacity>
          }
        />
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 15 }}>Trade not found or removed.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const isWin = trade.netPnl > 0;
  const isLoss = trade.netPnl < 0;
  const pnlColor = isWin
    ? theme.colors.semantic.success
    : isLoss
    ? theme.colors.semantic.danger
    : theme.colors.textMuted;

  const handleDelete = async () => {
    setDeleting(true);
    const success = await deleteTrade(trade.id);
    setDeleting(false);
    setDeleteModalOpen(false);
    if (success) {
      navigation.goBack();
    } else {
      Alert.alert('Error', 'Failed to delete trade.');
    }
  };

  const handleReviewWithAI = () => {
    // Navigate to Edge AI tab with trade context
    navigation.navigate('Main', {
      screen: 'EdgeAITab',
      params: { initialTrade: trade, initialFeature: 'review' },
    });
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title={trade.symbol}
        subtitle={`${formatDate(trade.entryDate)} ${trade.entryTime ? `• ${trade.entryTime}` : ''}`}
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
        rightAction={
          <TouchableOpacity onPress={() => navigation.navigate('EditTrade', { trade })}>
            <Text style={{ color: theme.colors.accent, fontSize: 15, fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
        }
      />

      {/* PnL Hero Header */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
          },
          theme.shadows.card,
        ]}
      >
        <View style={styles.heroRow}>
          <View>
            <Text style={[styles.heroLabel, { color: theme.colors.textMuted }]}>Realized Net P&L</Text>
            <Text style={[styles.heroPnl, { color: pnlColor }]}>
              {formatCurrency(trade.netPnl)}
            </Text>
          </View>
          <View style={styles.badgeCol}>
            <Badge
              label={trade.direction}
              variant={trade.direction === 'Long' ? 'success' : 'danger'}
              size="md"
            />
            {trade.riskRewardRatio ? (
              <Badge
                label={`${trade.riskRewardRatio.toFixed(1)}R`}
                variant="accent"
                size="md"
                style={{ marginTop: 6 }}
              />
            ) : null}
          </View>
        </View>
      </View>

      {/* AI Review Trigger */}
      <Button
        title="✨ Review this Trade with Edge AI"
        onPress={handleReviewWithAI}
        variant="ai"
        size="md"
        style={styles.aiButton}
      />

      {/* Execution Details Table */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Execution Details</Text>
        <View
          style={[
            styles.detailBox,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Entry Price</Text>
            <Text style={[styles.detailVal, { color: theme.colors.text }]}>${trade.entryPrice.toFixed(2)}</Text>
          </View>
          {trade.exitPrice !== undefined && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Exit Price</Text>
              <Text style={[styles.detailVal, { color: theme.colors.text }]}>${trade.exitPrice.toFixed(2)}</Text>
            </View>
          )}
          {trade.stopLoss !== undefined && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Stop Loss</Text>
              <Text style={[styles.detailVal, { color: theme.colors.semantic.danger }]}>${trade.stopLoss.toFixed(2)}</Text>
            </View>
          )}
          {trade.takeProfit !== undefined && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Take Profit</Text>
              <Text style={[styles.detailVal, { color: theme.colors.semantic.success }]}>${trade.takeProfit.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Position Size</Text>
            <Text style={[styles.detailVal, { color: theme.colors.text }]}>{trade.size} units</Text>
          </View>
          {trade.session ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Market Session</Text>
              <Text style={[styles.detailVal, { color: theme.colors.text }]}>{trade.session}</Text>
            </View>
          ) : null}
          {trade.timeframe ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Execution Timeframe</Text>
              <Text style={[styles.detailVal, { color: theme.colors.text }]}>{trade.timeframe}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Setup & Strategy */}
      {(trade.setup || (trade.tags && trade.tags.length > 0)) && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Strategy & Tags</Text>
          <View style={styles.tagWrap}>
            {trade.setup ? <Badge label={`Setup: ${trade.setup}`} variant="neutral" size="md" /> : null}
            {trade.tags?.map((t, idx) => (
              <Badge key={idx} label={`#${t}`} variant="accent" size="md" />
            ))}
          </View>
        </View>
      )}

      {/* Notes & Observations */}
      {trade.notes ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trader Notes</Text>
          <View
            style={[
              styles.notesBox,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <Text style={[styles.notesText, { color: theme.colors.text }]}>{trade.notes}</Text>
          </View>
        </View>
      ) : null}

      {/* Delete Button */}
      <Button
        title="Delete Trade"
        onPress={() => setDeleteModalOpen(true)}
        variant="danger"
        size="md"
        style={styles.deleteBtn}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Trade"
      >
        <Text style={[styles.modalWarning, { color: theme.colors.textMuted }]}>
          Are you sure you want to permanently delete this {trade.symbol} trade? This action will remove it from your journal and recalculate account balance metrics.
        </Text>
        <View style={styles.modalActions}>
          <Button
            title="Cancel"
            onPress={() => setDeleteModalOpen(false)}
            variant="outline"
            size="md"
            style={{ flex: 1 }}
          />
          <Button
            title="Delete"
            onPress={handleDelete}
            loading={deleting}
            variant="danger"
            size="md"
            style={{ flex: 1 }}
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 20,
    borderWidth: 1,
    marginTop: 12,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroPnl: {
    fontSize: 28,
    fontWeight: '800',
  },
  badgeCol: {
    alignItems: 'flex-end',
  },
  aiButton: {
    marginTop: 14,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  detailBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailKey: {
    fontSize: 13,
  },
  detailVal: {
    fontSize: 14,
    fontWeight: '600',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  notesBox: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteBtn: {
    marginTop: 30,
    marginBottom: 20,
  },
  modalWarning: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
});
