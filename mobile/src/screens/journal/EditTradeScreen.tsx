import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, Header, Input, Select, Button, Chip } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '../../hooks/useData';
import { Trade } from '../../types/models';

const SETUP_OPTIONS = [
  { label: 'Breakout & Retest', value: 'Breakout' },
  { label: 'Pullback / Trend Continuation', value: 'Pullback' },
  { label: 'Reversal / Exhaustion', value: 'Reversal' },
  { label: 'VWAP Bounce / Fade', value: 'VWAP' },
  { label: 'Range Fade / Liquidity Sweep', value: 'Range Fade' },
];

const COMMON_TAGS = ['A+ Setup', 'Trend Aligned', 'Chased', 'Early Entry', 'FOMO', 'Key Level', 'News'];

export function EditTradeScreen({ navigation, route }: { navigation: any; route: any }) {
  const { theme } = useTheme();
  const { updateTrade } = useData();
  const trade: Trade = route.params.trade;

  const [symbol, setSymbol] = useState(trade.symbol);
  const [direction, setDirection] = useState<'Long' | 'Short'>(trade.direction);
  const [entryDate, setEntryDate] = useState(trade.entryDate);
  const [entryTime, setEntryTime] = useState(trade.entryTime || '');
  const [entryPrice, setEntryPrice] = useState(String(trade.entryPrice || ''));
  const [exitPrice, setExitPrice] = useState(trade.exitPrice !== undefined ? String(trade.exitPrice) : '');
  const [stopLoss, setStopLoss] = useState(trade.stopLoss !== undefined ? String(trade.stopLoss) : '');
  const [takeProfit, setTakeProfit] = useState(trade.takeProfit !== undefined ? String(trade.takeProfit) : '');
  const [size, setSize] = useState(String(trade.size || ''));
  const [netPnl, setNetPnl] = useState(String(trade.netPnl || ''));
  const [setup, setSetup] = useState(trade.setup || 'Breakout');
  const [selectedTags, setSelectedTags] = useState<string[]>(trade.tags || []);
  const [notes, setNotes] = useState(trade.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleUpdate = async () => {
    if (!symbol.trim()) {
      setError('Please enter a valid ticker / symbol.');
      return;
    }
    if (!entryPrice || isNaN(Number(entryPrice)) || Number(entryPrice) <= 0) {
      setError('Please enter a valid entry price.');
      return;
    }

    setError('');
    setLoading(true);

    const ep = Number(entryPrice);
    const sl = stopLoss ? Number(stopLoss) : undefined;
    const tp = takeProfit ? Number(takeProfit) : undefined;
    const xp = exitPrice ? Number(exitPrice) : undefined;
    const sz = Number(size) || 1;

    let calculatedRr = trade.riskRewardRatio || 0;
    if (sl && tp && ep) {
      const risk = Math.abs(ep - sl);
      const reward = Math.abs(tp - ep);
      if (risk > 0) calculatedRr = reward / risk;
    }

    const patch: Partial<Trade> = {
      symbol: symbol.toUpperCase().trim(),
      direction,
      entryDate,
      entryTime,
      entryPrice: ep,
      exitPrice: xp,
      stopLoss: sl,
      takeProfit: tp,
      size: sz,
      netPnl: netPnl ? Number(netPnl) : trade.netPnl,
      riskRewardRatio: Math.round(calculatedRr * 10) / 10,
      setup,
      tags: selectedTags,
      notes,
    };

    const updated = await updateTrade(trade.id, patch);
    setLoading(false);

    if (updated) {
      navigation.navigate('TradeDetails', { trade: updated });
    } else {
      setError('Failed to update trade.');
    }
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Edit Trade"
        subtitle={`${trade.symbol} • ${trade.entryDate}`}
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.formContent}>
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.colors.semantic.dangerDim }]}>
            <Text style={{ color: theme.colors.semantic.danger, fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}

        {/* Direction Toggle */}
        <View style={styles.directionToggle}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setDirection('Long')}
            style={[
              styles.dirButton,
              direction === 'Long' && { backgroundColor: theme.colors.semantic.successDim, borderColor: theme.colors.semantic.success },
              { borderColor: theme.colors.border },
            ]}
          >
            <Text
              style={[
                styles.dirText,
                { color: direction === 'Long' ? theme.colors.semantic.success : theme.colors.textMuted },
              ]}
            >
              LONG
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setDirection('Short')}
            style={[
              styles.dirButton,
              direction === 'Short' && { backgroundColor: theme.colors.semantic.dangerDim, borderColor: theme.colors.semantic.danger },
              { borderColor: theme.colors.border },
            ]}
          >
            <Text
              style={[
                styles.dirText,
                { color: direction === 'Short' ? theme.colors.semantic.danger : theme.colors.textMuted },
              ]}
            >
              SHORT
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <Input
            label="Ticker / Symbol"
            value={symbol}
            onChangeText={setSymbol}
            containerStyle={styles.half}
          />
          <Input
            label="Position Size"
            keyboardType="numeric"
            value={size}
            onChangeText={setSize}
            containerStyle={styles.half}
          />
        </View>

        <View style={styles.row}>
          <Input
            label="Entry Price"
            keyboardType="numeric"
            value={entryPrice}
            onChangeText={setEntryPrice}
            containerStyle={styles.half}
          />
          <Input
            label="Exit Price"
            keyboardType="numeric"
            value={exitPrice}
            onChangeText={setExitPrice}
            containerStyle={styles.half}
          />
        </View>

        <View style={styles.row}>
          <Input
            label="Stop Loss"
            keyboardType="numeric"
            value={stopLoss}
            onChangeText={setStopLoss}
            containerStyle={styles.half}
          />
          <Input
            label="Take Profit"
            keyboardType="numeric"
            value={takeProfit}
            onChangeText={setTakeProfit}
            containerStyle={styles.half}
          />
        </View>

        <Input
          label="Realized Net P&L ($)"
          keyboardType="numeric"
          value={netPnl}
          onChangeText={setNetPnl}
        />

        <Select
          label="Trading Setup"
          options={SETUP_OPTIONS}
          selectedValue={setup}
          onValueChange={setSetup}
        />

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>Tags</Text>
        <View style={styles.tagChips}>
          {COMMON_TAGS.map((t) => {
            const isSelected = selectedTags.includes(t);
            return (
              <Chip
                key={t}
                label={t}
                selected={isSelected}
                onPress={() => toggleTag(t)}
              />
            );
          })}
        </View>

        <Input
          label="Execution Notes"
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          inputStyle={{ minHeight: 70, textAlignVertical: 'top' }}
        />

        <Button
          title="Save Changes"
          onPress={handleUpdate}
          loading={loading}
          variant="primary"
          size="lg"
          style={styles.submitBtn}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  formContent: {
    paddingVertical: 12,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  directionToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  dirButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
  },
  dirText: {
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  submitBtn: {
    marginTop: 12,
    marginBottom: 30,
  },
});
