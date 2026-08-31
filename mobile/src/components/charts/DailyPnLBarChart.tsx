import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import { Trade } from '../../types/models';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/formatters';

export interface DailyPnLBarChartProps {
  trades: Trade[];
  height?: number;
}

export function DailyPnLBarChart({ trades, height = 150 }: DailyPnLBarChartProps) {
  const { theme } = useTheme();

  // Aggregate by day
  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of trades) {
      const date = t.entryDate || 'Unknown';
      map[date] = (map[date] || 0) + (t.netPnl || 0);
    }
    return Object.entries(map)
      .map(([date, pnl]) => ({ date, pnl }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [trades]);

  const maxAbsPnl = useMemo(() => {
    if (dailyData.length === 0) return 100;
    const maxVal = Math.max(...dailyData.map((d) => Math.abs(d.pnl)));
    return maxVal > 0 ? maxVal * 1.15 : 100;
  }, [dailyData]);

  const winningDays = dailyData.filter((d) => d.pnl > 0).length;
  const losingDays = dailyData.filter((d) => d.pnl < 0).length;

  const width = 320;
  const paddingX = 10;
  const paddingY = 12;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;
  const zeroY = paddingY + chartH / 2;

  const barCount = dailyData.length || 1;
  const slotWidth = chartW / Math.max(barCount, 5);
  const barWidth = Math.max(Math.min(slotWidth * 0.7, 16), 4);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textMuted }]}>Daily Realized P&L Distribution</Text>
        <Text style={[styles.badgeText, { color: theme.colors.accent }]}>
          {winningDays} Green / {losingDays} Red Days
        </Text>
      </View>

      <View style={styles.chartWrapper}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Zero PnL Baseline */}
          <Line
            x1={paddingX}
            y1={zeroY}
            x2={width - paddingX}
            y2={zeroY}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1"
          />

          {dailyData.map((item, idx) => {
            const isPos = item.pnl >= 0;
            const barH = (Math.abs(item.pnl) / maxAbsPnl) * (chartH / 2);
            const bx = paddingX + idx * slotWidth + (slotWidth - barWidth) / 2;
            const by = isPos ? zeroY - barH : zeroY;

            return (
              <Rect
                key={item.date}
                x={bx}
                y={by}
                width={barWidth}
                height={Math.max(barH, 2)}
                rx="2"
                fill={isPos ? theme.colors.semantic.success : theme.colors.semantic.danger}
              />
            );
          })}
        </Svg>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.textFaint }]}>
          {dailyData[0]?.date || 'Oldest'}
        </Text>
        <Text style={[styles.footerText, { color: theme.colors.textFaint }]}>
          {dailyData[dailyData.length - 1]?.date || 'Latest'}
        </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerText: {
    fontSize: 11,
  },
});
