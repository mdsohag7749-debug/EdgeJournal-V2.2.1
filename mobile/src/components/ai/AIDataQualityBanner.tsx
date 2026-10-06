import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AIDataQualityInfo, AIDataCoverage } from '../../types/ai';

interface AIDataQualityBannerProps {
  dataQuality: AIDataQualityInfo | null;
}

function coverageColor(coverage: AIDataCoverage, theme: any): string {
  switch (coverage) {
    case 'NOT_ENOUGH_DATA':
      return theme.colors.semantic?.danger || '#EF4444';
    case 'LIMITED_DATA':
      return theme.colors.semantic?.warning || '#F59E0B';
    case 'EARLY_PATTERN':
      return theme.colors.semantic?.info || '#3B82F6';
    case 'NORMAL_PATTERN_ANALYSIS':
      return theme.colors.semantic?.success || '#10B981';
    default:
      return theme.colors.textMuted;
  }
}

function coverageIcon(coverage: AIDataCoverage): string {
  switch (coverage) {
    case 'NOT_ENOUGH_DATA':
      return '🚫';
    case 'LIMITED_DATA':
      return '⚠️';
    case 'EARLY_PATTERN':
      return '📊';
    case 'NORMAL_PATTERN_ANALYSIS':
      return '✅';
    default:
      return '📊';
  }
}

export function AIDataQualityBanner({ dataQuality }: AIDataQualityBannerProps) {
  const { theme } = useTheme();

  if (!dataQuality) return null;

  const color = coverageColor(dataQuality.coverage, theme);
  const icon = coverageIcon(dataQuality.coverage);

  return (
    <View style={[styles.container, { borderColor: color, backgroundColor: color + '18' }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.label, { color }]}>{dataQuality.label}</Text>
          <Text style={[styles.count, { color: theme.colors.textMuted }]}>
            {dataQuality.tradeCount} trade{dataQuality.tradeCount === 1 ? '' : 's'} in scope
          </Text>
        </View>
      </View>
      {dataQuality.limitations.length > 0 && (
        <View style={styles.limitations}>
          {dataQuality.limitations.map((lim, i) => (
            <Text key={i} style={[styles.limitationText, { color: theme.colors.textMuted }]}>
              • {lim}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 18,
  },
  headerText: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  count: {
    fontSize: 12,
    marginTop: 1,
  },
  limitations: {
    marginTop: 8,
    gap: 4,
  },
  limitationText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
