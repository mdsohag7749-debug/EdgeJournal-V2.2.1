import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Trade } from '../../types/models';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/formatters';

export interface SetupPerformanceBarChartProps {
  trades: Trade[];
}

export function SetupPerformanceBarChart({ trades }: SetupPerformanceBarChartProps) {
  const { theme } = useTheme();

  const setupData = useMemo(() => {
    const map: Record<string, { count: number; pnl: number; wins: number }> = {};
    for (const t of trades) {
      const s = t.setup || 'Unclassified';
      if (!map[s]) map[s] = { count: 0, pnl: 0, wins: 0 };
      map[s].count++;
      map[s].pnl += t.netPnl || 0;
      if (t.netPnl > 0) map[s].wins++;
    }

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        count: data.count,
        pnl: data.pnl,
        winRate: data.count > 0 ? Math.round((data.wins / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [trades]);

  const maxAbsPnl = useMemo(() => {
    if (setupData.length === 0) return 100;
    const maxVal = Math.max(...setupData.map((d) => Math.abs(d.pnl)));
    return maxVal > 0 ? maxVal : 100;
  }, [setupData]);

  if (setupData.length === 0) return null;

  const barMaxW = 120;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
      ]}
    >
      <Text style={[styles.title, { color: theme.colors.textMuted }]}>Strategy Performance & Efficacy</Text>

      <View style={styles.list}>
        {setupData.map((item) => {
          const isPos = item.pnl >= 0;
          const barW = Math.max((Math.abs(item.pnl) / maxAbsPnl) * barMaxW, 4);
          const isLowSample = item.count < 3;

          return (
            <View key={item.name} style={styles.row}>
              <View style={styles.labelCol}>
                <Text style={[styles.setupName, { color: theme.colors.text }]}>{item.name}</Text>
                <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
                  {item.count} trades • {item.winRate}% win {isLowSample ? '• (low sample)' : ''}
                </Text>
              </View>

              <View style={styles.barCol}>
                <Svg width={barMaxW} height={12}>
                  <Rect
                    x={0}
                    y={0}
                    width={barW}
                    height={12}
                    rx={3}
                    fill={isPos ? theme.colors.semantic.success : theme.colors.semantic.danger}
                  />
                </Svg>
              </View>

              <Text
                style={[
                  styles.pnlText,
                  { color: isPos ? theme.colors.semantic.success : theme.colors.semantic.danger },
                ]}
              >
                {formatCurrency(item.pnl)}
              </Text>
            </View>
          );
        })}
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
  list: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelCol: {
    flex: 1,
  },
  setupName: {
    fontSize: 14,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 11,
    marginTop: 2,
  },
  barCol: {
    width: 120,
    alignItems: 'flex-start',
    marginHorizontal: 8,
  },
  pnlText: {
    fontSize: 13,
    fontWeight: '700',
    width: 70,
    textAlign: 'right',
  },
});
