import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { PSYCH_EMOTIONS, validatePsychRating } from '../../utils/psychologyUtils';

export type { EmotionMeta } from '../../utils/psychologyUtils';
export { PSYCH_EMOTIONS } from '../../utils/psychologyUtils';

interface PsychologyMatrixProps {
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
}

export function PsychologyMatrix({ values = {}, onChange }: PsychologyMatrixProps) {
  const { theme } = useTheme();

  const handleRate = (emotionKey: string, rating: number) => {
    const current = values[emotionKey];
    // If tapping same value, toggle it off (unset)
    const nextVal = current === rating ? undefined : rating;

    const updated = { ...values };
    if (nextVal === undefined) {
      delete updated[emotionKey];
    } else {
      updated[emotionKey] = nextVal;
    }
    onChange(updated);
  };

  return (
    <View style={styles.container}>
      {PSYCH_EMOTIONS.map((emotion) => {
        const val = values[emotion.key];
        const isPos = emotion.tone === 'pos';
        const activeColor = isPos ? theme.colors.semantic.success : theme.colors.semantic.danger;
        const activeBg = isPos ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 77, 94, 0.15)';
        const activeBorder = isPos ? 'rgba(46, 213, 115, 0.4)' : 'rgba(255, 77, 94, 0.4)';

        return (
          <View
            key={emotion.key}
            style={[
              styles.emotionRow,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.labelCol}>
              <View style={styles.titleWrap}>
                <Text style={[styles.emotionTitle, { color: theme.colors.text }]}>
                  {emotion.label}
                </Text>
                {val !== undefined && (
                  <View style={[styles.scoreBadge, { backgroundColor: activeBg }]}>
                    <Text style={[styles.scoreText, { color: activeColor }]}>
                      {val}/5
                    </Text>
                  </View>
                )}
              </View>
              {emotion.desc && (
                <Text style={[styles.emotionDesc, { color: theme.colors.textMuted }]}>
                  {emotion.desc}
                </Text>
              )}
            </View>

            {/* 1-5 Segmented Rating Buttons */}
            <View style={styles.ratingBar}>
              {[1, 2, 3, 4, 5].map((n) => {
                const isSelected = val === n;
                const isFilled = val !== undefined && val >= n;

                return (
                  <TouchableOpacity
                    key={n}
                    activeOpacity={0.7}
                    onPress={() => handleRate(emotion.key, n)}
                    style={[
                      styles.ratingButton,
                      {
                        backgroundColor: isSelected
                          ? activeBg
                          : isFilled
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'transparent',
                        borderColor: isSelected ? activeBorder : theme.colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ratingNumber,
                        {
                          color: isSelected
                            ? activeColor
                            : isFilled
                            ? theme.colors.text
                            : theme.colors.textFaint,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  emotionRow: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  labelCol: {
    gap: 2,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emotionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emotionDesc: {
    fontSize: 11.5,
  },
  ratingBar: {
    flexDirection: 'row',
    gap: 6,
  },
  ratingButton: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingNumber: {
    fontSize: 13,
  },
});
