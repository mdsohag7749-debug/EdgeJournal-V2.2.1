import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal as RNModal,
  FlatList,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  containerStyle?: ViewStyle;
}

export function Select({
  label,
  options,
  selectedValue,
  onValueChange,
  placeholder = 'Select option...',
  containerStyle,
}: SelectProps) {
  const { theme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === selectedValue);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: theme.colors.textMuted }]}>{label}</Text>}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setModalOpen(true)}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.colors.card,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <Text
          style={[
            styles.triggerText,
            { color: selectedOption ? theme.colors.text : theme.colors.textFaint },
          ]}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text style={[styles.chevron, { color: theme.colors.textMuted }]}>▼</Text>
      </TouchableOpacity>

      <RNModal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalOpen(false)}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.borderStrong,
                borderRadius: theme.radii.lg,
              },
              theme.shadows.modal,
            ]}
          >
            {label && (
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{label}</Text>
            )}
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = item.value === selectedValue;
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      isSelected && { backgroundColor: theme.colors.accentDim },
                    ]}
                    onPress={() => {
                      onValueChange(item.value);
                      setModalOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        { color: isSelected ? theme.colors.accent : theme.colors.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Text style={[styles.checkmark, { color: theme.colors.accent }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
  },
  triggerText: {
    fontSize: 15,
  },
  chevron: {
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '60%',
    padding: 16,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginVertical: 2,
  },
  optionLabel: {
    fontSize: 15,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
  },
});
