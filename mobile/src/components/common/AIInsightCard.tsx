import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Badge } from './Badge';

interface AIInsightCardProps {
  title: string;
  description: string;
  kind?: string;
  score?: number;
  recommendations?: string[];
}

export function AIInsightCard({
  title,
  description,
  kind = 'Intelligence',
  score,
  recommendations,
}: AIInsightCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.semantic.aiAccentGlow,
          borderRadius: theme.radii.lg,
        },
        theme.shadows.card,
      ]}
    >
      <View style={styles.header}>
        <Badge label={`Edge AI • ${kind}`} variant="ai" size="sm" />
        {score !== undefined && (
          <Text style={[styles.score, { color: theme.colors.semantic.aiAccent }]}>
            {score}/100
          </Text>
        )}
      </View>

      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.colors.textMuted }]}>
        {description}
      </Text>

      {recommendations && recommendations.length > 0 && (
        <View style={styles.recommendationsList}>
          <Text style={[styles.recTitle, { color: theme.colors.text }]}>Actionable Steps:</Text>
          {recommendations.map((rec, i) => (
            <Text key={i} style={[styles.recItem, { color: theme.colors.textMuted }]}>
              • {rec}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  score: {
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  recommendationsList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  recTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  recItem: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
});
