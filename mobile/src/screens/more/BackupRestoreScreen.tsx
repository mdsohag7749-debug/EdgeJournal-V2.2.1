import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { ScreenContainer, Header, Button, Input, Modal } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '../../hooks/useData';

export function BackupRestoreScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { exportBackup, restoreBackup, trades, plans, reflections, goals, challenges, study } = useData();

  const [exportJson, setExportJson] = useState<string>('');
  const [importJson, setImportJson] = useState<string>('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleExport = () => {
    const payload = exportBackup();
    const formatted = JSON.stringify(payload, null, 2);
    setExportJson(formatted);
    setExportModalOpen(true);
  };

  const handleRestore = async () => {
    if (!importJson.trim()) {
      Alert.alert('Required', 'Please paste a valid JSON backup string.');
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(importJson.trim());
    } catch {
      Alert.alert('JSON Error', 'The text you entered is not valid JSON.');
      return;
    }

    setRestoring(true);
    const result = await restoreBackup(parsed);
    setRestoring(false);

    if (result.success) {
      setImportModalOpen(false);
      setImportJson('');
      Alert.alert('Success', result.message);
    } else {
      Alert.alert('Import Failed', result.message);
    }
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Backup & Restore"
        subtitle="Data Portability & Snapshots"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      {/* Summary Box */}
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
        ]}
      >
        <Text style={[styles.summaryTitle, { color: theme.colors.text }]}>Active Journal Records</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.itemCount, { color: theme.colors.accent }]}>{trades.length}</Text>
            <Text style={[styles.itemLabel, { color: theme.colors.textMuted }]}>Trades</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.itemCount, { color: theme.colors.accent }]}>{plans.length}</Text>
            <Text style={[styles.itemLabel, { color: theme.colors.textMuted }]}>Plans</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.itemCount, { color: theme.colors.accent }]}>{reflections.length}</Text>
            <Text style={[styles.itemLabel, { color: theme.colors.textMuted }]}>Reflections</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.itemCount, { color: theme.colors.accent }]}>{goals.length}</Text>
            <Text style={[styles.itemLabel, { color: theme.colors.textMuted }]}>Goals</Text>
          </View>
        </View>
      </View>

      {/* Export Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Export Backup</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.base },
          ]}
        >
          <Text style={[styles.desc, { color: theme.colors.textMuted }]}>
            Generate a full portable JSON backup containing all your trades, accounts, pre-market plans, goals, and reflections.
          </Text>
          <Button
            title="Generate JSON Snapshot"
            onPress={handleExport}
            variant="primary"
            size="md"
            style={{ marginTop: 8 }}
          />
        </View>
      </View>

      {/* Import Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Restore Backup</Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderRadius: theme.radii.base },
          ]}
        >
          <Text style={[styles.desc, { color: theme.colors.textMuted }]}>
            Import data from an existing EdgeJournal JSON file into your account.
          </Text>
          <Button
            title="Import Backup JSON"
            onPress={() => {
              setImportJson('');
              setImportModalOpen(true);
            }}
            variant="outline"
            size="md"
            style={{ marginTop: 8 }}
          />
        </View>
      </View>

      {/* Export View Modal */}
      <Modal visible={exportModalOpen} onClose={() => setExportModalOpen(false)} title="Exported JSON Snapshot">
        <Text style={[styles.exportDesc, { color: theme.colors.textMuted }]}>
          Copy and save this JSON payload securely:
        </Text>
        <ScrollView style={styles.jsonBox}>
          <Text style={[styles.jsonText, { color: theme.colors.text }]}>{exportJson}</Text>
        </ScrollView>
        <Button
          title="Done"
          onPress={() => setExportModalOpen(false)}
          variant="primary"
          size="md"
          style={{ marginTop: 12 }}
        />
      </Modal>

      {/* Import Modal */}
      <Modal visible={importModalOpen} onClose={() => setImportModalOpen(false)} title="Restore from JSON">
        <Input
          label="Paste EdgeJournal JSON Backup"
          placeholder='{"app": "EdgeJournal", "version": 1, "trades": [...] }'
          multiline
          numberOfLines={6}
          value={importJson}
          onChangeText={setImportJson}
          inputStyle={{ minHeight: 120, fontSize: 12 }}
        />
        <Button
          title="Validate & Restore"
          onPress={handleRestore}
          loading={restoring}
          variant="primary"
          size="md"
          style={{ marginTop: 8 }}
        />
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    padding: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 20,
    fontWeight: '800',
  },
  itemLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  desc: {
    fontSize: 13,
    lineHeight: 19,
  },
  exportDesc: {
    fontSize: 13,
    marginBottom: 8,
  },
  jsonBox: {
    maxHeight: 200,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  jsonText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
