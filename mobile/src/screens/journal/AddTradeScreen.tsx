import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ScreenContainer, Header, Input, Select, Button, Chip } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useAccounts } from '../../hooks/useAccounts';
import { useData } from '../../hooks/useData';

const SETUP_OPTIONS = [
  { label: 'Breakout & Retest', value: 'Breakout' },
  { label: 'Pullback / Trend Continuation', value: 'Pullback' },
  { label: 'Reversal / Exhaustion', value: 'Reversal' },
  { label: 'VWAP Bounce / Fade', value: 'VWAP' },
  { label: 'Range Fade / Liquidity Sweep', value: 'Range Fade' },
];

const SESSION_OPTIONS = [
  { label: 'NY Morning (09:30 - 12:00)', value: 'NY Morning' },
  { label: 'NY Afternoon (12:00 - 16:00)', value: 'NY Afternoon' },
  { label: 'London Session', value: 'London' },
  { label: 'Asia Session', value: 'Asia' },
  { label: 'Pre-Market', value: 'Pre-Market' },
];

const TIMEFRAME_OPTIONS = [
  { label: '1 Minute', value: '1m' },
  { label: '5 Minutes', value: '5m' },
  { label: '15 Minutes', value: '15m' },
  { label: '1 Hour', value: '1h' },
  { label: '4 Hours', value: '4h' },
  { label: 'Daily', value: 'Daily' },
];

const COMMON_TAGS = ['A+ Setup', 'Trend Aligned', 'Chased', 'Early Entry', 'FOMO', 'Key Level', 'News'];

