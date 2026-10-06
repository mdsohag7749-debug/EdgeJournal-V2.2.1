import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ScreenContainer, Header, Badge, Button, Modal, ScreenshotPicker } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '../../hooks/useData';
import { Trade } from '../../types/models';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PSYCH_EMOTIONS } from '../../components/trade/PsychologyMatrix';
import { DEFAULT_RISK_CRITERIA, DEFAULT_CHECKLIST_CRITERIA } from '../../components/trade/ChecklistSection';

export function TradeDetailsScreen({ navigation, route }: { navigation: any; route: any }) {
  const { theme } = useTheme();
  const { deleteTrade, trades, riskCriteria, checklistCriteria } = useData();
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
        subtitle={`${formatDate(trade.entryDate)} ${trade.entryTime ? `• ${trade.entryTime}` : ''} ${trade.exitTime ? `→ ${trade.exitTime}` : ''}`}
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
            <View style={styles.badgeRow}>
              <Badge
                label={trade.direction}
                variant={trade.direction === 'Long' ? 'success' : 'danger'}
                size="md"
              />
              {trade.tradeGrade ? (
                <Badge
                  label={`Grade: ${trade.tradeGrade}`}
                  variant="accent"
                  size="md"
                />
              ) : null}
            </View>
            <View style={[styles.badgeRow, { marginTop: 6 }]}>
              {trade.riskRewardRatio ? (
                <Badge
                  label={`${trade.riskRewardRatio.toFixed(1)}R`}
                  variant="neutral"
                  size="md"
                />
              ) : null}
              {trade.disciplineRating !== undefined ? (
                <Badge
                  label={`Discipline: ${trade.disciplineRating}/10`}
                  variant="neutral"
                  size="md"
                />
              ) : null}
            </View>
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
          {trade.entryTime ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Entry Time</Text>
              <Text style={[styles.detailVal, { color: theme.colors.text }]}>{trade.entryTime}</Text>
            </View>
          ) : null}
          {trade.exitTime ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Exit Time</Text>
              <Text style={[styles.detailVal, { color: theme.colors.text }]}>{trade.exitTime}</Text>
            </View>
          ) : null}
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
          {trade.riskPercent !== undefined ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Risk %</Text>
              <Text style={[styles.detailVal, { color: theme.colors.text }]}>{trade.riskPercent.toFixed(2)}%</Text>
            </View>
          ) : null}
          {trade.commission !== undefined ? (
            <View style={styles.detailRow}>
              <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>Commission</Text>
              <Text style={[styles.detailVal, { color: theme.colors.text }]}>{formatCurrency(trade.commission)}</Text>
            </View>
          ) : null}
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

      {/* Execution Mistakes */}
      {trade.mistakes && trade.mistakes.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.semantic.danger }]}>Execution Mistakes</Text>
          <View style={styles.tagWrap}>
            {trade.mistakes.map((m, idx) => (
              <Badge key={idx} label={`⚠️ ${m}`} variant="danger" size="md" />
            ))}
          </View>
        </View>
      )}

      {/* Confluences & Trade Management */}
      {(trade.confluences || trade.tradeManagement || trade.lessonsLearned) && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Execution Reflections</Text>
          <View style={[styles.detailBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {trade.confluences ? (
              <View style={styles.reflectionBlock}>
                <Text style={[styles.reflectionLabel, { color: theme.colors.accent }]}>Confluences</Text>
                <Text style={[styles.reflectionText, { color: theme.colors.text }]}>{trade.confluences}</Text>
              </View>
            ) : null}
            {trade.tradeManagement ? (
              <View style={styles.reflectionBlock}>
                <Text style={[styles.reflectionLabel, { color: theme.colors.semantic.info }]}>Trade Management</Text>
                <Text style={[styles.reflectionText, { color: theme.colors.text }]}>{trade.tradeManagement}</Text>
              </View>
            ) : null}
            {trade.lessonsLearned ? (
              <View style={styles.reflectionBlock}>
                <Text style={[styles.reflectionLabel, { color: theme.colors.semantic.warning }]}>Lessons Learned</Text>
                <Text style={[styles.reflectionText, { color: theme.colors.text }]}>{trade.lessonsLearned}</Text>
              </View>
            ) : null}
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

      {/* Psychology Ratings Summary */}
      {trade.psychology && Object.keys(trade.psychology).length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trading Psychology</Text>
          <View style={[styles.detailBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {PSYCH_EMOTIONS.filter((e) => trade.psychology![e.key] !== undefined).map((emotion) => {
              const val = trade.psychology![emotion.key];
              const isPos = emotion.tone === 'pos';
              const barColor = isPos ? theme.colors.semantic.success : theme.colors.semantic.danger;
              return (
                <View key={emotion.key} style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: theme.colors.textMuted }]}>{emotion.label}</Text>
                  <View style={styles.psychRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <View
                        key={n}
                        style={[
                          styles.psychDot,
                          {
                            backgroundColor: n <= val ? barColor : theme.colors.bgElevated,
                            borderColor: n <= val ? barColor : theme.colors.border,
                          },
                        ]}
                      />
                    ))}
                    <Text style={[styles.psychScore, { color: barColor }]}>{val}/5</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Risk Management Checklist Summary */}
      {trade.riskChecklist && Object.keys(trade.riskChecklist).length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Risk Management</Text>
          <View style={[styles.detailBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {Array.from(new Set([...(riskCriteria || []), ...Object.keys(trade.riskChecklist)])).map((item) => {
              const checked = !!trade.riskChecklist![item];
              return (
                <View key={item} style={styles.checklistRow}>
                  <Text style={{ color: checked ? theme.colors.semantic.success : theme.colors.semantic.danger, fontSize: 14, fontWeight: '700' }}>
                    {checked ? '✓' : '✗'}
                  </Text>
                  <Text style={[styles.checklistItem, { color: checked ? theme.colors.text : theme.colors.textMuted }]}>
                    {item}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Trade Execution Checklist Summary */}
      {trade.tradeChecklist && Object.keys(trade.tradeChecklist).length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trade Checklist</Text>
          <View style={[styles.detailBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {Array.from(new Set([...(checklistCriteria || []), ...Object.keys(trade.tradeChecklist)])).map((item) => {
              const checked = !!trade.tradeChecklist![item];
              return (
                <View key={item} style={styles.checklistRow}>
                  <Text style={{ color: checked ? theme.colors.semantic.success : theme.colors.semantic.danger, fontSize: 14, fontWeight: '700' }}>
                    {checked ? '✓' : '✗'}
                  </Text>
                  <Text style={[styles.checklistItem, { color: checked ? theme.colors.text : theme.colors.textMuted }]}>
                    {item}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Execution Screenshots Gallery */}
      <View style={styles.section}>
        <ScreenshotPicker tradeId={trade.id} />
      </View>

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
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  aiButton: {
    marginTop: 14,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
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
  reflectionBlock: {
    paddingVertical: 4,
    gap: 3,
  },
  reflectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reflectionText: {
    fontSize: 13,
    lineHeight: 19,
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
  psychRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  psychDot: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
  },
  psychScore: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  checklistItem: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

