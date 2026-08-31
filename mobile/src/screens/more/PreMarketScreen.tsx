import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  ScreenContainer,
  Header,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  EmptyState,
} from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '../../hooks/useData';
import { formatDate } from '../../utils/formatters';

const BIAS_OPTIONS = [
  { label: 'Bullish (Long Focus)', value: 'Bullish' },
  { label: 'Bearish (Short Focus)', value: 'Bearish' },
  { label: 'Neutral / Range-Bound', value: 'Neutral' },
  { label: 'Mixed / Cautious', value: 'Mixed' },
];

export function PreMarketScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { plans, addPlan, deletePlan } = useData();

  const [modalOpen, setModalOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [bias, setBias] = useState<'Bullish' | 'Bearish' | 'Neutral' | 'Mixed'>('Bullish');
  const [focusSymbols, setFocusSymbols] = useState('');
  const [keyLevels, setKeyLevels] = useState('');
  const [riskPlan, setRiskPlan] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!focusSymbols.trim()) {
      Alert.alert('Required', 'Please enter focus symbols / watchlist.');
      return;
    }
    setSaving(true);
    await addPlan({
      date,
      bias,
      focusSymbols: focusSymbols.split(',').map((s) => s.trim()),
      keyLevels,
      riskPlan,
      notes,
    });
    setSaving(false);
    setModalOpen(false);
    setFocusSymbols('');
    setKeyLevels('');
    setRiskPlan('');
    setNotes('');
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Pre-Market Plan"
        subtitle="Daily Bias & Preparation"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.topAction}>
        <Button
          title="+ Create Plan"
          onPress={() => setModalOpen(true)}
          variant="primary"
          size="sm"
        />
      </View>

      {plans.length === 0 ? (
        <EmptyState
          title="No Pre-Market Plans"
          description="Prepare your morning watchlist, economic catalysts, and key levels before market open."
          actionTitle="Create Plan"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        plans.map((p) => (
          <View
            key={p.id}
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.date, { color: theme.colors.text }]}>
                {formatDate(p.date)}
              </Text>
              <Badge
                label={`${p.bias} Bias`}
                variant={p.bias === 'Bullish' ? 'success' : p.bias === 'Bearish' ? 'danger' : 'neutral'}
                size="sm"
              />
            </View>

            {p.keyLevels ? (
              <>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Watchlist & Key Levels</Text>
                <Text style={[styles.val, { color: theme.colors.text }]}>{p.keyLevels}</Text>
              </>
            ) : null}

            {p.riskPlan ? (
              <>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Risk & Game Plan</Text>
                <Text style={[styles.val, { color: theme.colors.text }]}>{p.riskPlan}</Text>
              </>
            ) : null}

            {p.notes ? (
              <>
                <Text style={[styles.label, { color: theme.colors.textMuted }]}>Notes & Catalysts</Text>
                <Text style={[styles.val, { color: theme.colors.text }]}>{p.notes}</Text>
              </>
            ) : null}

            <TouchableOpacity
              onPress={() => deletePlan(p.id)}
              style={styles.deleteLink}
            >
              <Text style={{ color: theme.colors.semantic.danger, fontSize: 12 }}>Delete Plan</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* Create Plan Modal */}
      <Modal visible={modalOpen} onClose={() => setModalOpen(false)} title="New Pre-Market Plan">
        <Input label="Date" value={date} onChangeText={setDate} />
        <Select
          label="Market Bias"
          options={BIAS_OPTIONS}
          selectedValue={bias}
          onValueChange={(v: any) => setBias(v)}
        />
        <Input
          label="Watchlist Symbols"
          placeholder="NVDA, TSLA, AAPL, SPY"
          value={focusSymbols}
          onChangeText={setFocusSymbols}
        />
        <Input
          label="Key Support & Resistance Levels"
          placeholder="SPY 558.50 pivot, NVDA 128.00 breakout level"
          value={keyLevels}
          onChangeText={setKeyLevels}
        />
        <Input
          label="Risk & Max Loss Plan"
          placeholder="Max 2 trades today, $300 max stop loss limit"
          value={riskPlan}
          onChangeText={setRiskPlan}
        />
        <Input
          label="Notes / Catalysts"
          placeholder="CPI print at 08:30 AM, Powell speech"
          value={notes}
          onChangeText={setNotes}
        />
        <Button
          title="Save Pre-Market Plan"
          onPress={handleSave}
          loading={saving}
          variant="primary"
          size="md"
          style={{ marginTop: 8 }}
        />
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topAction: {
    marginVertical: 12,
    alignItems: 'flex-end',
  },
  card: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  date: {
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  val: {
    fontSize: 14,
    lineHeight: 20,
  },
  deleteLink: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
});
