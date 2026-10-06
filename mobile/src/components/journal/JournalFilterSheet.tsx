import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal as RNModal,
  SafeAreaView,
} from 'react-native';
import { Button, Input, Chip } from '../common';
import { useTheme } from '../../hooks/useTheme';
import {
  JournalFilterState,
  BLANK_JOURNAL_FILTERS,
  STANDARD_SESSIONS,
  STANDARD_EMOTIONS,
  STANDARD_MISTAKES,
  getDatePresetRange,
  countActiveFilters,
} from '../../utils/journalFilters';
import { Trade } from '../../types/models';

interface JournalFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: JournalFilterState;
  onApply: (newFilters: JournalFilterState) => void;
  trades?: Trade[];
}

export function JournalFilterSheet({
  visible,
  onClose,
  filters,
  onApply,
  trades = [],
}: JournalFilterSheetProps) {
  const { theme } = useTheme();

  // Local draft state so user can make changes and click Apply
  const [draft, setDraft] = useState<JournalFilterState>(filters);

  // Sync draft whenever modal opens with external filters
  useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [visible, filters]);

  // Extract unique setups, tags, and sessions from actual user trades to supplement standard lists
  const availableSetups = useMemo(() => {
    const s = new Set<string>();
    ['Breakout', 'Pullback', 'Reversal', 'VWAP', 'Range Fade'].forEach((x) => s.add(x));
    trades.forEach((t) => {
      if (t.setup) s.add(t.setup);
    });
    return Array.from(s);
  }, [trades]);

  const availableTags = useMemo(() => {
    const s = new Set<string>();
    ['A+ Setup', 'Trend Aligned', 'Chased', 'Early Entry', 'FOMO', 'Key Level', 'News'].forEach((x) => s.add(x));
    trades.forEach((t) => {
      t.tags?.forEach((tag) => s.add(tag));
    });
    return Array.from(s);
  }, [trades]);

  const availableEmotions = useMemo(() => {
    const s = new Set<string>(STANDARD_EMOTIONS);
    trades.forEach((t) => {
      if (t.emotionBefore) s.add(t.emotionBefore);
      if (t.emotionDuring) s.add(t.emotionDuring);
      if (t.emotionAfter) s.add(t.emotionAfter);
    });
    return Array.from(s);
  }, [trades]);

  const availableMistakes = useMemo(() => {
    const s = new Set<string>(STANDARD_MISTAKES);
    trades.forEach((t) => {
      t.mistakes?.forEach((m) => s.add(m));
    });
    return Array.from(s);
  }, [trades]);

  const handleSelectPreset = (preset: JournalFilterState['datePreset']) => {
    if (preset === 'Custom') {
      setDraft((prev) => ({ ...prev, datePreset: 'Custom' }));
    } else {
      const range = getDatePresetRange(preset);
      setDraft((prev) => ({
        ...prev,
        datePreset: preset,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      }));
    }
  };

  const toggleArrayItem = (key: 'sessions' | 'emotions' | 'mistakes' | 'tags' | 'models', item: string) => {
    setDraft((prev) => {
      const current = prev[key] || [];
      const exists = current.some((x) => x.toLowerCase() === item.toLowerCase());
      const updated = exists
        ? current.filter((x) => x.toLowerCase() !== item.toLowerCase())
        : [...current, item];
      return { ...prev, [key]: updated };
    });
  };

  const handleReset = () => {
    setDraft(BLANK_JOURNAL_FILTERS);
  };

  const handleSaveAndApply = () => {
    onApply(draft);
    onClose();
  };

  const activeCount = countActiveFilters(draft);

  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bgElevated,
              borderTopColor: theme.colors.borderStrong,
            },
            theme.shadows.modal,
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: theme.colors.borderStrong }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Filter Journal</Text>
              {activeCount > 0 && (
                <View style={[styles.activeBadge, { backgroundColor: theme.colors.accentDim }]}>
                  <Text style={[styles.activeBadgeText, { color: theme.colors.accent }]}>
                    {activeCount} active
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[styles.closeBtn, { color: theme.colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable filter options */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Date Range Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Date Range</Text>
              <View style={styles.chipRow}>
                {(['Today', 'This Week', 'This Month', 'YTD', 'All Time', 'Custom'] as const).map((preset) => (
                  <Chip
                    key={preset}
                    label={preset}
                    selected={draft.datePreset === preset}
                    onPress={() => handleSelectPreset(preset)}
                  />
                ))}
              </View>

              {/* Custom Date Inputs */}
              {(draft.datePreset === 'Custom' || (draft.dateFrom && draft.datePreset !== 'All Time')) && (
                <View style={styles.dateInputsRow}>
                  <Input
                    label="From Date (YYYY-MM-DD)"
                    placeholder="2026-01-01"
                    value={draft.dateFrom}
                    onChangeText={(val) =>
                      setDraft((prev) => ({ ...prev, dateFrom: val, datePreset: 'Custom' }))
                    }
                    containerStyle={{ flex: 1 }}
                  />
                  <Input
                    label="To Date (YYYY-MM-DD)"
                    placeholder="2026-12-31"
                    value={draft.dateTo}
                    onChangeText={(val) =>
                      setDraft((prev) => ({ ...prev, dateTo: val, datePreset: 'Custom' }))
                    }
                    containerStyle={{ flex: 1 }}
                  />
                </View>
              )}
            </View>

            {/* 2. Direction */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Direction</Text>
              <View style={styles.chipRow}>
                {(['All', 'Long', 'Short'] as const).map((dir) => (
                  <Chip
                    key={dir}
                    label={dir === 'All' ? 'All Directions' : dir.toUpperCase()}
                    selected={draft.direction === dir}
                    onPress={() => setDraft((prev) => ({ ...prev, direction: dir }))}
                  />
                ))}
              </View>
            </View>

            {/* 3. Outcome / Result */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trade Result</Text>
              <View style={styles.chipRow}>
                {(['All', 'Win', 'Loss', 'BE', 'Open'] as const).map((res) => (
                  <Chip
                    key={res}
                    label={res === 'All' ? 'All Results' : res === 'BE' ? 'Break-Even' : res}
                    selected={draft.result === res}
                    onPress={() => setDraft((prev) => ({ ...prev, result: res }))}
                  />
                ))}
              </View>
            </View>

            {/* 4. Market Session */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Market Session</Text>
              <View style={styles.chipRow}>
                {STANDARD_SESSIONS.map((session) => {
                  const isSelected = draft.sessions.some(
                    (s) => s.toLowerCase() === session.toLowerCase()
                  );
                  return (
                    <Chip
                      key={session}
                      label={session}
                      selected={isSelected}
                      onPress={() => toggleArrayItem('sessions', session)}
                    />
                  );
                })}
              </View>
            </View>

            {/* 5. Setups / Models */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Trading Setup</Text>
              <View style={styles.chipRow}>
                {availableSetups.map((setup) => {
                  const isSelected = draft.models.some(
                    (m) => m.toLowerCase() === setup.toLowerCase()
                  );
                  return (
                    <Chip
                      key={setup}
                      label={setup}
                      selected={isSelected}
                      onPress={() => toggleArrayItem('models', setup)}
                    />
                  );
                })}
              </View>
            </View>

            {/* 6. Trading Psychology & Emotions */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Psychology & Mindset</Text>
              <View style={styles.chipRow}>
                {availableEmotions.map((emotion) => {
                  const isSelected = draft.emotions.some(
                    (e) => e.toLowerCase() === emotion.toLowerCase()
                  );
                  return (
                    <Chip
                      key={emotion}
                      label={emotion}
                      selected={isSelected}
                      onPress={() => toggleArrayItem('emotions', emotion)}
                    />
                  );
                })}
              </View>
            </View>

            {/* 7. Trading Mistakes */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Mistakes & Rule Breaks</Text>
              <View style={styles.chipRow}>
                {availableMistakes.map((mistake) => {
                  const isSelected = draft.mistakes.some(
                    (m) => m.toLowerCase() === mistake.toLowerCase()
                  );
                  return (
                    <Chip
                      key={mistake}
                      label={mistake}
                      selected={isSelected}
                      onPress={() => toggleArrayItem('mistakes', mistake)}
                    />
                  );
                })}
              </View>
            </View>

            {/* 8. Tags */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Tags</Text>
              <View style={styles.chipRow}>
                {availableTags.map((tag) => {
                  const isSelected = draft.tags.some(
                    (t) => t.toLowerCase() === tag.toLowerCase()
                  );
                  return (
                    <Chip
                      key={tag}
                      label={`#${tag}`}
                      selected={isSelected}
                      onPress={() => toggleArrayItem('tags', tag)}
                    />
                  );
                })}
              </View>
            </View>

            {/* 9. Risk:Reward and PnL Filters */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Metrics Range</Text>
              <View style={styles.dateInputsRow}>
                <Input
                  label="Min R:R (e.g. 2.0)"
                  placeholder="0.0"
                  keyboardType="numeric"
                  value={draft.rrMin}
                  onChangeText={(val) => setDraft((prev) => ({ ...prev, rrMin: val }))}
                  containerStyle={{ flex: 1 }}
                />
                <Input
                  label="Min P&L ($)"
                  placeholder="0.00"
                  keyboardType="numeric"
                  value={draft.pnlMin}
                  onChangeText={(val) => setDraft((prev) => ({ ...prev, pnlMin: val }))}
                  containerStyle={{ flex: 1 }}
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer Action Buttons */}
          <SafeAreaView style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Button
              title="Reset All"
              onPress={handleReset}
              variant="outline"
              size="md"
              style={{ flex: 1 }}
            />
            <Button
              title={activeCount > 0 ? `Apply (${activeCount})` : 'Apply Filters'}
              onPress={handleSaveAndApply}
              variant="primary"
              size="md"
              style={{ flex: 1.5 }}
            />
          </SafeAreaView>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    fontSize: 18,
    fontWeight: '600',
    padding: 4,
  },
  scrollArea: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
});
