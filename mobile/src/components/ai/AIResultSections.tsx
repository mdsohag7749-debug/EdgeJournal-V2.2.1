import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AIResponseContract } from '../../types/ai';

interface AIResultSectionsProps {
  result: AIResponseContract;
  featureKind: 'journalIntelligence' | 'tradeReview' | 'coaching' | 'askJournal';
}

// Section component: collapsible list of string items
function ResultSection({
  title,
  icon,
  items,
  color,
}: {
  title: string;
  icon: string;
  items: string[];
  color: string;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(true);
  if (!items || items.length === 0) return null;
  return (
    <View style={[styles.section, { borderColor: theme.colors.border }]}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setExpanded(!expanded)} accessibilityRole="button">
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
        <Text style={[styles.chevron, { color: theme.colors.textFaint }]}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.sectionBody}>
          {items.map((item, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bullet, { color }]}>•</Text>
              <Text style={[styles.bulletText, { color: theme.colors.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// Confidence bar
function ConfidenceRow({ confidence }: { confidence: number | null | undefined }) {
  const { theme } = useTheme();
  if (confidence === null || confidence === undefined) return null;
  const pct = Math.round(confidence * 100);
  const color = pct >= 66 ? '#10B981' : pct >= 33 ? '#F59E0B' : '#EF4444';
  const label = pct >= 66 ? 'High' : pct >= 33 ? 'Medium' : 'Low';
  return (
    <View style={[styles.section, { borderColor: theme.colors.border }]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>📈</Text>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>AI Confidence</Text>
        <Text style={[styles.confLabel, { color }]}>{label} ({pct}%)</Text>
      </View>
      <View style={[styles.confTrack, { backgroundColor: theme.colors.border }]}>
        <View style={[styles.confFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function AIResultSections({ result, featureKind }: AIResultSectionsProps) {
  const { theme } = useTheme();
  const sem = theme.colors.semantic;

  if (!result) return null;

  const summary = result.summary || result.answer || '';

  return (
    <View style={styles.container}>
      {/* Summary */}
      {summary ? (
        <View style={[styles.summaryCard, { backgroundColor: sem.aiAccentDim || theme.colors.card, borderColor: sem.aiAccent || theme.colors.border }]}>
          <Text style={[styles.summaryTitle, { color: sem.aiAccent || theme.colors.accent }]}>
            ✨ {featureKind === 'askJournal' ? 'Answer' : 'Summary'}
          </Text>
          <Text style={[styles.summaryText, { color: theme.colors.text }]}>{summary}</Text>
        </View>
      ) : null}

      {/* Structured sections */}
      <ResultSection
        title="Strengths"
        icon="💪"
        items={result.strengths || []}
        color={sem.success}
      />
      <ResultSection
        title="Key Patterns"
        icon="🔍"
        items={result.keyPatterns || []}
        color={sem.info}
      />
      <ResultSection
        title="Observations"
        icon="📝"
        items={result.observations || []}
        color={theme.colors.textMuted}
      />
      <ResultSection
        title="Weaknesses"
        icon="⚠️"
        items={result.weaknesses || []}
        color={sem.warning}
      />
      <ResultSection
        title="Risks"
        icon="🛑"
        items={result.risks || []}
        color={sem.danger}
      />
      <ResultSection
        title="Psychology"
        icon="🧠"
        items={result.psychology || []}
        color={sem.aiAccent}
      />
      <ResultSection
        title="Action Plan"
        icon="🎯"
        items={result.actionPlan || result.recommendations || []}
        color={sem.info}
      />
      <ResultSection
        title="Improvements"
        icon="📈"
        items={result.improvements || []}
        color={sem.info}
      />

      {/* Confidence bar */}
      <ConfidenceRow confidence={result.confidence} />

      {/* Disclaimer */}
      {result.disclaimer ? (
        <View style={[styles.disclaimer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <Text style={[styles.disclaimerText, { color: theme.colors.textFaint }]}>
            ⚠️ {result.disclaimer}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
  },
  section: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  sectionIcon: {
    fontSize: 15,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 10,
  },
  sectionBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  confLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  confTrack: {
    marginHorizontal: 12,
    marginBottom: 10,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confFill: {
    height: 4,
    borderRadius: 2,
  },
  disclaimer: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 17,
  },
});

