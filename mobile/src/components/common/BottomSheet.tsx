import React, { ReactNode } from 'react';
import {
  View,
  Text,
  Modal as RNModal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
  const { theme } = useTheme();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.spacer} />
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bgElevated,
              borderTopColor: theme.colors.borderStrong,
            },
            theme.shadows.modal,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.borderStrong }]} />
          {title && (
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.closeBtn, { color: theme.colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <SafeAreaView style={styles.content}>{children}</SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  spacer: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
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
    padding: 4,
  },
  content: {
    width: '100%',
  },
});
