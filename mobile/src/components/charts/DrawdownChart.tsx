import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Trade } from '../../types/models';
import { useTheme } from '../../hooks/useTheme';

export interface DrawdownChartProps {
  trades: Trade[];
  startingBalance: number;
  height?: number;
}

export function DrawdownChart({ trades, startingBalance, height = 130 }: DrawdownChartProps) {
  const { theme } = useTheme();

  // Sort trades chronologically
  const sorted = [...trades].sort((a, b) => {
    const da = `${a.entryDate} ${a.entryTime || ''}`;
    const db = `${b.entryDate} ${b.entryTime || ''}`;
    return da.localeCompare(db);
  });

  // Calculate equity & underwater drawdown series
  let peak = startingBalance;
  let current = startingBalance;
  const drawdowns: { x: number; ddPercent: number }[] = [{ x: 0, ddPercent: 0 }];

  for (let i = 0; i < sorted.length; i++) {
    current += sorted[i].netPnl || 0;
    if (current > peak) peak = current;
    const dd = peak > 0 ? ((peak - current) / peak) * 100 : 0;
    drawdowns.push({ x: i + 1, ddPercent: dd });
  }

  const maxDd = Math.max(...drawdowns.map((d) => d.ddPercent), 5);
  const currentDd = drawdowns[drawdowns.length - 1]?.ddPercent || 0;

  const width = 320;
  const paddingX = 12;
  const topY = 12;
  const bottomY = height - 16;
  const chartW = width - paddingX * 2;
  const chartH = bottomY - topY;

  // Scale: top is 0% drawdown, bottom is maxDd
  const coords = drawdowns.map((d, idx) => {
    const cx = paddingX + (idx / (drawdowns.length - 1 || 1)) * chartW;
    const cy = topY + (d.ddPercent / maxDd) * chartH;
    return { cx, cy };
  });

  const linePath = coords.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.cx} ${pt.cy}` : `${acc} L ${pt.cx} ${pt.cy}`;
  }, '');

  const firstPt = coords[0];
  const lastPt = coords[coords.length - 1];
  const fillPath = `${linePath} L ${lastPt.cx} ${topY} L ${firstPt.cx} ${topY} Z`;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textMuted }]}>Underwater Drawdown Curve</Text>
        <Text style={[styles.currentDd, { color: theme.colors.semantic.danger }]}>
          Max -{maxDd.toFixed(1)}% {currentDd > 0 ? `• Current -${currentDd.toFixed(1)}%` : '• At Peak (0%)'}
        </Text>
      </View>

      <View style={styles.chartWrapper}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <LinearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.colors.semantic.danger} stopOpacity="0.0" />
              <Stop offset="1" stopColor={theme.colors.semantic.danger} stopOpacity="0.4" />
            </LinearGradient>
          </Defs>

          {/* 0% Peak line */}
          <Line
            x1={paddingX}
            y1={topY}
            x2={width - paddingX}
            y2={topY}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="1"
          />

          {/* Shaded underwater region */}
          <Path d={fillPath} fill="url(#ddGrad)" />

          {/* Drawdown curve */}
          <Path d={linePath} fill="none" stroke={theme.colors.semantic.danger} strokeWidth="2" />
        </Svg>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.textFaint }]}>0.0% (Peak)</Text>
        <Text style={[styles.footerText, { color: theme.colors.textFaint }]}>-{maxDd.toFixed(1)}% Max</Text>
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
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentDd: {
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
    marginTop: 2,
  },
  footerText: {
    fontSize: 11,
  },
});
