import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { Trade } from '../../types/models';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/formatters';

export interface EquityCurveChartProps {
  trades: Trade[];
  startingBalance: number;
  height?: number;
}

export function EquityCurveChart({ trades, startingBalance, height = 180 }: EquityCurveChartProps) {
  const { theme } = useTheme();

  // Sort trades chronologically
  const sorted = [...trades].sort((a, b) => {
    const da = `${a.entryDate} ${a.entryTime || ''}`;
    const db = `${b.entryDate} ${b.entryTime || ''}`;
    return da.localeCompare(db);
  });

  // Calculate cumulative equity points
  const points: { x: number; equity: number }[] = [{ x: 0, equity: startingBalance }];
  let current = startingBalance;
  for (let i = 0; i < sorted.length; i++) {
    current += sorted[i].netPnl || 0;
    points.push({ x: i + 1, equity: current });
  }

  const equities = points.map((p) => p.equity);
  const minEquity = Math.min(...equities, startingBalance * 0.95);
  const maxEquity = Math.max(...equities, startingBalance * 1.05);
  const range = maxEquity - minEquity || 1;

  const width = 320;
  const paddingX = 12;
  const paddingY = 16;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  // Scale coordinates
  const coords = points.map((p, idx) => {
    const cx = paddingX + (idx / (points.length - 1 || 1)) * chartW;
    const cy = height - paddingY - ((p.equity - minEquity) / range) * chartH;
    return { cx, cy, equity: p.equity };
  });

  // Line path
  const linePath = coords.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.cx} ${pt.cy}` : `${acc} L ${pt.cx} ${pt.cy}`;
  }, '');

  // Fill path
  const firstPt = coords[0];
  const lastPt = coords[coords.length - 1];
  const fillPath = `${linePath} L ${lastPt.cx} ${height - paddingY} L ${firstPt.cx} ${height - paddingY} Z`;

  // Baseline Y
  const baselineY = height - paddingY - ((startingBalance - minEquity) / range) * chartH;

  const isNetPositive = current >= startingBalance;
  const strokeColor = isNetPositive ? theme.colors.semantic.success : theme.colors.semantic.danger;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.textMuted }]}>Cumulative Equity Curve</Text>
          <Text style={[styles.equity, { color: theme.colors.text }]}>{formatCurrency(current)}</Text>
        </View>
        <View style={styles.legend}>
          <Text
            style={[
              styles.pnlDiff,
              { color: isNetPositive ? theme.colors.semantic.success : theme.colors.semantic.danger },
            ]}
          >
            {isNetPositive ? '+' : ''}
            {formatCurrency(current - startingBalance)}
          </Text>
        </View>
      </View>

      <View style={styles.chartWrapper}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <LinearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={strokeColor} stopOpacity="0.35" />
              <Stop offset="1" stopColor={strokeColor} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Starting balance dashed baseline */}
          <Line
            x1={paddingX}
            y1={baselineY}
            x2={width - paddingX}
            y2={baselineY}
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Gradient Fill */}
          <Path d={fillPath} fill="url(#equityGrad)" />

          {/* Main Curve */}
          <Path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.5" />

          {/* Latest Point Marker */}
          <Circle cx={lastPt.cx} cy={lastPt.cy} r="4.5" fill={strokeColor} />
        </Svg>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.textFaint }]}>
          Start: {formatCurrency(startingBalance)}
        </Text>
        <Text style={[styles.footerText, { color: theme.colors.textFaint }]}>
          Peak: {formatCurrency(maxEquity)}
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
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  equity: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  legend: {
    alignItems: 'flex-end',
  },
  pnlDiff: {
    fontSize: 14,
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
