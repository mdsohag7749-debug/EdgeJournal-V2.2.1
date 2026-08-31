import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Trade } from '../../types/models';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/formatters';

export interface WinLossDonutChartProps {
  trades: Trade[];
  size?: number;
}

export function WinLossDonutChart({ trades, size = 140 }: WinLossDonutChartProps) {
  const { theme } = useTheme();

  const total = trades.length;
  const wins = trades.filter((t) => t.netPnl > 0);
  const losses = trades.filter((t) => t.netPnl < 0);
  const breakEvens = trades.filter((t) => t.netPnl === 0);

  const winCount = wins.length;
  const lossCount = losses.length;
  const beCount = breakEvens.length;

  const winRate = total > 0 ? Math.round((winCount / total) * 100) : 0;
  const lossRate = total > 0 ? Math.round((lossCount / total) * 100) : 0;

  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const winOffset = 0;
  const winStroke = total > 0 ? (winCount / total) * circumference : 0;
  const lossStroke = total > 0 ? (lossCount / total) * circumference : 0;

  const totalWinPnl = wins.reduce((sum, t) => sum + t.netPnl, 0);
  const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.netPnl, 0));
  const avgWin = winCount > 0 ? totalWinPnl / winCount : 0;
  const avgLoss = lossCount > 0 ? totalLossPnl / lossCount : 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.textMuted }]}>Outcome Distribution & Win Rate</Text>

      <View style={styles.contentRow}>
        {/* Donut Chart */}
        <View style={styles.donutWrapper}>
          <Svg width={size} height={size}>
            <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
              {/* Background ring */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={strokeWidth}
                fill="none"
              />

              {/* Loss segment (Base) */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={theme.colors.semantic.danger}
                strokeWidth={strokeWidth}
                strokeDasharray={`${lossStroke} ${circumference}`}
                strokeDashoffset={-winStroke}
                fill="none"
              />

              {/* Win segment */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={theme.colors.semantic.success}
                strokeWidth={strokeWidth}
                strokeDasharray={`${winStroke} ${circumference}`}
                strokeDashoffset={winOffset}
                fill="none"
              />
            </G>
          </Svg>

          {/* Center Win Rate */}
          <View style={styles.centerTextContainer}>
            <Text style={[styles.winRateNum, { color: theme.colors.text }]}>{winRate}%</Text>
            <Text style={[styles.winRateLabel, { color: theme.colors.textMuted }]}>WIN RATE</Text>
          </View>
        </View>

        {/* Legend / Metrics */}
        <View style={styles.legendCol}>
          <View style={styles.legendItem}>
            <View style={[styles.indicator, { backgroundColor: theme.colors.semantic.success }]} />
            <View>
              <Text style={[styles.legendName, { color: theme.colors.text }]}>
                WIN ({winCount} trades • {winRate}%)
              </Text>
              <Text style={[styles.legendSub, { color: theme.colors.semantic.success }]}>
                Avg Win: +{formatCurrency(avgWin)}
              </Text>
            </View>
          </View>

          <View style={styles.legendItem}>
            <View style={[styles.indicator, { backgroundColor: theme.colors.semantic.danger }]} />
            <View>
              <Text style={[styles.legendName, { color: theme.colors.text }]}>
                LOSS ({lossCount} trades • {lossRate}%)
              </Text>
              <Text style={[styles.legendSub, { color: theme.colors.semantic.danger }]}>
                Avg Loss: -{formatCurrency(avgLoss)}
              </Text>
            </View>
          </View>

          {beCount > 0 && (
            <View style={styles.legendItem}>
              <View style={[styles.indicator, { backgroundColor: theme.colors.textMuted }]} />
              <Text style={[styles.legendName, { color: theme.colors.textMuted }]}>
                BREAK-EVEN ({beCount} trades)
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  donutWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  winRateNum: {
    fontSize: 22,
    fontWeight: '800',
  },
  winRateLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  legendCol: {
    flex: 1,
    marginLeft: 16,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  legendName: {
    fontSize: 13,
    fontWeight: '700',
  },
  legendSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