export function AddTradeScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { theme } = useTheme();
  const { accounts, preferredAccountId } = useAccounts();
  const { addTrade } = useData();

  const [accountId, setAccountId] = useState<string>(route?.params?.defaultAccountId || preferredAccountId || '');
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'Long' | 'Short'>('Long');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryTime, setEntryTime] = useState('09:45');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [size, setSize] = useState('');
  const [netPnl, setNetPnl] = useState('');
  const [setup, setSetup] = useState('Breakout');
  const [session, setSession] = useState('NY Morning');
  const [timeframe, setTimeframe] = useState('5m');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accountId && preferredAccountId) {
      setAccountId(preferredAccountId);
    }
  }, [preferredAccountId, accountId]);

  // Auto-compute PnL when entry, exit, size are present
  const handleComputePnl = () => {
    const ep = Number(entryPrice);
    const xp = Number(exitPrice);
    const sz = Number(size);
    if (!isNaN(ep) && !isNaN(xp) && !isNaN(sz) && ep > 0 && xp > 0 && sz > 0) {
      const calcPnl = direction === 'Long' ? (xp - ep) * sz : (ep - xp) * sz;
      setNetPnl(calcPnl.toFixed(2));
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!symbol.trim()) {
      setError('Please enter a valid ticker / symbol.');
      return;
    }
    if (!entryPrice || isNaN(Number(entryPrice)) || Number(entryPrice) <= 0) {
      setError('Please enter a valid entry price.');
      return;
    }
    if (!size || isNaN(Number(size)) || Number(size) <= 0) {
      setError('Please enter a valid position size.');
      return;
    }
    if (!accountId) {
      setError('Please select an account for this trade.');
      return;
    }

    setError('');
    setLoading(true);

    const ep = Number(entryPrice);
    const sl = stopLoss ? Number(stopLoss) : undefined;
    const tp = takeProfit ? Number(takeProfit) : undefined;
    const xp = exitPrice ? Number(exitPrice) : undefined;
    const sz = Number(size);

    let finalPnl = Number(netPnl);
    if (isNaN(finalPnl) && xp) {
      finalPnl = direction === 'Long' ? (xp - ep) * sz : (ep - xp) * sz;
    }

    let calculatedRr = 0;
    if (sl && tp && ep) {
      const risk = Math.abs(ep - sl);
      const reward = Math.abs(tp - ep);
      if (risk > 0) calculatedRr = reward / risk;
    }

    const tradePayload = {
      accountId,
      symbol: symbol.toUpperCase().trim(),
      direction,
      entryDate,
      entryTime,
      entryPrice: ep,
      exitPrice: xp,
      stopLoss: sl,
      takeProfit: tp,
      size: sz,
      netPnl: isNaN(finalPnl) ? 0 : finalPnl,
      riskRewardRatio: Math.round(calculatedRr * 10) / 10,
      setup,
      session,
      timeframe,
      tags: selectedTags,
      notes,
      status: (xp !== undefined || netPnl !== '') ? 'Closed' as const : 'Open' as const,
    };

    const result = await addTrade(tradePayload);
    setLoading(false);

    if (result) {
      navigation.goBack();
    } else {
      setError('Failed to save trade. Please check your network connection.');
    }
  };

  const accountOptions = accounts.map((a) => ({
    label: `${a.name} (${a.currency})`,
    value: a.id,
  }));

  return (
    <ScreenContainer scrollable>
      <Header
        title="Log New Trade"
        subtitle="Record Execution & Setup"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>✕ Cancel</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.formContent}>
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.colors.semantic.dangerDim }]}>
            <Text style={{ color: theme.colors.semantic.danger, fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}

        {/* Account Selector */}
        {accountOptions.length > 0 && (
          <Select
            label="Trading Account"
            options={accountOptions}
            selectedValue={accountId}
            onValueChange={setAccountId}
          />
        )}

        {/* Direction Toggle */}
        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>Direction</Text>
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
              LONG (BUY)
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
              SHORT (SELL)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Symbol & Size */}
        <View style={styles.row}>
          <Input
            label="Ticker / Symbol"
            placeholder="NVDA, AAPL, SPY"
            autoCapitalize="characters"
            value={symbol}
            onChangeText={setSymbol}
            containerStyle={styles.half}
          />
          <Input
            label="Position Size (Shares/Lots)"
            placeholder="100"
            keyboardType="numeric"
            value={size}
            onChangeText={setSize}
            containerStyle={styles.half}
          />
        </View>

        {/* Entry & Exit Price */}
        <View style={styles.row}>
          <Input
            label="Entry Price"
            placeholder="130.50"
            keyboardType="numeric"
            value={entryPrice}
            onChangeText={setEntryPrice}
            containerStyle={styles.half}
          />
          <Input
            label="Exit Price (Optional)"
            placeholder="134.20"
            keyboardType="numeric"
            value={exitPrice}
            onChangeText={(v) => {
              setExitPrice(v);
              handleComputePnl();
            }}
            containerStyle={styles.half}
          />
        </View>

        {/* Stop Loss & Take Profit */}
        <View style={styles.row}>
          <Input
            label="Stop Loss"
            placeholder="128.50"
            keyboardType="numeric"
            value={stopLoss}
            onChangeText={setStopLoss}
            containerStyle={styles.half}
          />
          <Input
            label="Take Profit"
            placeholder="135.00"
            keyboardType="numeric"
            value={takeProfit}
            onChangeText={setTakeProfit}
            containerStyle={styles.half}
          />
        </View>

        {/* Realized Net PnL */}
        <Input
          label="Realized Net P&L ($)"
          placeholder="370.00 or -150.00"
          keyboardType="numeric"
          value={netPnl}
          onChangeText={setNetPnl}
          helper="Calculated automatically if Exit Price & Size are set, or enter manually."
        />

        {/* Date & Time */}
        <View style={styles.row}>
          <Input
            label="Entry Date"
            placeholder="YYYY-MM-DD"
            value={entryDate}
            onChangeText={setEntryDate}
            containerStyle={styles.half}
          />
          <Input
            label="Entry Time"
            placeholder="09:45"
            value={entryTime}
            onChangeText={setEntryTime}
            containerStyle={styles.half}
          />
        </View>

        {/* Setup & Session */}
        <Select
          label="Trading Setup / Strategy"
          options={SETUP_OPTIONS}
          selectedValue={setup}
          onValueChange={setSetup}
        />

        <View style={styles.row}>
          <Select
            label="Session"
            options={SESSION_OPTIONS}
            selectedValue={session}
            onValueChange={setSession}
            containerStyle={styles.half}
          />
          <Select
            label="Timeframe"
            options={TIMEFRAME_OPTIONS}
            selectedValue={timeframe}
            onValueChange={setTimeframe}
            containerStyle={styles.half}
          />
        </View>

        {/* Tags */}
        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>Tags & Psychology</Text>
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

        {/* Notes */}
        <Input
          label="Execution Notes & Observations"
          placeholder="Reason for entry, mental state, key support/resistance..."
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          inputStyle={{ minHeight: 70, textAlignVertical: 'top' }}
        />

        {/* Submit Button */}
        <Button
          title="Save Trade to Journal"
          onPress={handleSubmit}
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
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
