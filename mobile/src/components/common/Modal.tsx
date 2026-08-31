import React, { ReactNode } from 'react';
import {
  View,
  Text,
  Modal as RNModal,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  contentStyle?: ViewStyle;
}

export function Modal({ visible, onClose, title, children, contentStyle }: ModalProps) {
  const { theme } = useTheme();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.content,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.borderStrong,
              borderRadius: theme.radii.lg,
            },
            theme.shadows.modal,
            contentStyle,
          ]}
        >
          {title && (
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.closeBtn, { color: theme.colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View>{children}</View>
        </TouchableOpacity>
      </TouchableOpacity>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    padding: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    fontSize: 16,
    fontWeight: '600',
  },
});
