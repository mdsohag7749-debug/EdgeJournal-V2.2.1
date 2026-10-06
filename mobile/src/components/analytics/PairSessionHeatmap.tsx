import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Trade } from '../../types/models';
import {
  computePairSessionHeatmap,
  cellColor,
  HeatmapMetric,
  HeatmapCell,
  UNASSIGNED_LABEL,
} from '../../utils/heatmapEngine';
import { formatCurrency } from '../../utils/formatters';

interface PairSessionHeatmapProps {
  trades: Trade[];
}

export function PairSessionHeatmap({ trades }: PairSessionHeatmapProps) {
  const { theme } = useTheme();

  const [metric, setMetric] = useState<HeatmapMetric>('netPnl');
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);

  const heatmapData = useMemo(
    () => computePairSessionHeatmap(trades, { metric }),
    [trades, metric]
  );

  if (!heatmapData.hasData || heatmapData.rows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Heatmap Data</Text>
        <Text style={[styles.emptySub, { color: theme.colors.textMuted }]}>
          Log trades with trading pairs and entry times to render the Pair × Session matrix.
        </Text>
      </View>
    );
  }

  const formatCellValue = (cell: HeatmapCell) => {
    if (cell.decided === 0) return '—';
    if (metric === 'netPnl') {
      const pnl = cell.netPnl;
      const sign = pnl > 0 ? '+' : '';
      if (Math.abs(pnl) >= 1000) return `${sign}${(pnl / 1000).toFixed(1)}k`;
      return `${sign}$${Math.round(pnl)}`;
    }
    if (metric === 'winRate') {
      return `${Math.round(cell.winRate)}%`;
    }
    if (metric === 'avgRR') {
      return `${cell.avgRR > 0 ? cell.avgRR.toFixed(1) : '—'}R`;
    }
    return '—';
  };

  return (
    <View style={styles.container}>
      {/* Metric Selector Chips */}
      <View style={styles.metricChipsRow}>
        <TouchableOpacity
          onPress={() => setMetric('netPnl')}
          style={[
            styles.metricChip,
            metric === 'netPnl' && {
              backgroundColor: `${theme.colors.accent}20`,
              borderColor: theme.colors.accent,
            },
            { borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.metricChipText,
              { color: metric === 'netPnl' ? theme.colors.accent : theme.colors.textMuted },
            ]}
          >
            Net P&L
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMetric('winRate')}
          style={[
            styles.metricChip,
            metric === 'winRate' && {
              backgroundColor: `${theme.colors.accent}20`,
              borderColor: theme.colors.accent,
            },
            { borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.metricChipText,
              { color: metric === 'winRate' ? theme.colors.accent : theme.colors.textMuted },
            ]}
          >
            Win Rate
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMetric('avgRR')}
          style={[
            styles.metricChip,
            metric === 'avgRR' && {
              backgroundColor: `${theme.colors.accent}20`,
              borderColor: theme.colors.accent,
            },
            { borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.metricChipText,
              { color: metric === 'avgRR' ? theme.colors.accent : theme.colors.textMuted },
            ]}
          >
            Avg R:R
          </Text>
        </TouchableOpacity>
      </View>

      {/* Horizontally scrollable heatmap grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}>
        <View>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <View style={[styles.pairHeaderCell, { borderColor: theme.colors.border }]}>
              <Text style={[styles.columnHeaderText, { color: theme.colors.textMuted }]}>
                PAIR / SESSION
              </Text>
            </View>
            {heatmapData.sessions.map((s) => (
              <View key={s.key} style={[styles.sessionHeaderCell, { borderColor: theme.colors.border }]}>
                <Text style={[styles.columnHeaderText, { color: theme.colors.textMuted }]}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Matrix Rows */}
          {heatmapData.rows.map((row) => (
            <View key={row.pair} style={styles.tableRow}>
              {/* Pair Label Cell */}
              <View style={[styles.pairLabelCell, { borderColor: theme.colors.border }]}>
                <Text
                  style={[
                    styles.pairLabelText,
                    {
                      color:
                        row.pair === UNASSIGNED_LABEL ? theme.colors.textFaint : theme.colors.text,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {row.pair}
                </Text>
                <Text style={[styles.pairSubText, { color: theme.colors.textFaint }]}>
                  {row.totalTrades} {row.totalTrades === 1 ? 'trade' : 'trades'}
                </Text>
              </View>

              {/* Data Cells */}
              {row.cells.map((cell) => {
                const bgColor = cellColor(cell, metric, heatmapData.scale);
                const isSelected = selectedCell?.key === cell.key;
                return (
                  <TouchableOpacity
                    key={cell.key}
                    activeOpacity={0.7}
                    onPress={() => setSelectedCell(cell)}
                    style={[
                      styles.dataCell,
                      {
                        backgroundColor: bgColor,
                        borderColor: isSelected ? theme.colors.accent : 'transparent',
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellValueText,
                        {
                          color:
                            cell.decided === 0
                              ? theme.colors.textFaint
                              : '#FFFFFF',
                        },
                      ]}
                    >
                      {formatCellValue(cell)}
                    </Text>
                    <Text style={[styles.cellDecidedText, { color: 'rgba(255, 255, 255, 0.7)' }]}>
                      {cell.decided === 0 ? 'No data' : `${cell.decided} dec`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <Text style={[styles.legendFootnote, { color: theme.colors.textFaint }]}>
        Tap any cell to inspect detailed pair × session metrics. Cell intensity scales to live data.
      </Text>

      {/* Cell Detail Modal */}
      <Modal
        visible={!!selectedCell}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCell(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSelectedCell(null)}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            {selectedCell && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                      {selectedCell.pair} · {selectedCell.session}
                    </Text>
                    <Text style={[styles.modalSub, { color: theme.colors.textMuted }]}>
                      Sample: {selectedCell.status} ({selectedCell.trades} total trades)
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor:
                          selectedCell.status === 'Normal'
                            ? `${theme.colors.semantic.success}1A`
                            : selectedCell.status === 'Limited data'
                            ? `${theme.colors.semantic.warning}1A`
                            : 'rgba(255, 255, 255, 0.08)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        {
                          color:
                            selectedCell.status === 'Normal'
                              ? theme.colors.semantic.success
                              : selectedCell.status === 'Limited data'
                              ? theme.colors.semantic.warning
                              : theme.colors.textMuted,
                        },
                      ]}
                    >
                      {selectedCell.status}
                    </Text>
                  </View>
                </View>

                {/* Detail Metrics */}
                <View style={styles.modalMetricsGrid}>
                  <View style={styles.modalRow}>
                    <Text style={[styles.modalMetricLabel, { color: theme.colors.textMuted }]}>
                      Net P&L
                    </Text>
                    <Text
                      style={[
                        styles.modalMetricVal,
                        {
                          color:
                            selectedCell.netPnl >= 0
                              ? theme.colors.semantic.success
                              : theme.colors.semantic.danger,
                        },
                      ]}
                    >
                      {formatCurrency(selectedCell.netPnl)}
                    </Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={[styles.modalMetricLabel, { color: theme.colors.textMuted }]}>
                      Win Rate
                    </Text>
                    <Text style={[styles.modalMetricVal, { color: theme.colors.text }]}>
                      {selectedCell.decided > 0 ? `${selectedCell.winRate.toFixed(1)}%` : '—'}
                    </Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={[styles.modalMetricLabel, { color: theme.colors.textMuted }]}>
                      Wins / Losses
                    </Text>
                    <Text style={[styles.modalMetricVal, { color: theme.colors.text }]}>
                      {selectedCell.wins} Wins • {selectedCell.losses} Losses
                    </Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={[styles.modalMetricLabel, { color: theme.colors.textMuted }]}>
                      Average R:R
                    </Text>
                    <Text style={[styles.modalMetricVal, { color: theme.colors.text }]}>
                      {selectedCell.avgRR > 0 ? `${selectedCell.avgRR.toFixed(2)}R` : '—'}
                    </Text>
                  </View>

                  <View style={styles.modalRow}>
                    <Text style={[styles.modalMetricLabel, { color: theme.colors.textMuted }]}>
                      Profit Factor
                    </Text>
                    <Text style={[styles.modalMetricVal, { color: theme.colors.text }]}>
                      {selectedCell.profitFactor === Infinity
                        ? '∞'
                        : selectedCell.profitFactor > 0
                        ? selectedCell.profitFactor.toFixed(2)
                        : '0.00'}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedCell(null)}
                  style={[styles.closeButton, { backgroundColor: theme.colors.bgElevated }]}
                >
                  <Text style={[styles.closeButtonText, { color: theme.colors.text }]}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  metricChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  metricChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  metricChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tableScroll: {
    paddingBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 6,
  },
  pairHeaderCell: {
    width: 100,
    justifyContent: 'center',
  },
  sessionHeaderCell: {
    width: 85,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  pairLabelCell: {
    width: 100,
    paddingRight: 6,
  },
  pairLabelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pairSubText: {
    fontSize: 10,
  },
  dataCell: {
    width: 80,
    height: 52,
    borderRadius: 8,
    marginHorizontal: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellValueText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cellDecidedText: {
    fontSize: 9.5,
    marginTop: 2,
    fontWeight: '600',
  },
  legendFootnote: {
    fontSize: 11,
    marginTop: 4,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 11,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalMetricsGrid: {
    gap: 8,
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalMetricLabel: {
    fontSize: 12,
  },
  modalMetricVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  closeButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
