import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { RecommendationsResult } from '../../utils/recommendationsEngine';

interface RecommendationsSectionProps {
  data: RecommendationsResult;
}

export function RecommendationsSection({ data }: RecommendationsSectionProps) {
  const { theme } = useTheme();

  if (data.limited || data.recommendations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
          Evidence-Based Actions
        </Text>
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
          Recommendations generate automatically once you log at least 3 decided trades. All insights are derived strictly from your journal history.
        </Text>
      </View>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return theme.colors.semantic.danger;
      case 'Medium':
        return theme.colors.semantic.warning;
      case 'Low':
      default:
        return theme.colors.semantic.info;
    }
  };

  return (
    <View style={styles.container}>
      {data.recommendations.map((rec, index) => {
        const priorityColor = getPriorityColor(rec.priority);
        return (
          <View
            key={`${rec.category}_${index}`}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
                borderLeftColor: priorityColor,
                borderLeftWidth: 4,
              },
            ]}
          >
            {/* Badge & Priority Row */}
            <View style={styles.topRow}>
              <View
                style={[
                  styles.categoryPill,
                  { backgroundColor: `${theme.colors.accent}18` },
                ]}
              >
                <Text style={[styles.categoryText, { color: theme.colors.accent }]}>
                  {rec.category}
                </Text>
              </View>

              <View
                style={[
                  styles.priorityPill,
                  { backgroundColor: `${priorityColor}18` },
                ]}
              >
                <Text style={[styles.priorityText, { color: priorityColor }]}>
                  {rec.priority} Priority
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: theme.colors.text }]}>{rec.title}</Text>

            {/* Explanation */}
            <Text style={[styles.explanation, { color: theme.colors.textMuted }]}>
              {rec.explanation}
            </Text>

            {/* Action Box */}
            <View
              style={[
                styles.actionBox,
                { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.actionLabel, { color: theme.colors.text }]}>ACTION PLAN:</Text>
              <Text style={[styles.actionText, { color: theme.colors.textMuted }]}>
                {rec.action}
              </Text>
            </View>

            {/* Evidence Footnote */}
            <Text style={[styles.evidence, { color: theme.colors.textFaint }]}>
              Evidence: {rec.evidence}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  explanation: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  actionBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  actionText: {
    fontSize: 12,
    lineHeight: 16,
  },
  evidence: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 17,
  },
});
