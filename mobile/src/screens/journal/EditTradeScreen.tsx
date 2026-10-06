import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, Header, Input, Select, Button, Chip } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useData } from '../../hooks/useData';
import { Trade, TRADE_GRADES, MISTAKE_NAMES } from '../../types/models';
import { PsychologyMatrix } from '../../components/trade/PsychologyMatrix';
import {
  ChecklistSection,
  DEFAULT_RISK_CRITERIA,
  DEFAULT_CHECKLIST_CRITERIA,
} from '../../components/trade/ChecklistSection';

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

export function EditTradeScreen({ navigation, route }: { navigation: any; route: any }) {
  const { theme } = useTheme();
  const { updateTrade, models, riskCriteria, checklistCriteria } = useData();
  const trade: Trade = route.params.trade;

  const setupOptions = useMemo(() => {
    if (models && models.length > 0) {
      return models.map((m) => ({ label: m, value: m }));
    }
    return SETUP_OPTIONS;
  }, [models]);

  const [symbol, setSymbol] = useState(trade.symbol);
  const [direction, setDirection] = useState<'Long' | 'Short'>(trade.direction);
  const [entryDate, setEntryDate] = useState(trade.entryDate);
  const [entryTime, setEntryTime] = useState(trade.entryTime || '');
  const [exitTime, setExitTime] = useState(trade.exitTime || '');
  const [entryPrice, setEntryPrice] = useState(String(trade.entryPrice || ''));
  const [exitPrice, setExitPrice] = useState(trade.exitPrice !== undefined && trade.exitPrice !== null ? String(trade.exitPrice) : '');
  const [stopLoss, setStopLoss] = useState(trade.stopLoss !== undefined && trade.stopLoss !== null ? String(trade.stopLoss) : '');
  const [takeProfit, setTakeProfit] = useState(trade.takeProfit !== undefined && trade.takeProfit !== null ? String(trade.takeProfit) : '');
  const [size, setSize] = useState(String(trade.size || ''));
  const [netPnl, setNetPnl] = useState(trade.netPnl !== undefined && trade.netPnl !== null ? String(trade.netPnl) : '');
  const [commission, setCommission] = useState(trade.commission !== undefined && trade.commission !== null ? String(trade.commission) : '');
  const [riskPercent, setRiskPercent] = useState(trade.riskPercent !== undefined && trade.riskPercent !== null ? String(trade.riskPercent) : '');
  const [tradeGrade, setTradeGrade] = useState<string>(trade.tradeGrade || '');
  const [disciplineRating, setDisciplineRating] = useState<number>(trade.disciplineRating ?? trade.rating ?? 6);
  const [confluences, setConfluences] = useState(trade.confluences || '');
  const [tradeManagement, setTradeManagement] = useState(trade.tradeManagement || '');
  const [lessonsLearned, setLessonsLearned] = useState(trade.lessonsLearned || '');
  const [selectedMistakes, setSelectedMistakes] = useState<string[]>(trade.mistakes || []);
  const [setup, setSetup] = useState(trade.setup || 'Breakout');
  const [session, setSession] = useState(trade.session || 'NY Morning');
  const [timeframe, setTimeframe] = useState(trade.timeframe || '5m');
  const [selectedTags, setSelectedTags] = useState<string[]>(trade.tags || []);
  const [notes, setNotes] = useState(trade.notes || '');
  const [psychology, setPsychology] = useState<Record<string, number>>(trade.psychology || {});
  const [riskChecklist, setRiskChecklist] = useState<Record<string, boolean>>(trade.riskChecklist || {});
  const [tradeChecklist, setTradeChecklist] = useState<Record<string, boolean>>(trade.tradeChecklist || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleMistake = (mistake: string) => {
    setSelectedMistakes((prev) =>
      prev.includes(mistake) ? prev.filter((m) => m !== mistake) : [...prev, mistake]
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

    if (riskPercent.trim() !== '') {
      const rp = Number(riskPercent);
      if (isNaN(rp) || rp <= 0 || rp > 100) {
        setError('Risk % must be a valid number between 0 and 100.');
        return;
      }
    }

    if (commission.trim() !== '') {
      const comm = Number(commission);
      if (isNaN(comm) || comm < 0) {
        setError('Commission must be a valid non-negative number.');
        return;
      }
    }

    setError('');
    setLoading(true);

    const ep = Number(entryPrice);
    const sl = stopLoss ? Number(stopLoss) : undefined;
    const tp = takeProfit ? Number(takeProfit) : undefined;
    const xp = exitPrice ? Number(exitPrice) : undefined;
    const sz = Number(size) || 1;
    const commVal = commission.trim() !== '' ? Number(commission) : undefined;
    const rpVal = riskPercent.trim() !== '' ? Number(riskPercent) : undefined;

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
      exitTime: exitTime.trim() || undefined,
      entryPrice: ep,
      exitPrice: xp,
      stopLoss: sl,
      takeProfit: tp,
      size: sz,
      netPnl: netPnl ? Number(netPnl) : trade.netPnl,
      commission: commVal,
      riskPercent: rpVal,
      riskRewardRatio: Math.round(calculatedRr * 10) / 10,
      setup,
      session,
      timeframe,
      tags: selectedTags,
      mistakes: selectedMistakes,
      tradeGrade: tradeGrade || undefined,
      disciplineRating,
      rating: disciplineRating,
      confluences: confluences.trim() || undefined,
      tradeManagement: tradeManagement.trim() || undefined,
      lessonsLearned: lessonsLearned.trim() || undefined,
      notes,
      psychology,
      riskChecklist,
      tradeChecklist,
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

        <Text style={[styles.sectionHeading, { color: theme.colors.text }]}>1. Execution</Text>

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

        <View style={styles.row}>
          <Input
            label="Ticker / Symbol"
            value={symbol}
            onChangeText={setSymbol}
            containerStyle={styles.half}
          />
          <Input
            label="Position Size (Lots/Qty)"
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

        <View style={styles.row}>
          <Input
            label="Entry Date"
            value={entryDate}
            onChangeText={setEntryDate}
            containerStyle={styles.third}
          />
          <Input
            label="Entry Time"
            value={entryTime}
            onChangeText={setEntryTime}
            containerStyle={styles.third}
          />
          <Input
            label="Exit Time"
            placeholder="HH:MM"
            value={exitTime}
            onChangeText={setExitTime}
            containerStyle={styles.third}
          />
        </View>

        <Text style={[styles.sectionHeading, { color: theme.colors.text, marginTop: 14 }]}>2. Financials</Text>

        <View style={styles.row}>
          <Input
            label="Risk % (Account Risk)"
            placeholder="1.0"
            keyboardType="numeric"
            value={riskPercent}
            onChangeText={setRiskPercent}
            containerStyle={styles.half}
          />
          <Input
            label="Commission ($)"
            placeholder="0.00"
            keyboardType="numeric"
            value={commission}
            onChangeText={setCommission}
            containerStyle={styles.half}
          />
        </View>

        <Input
          label="Realized Net P&L ($)"
          keyboardType="numeric"
          value={netPnl}
          onChangeText={setNetPnl}
        />

        <Text style={[styles.sectionHeading, { color: theme.colors.text, marginTop: 14 }]}>3. Quality & Discipline</Text>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>Trade Grade</Text>
        <View style={styles.gradeRow}>
          {TRADE_GRADES.map((grade) => {
            const active = tradeGrade === grade;
            return (
              <TouchableOpacity
                key={grade}
                activeOpacity={0.8}
                onPress={() => setTradeGrade(active ? '' : grade)}
                style={[
                  styles.gradeChip,
                  active && {
                    backgroundColor: theme.colors.semantic.successDim,
                    borderColor: theme.colors.semantic.success,
                  },
                  { borderColor: theme.colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.gradeChipText,
                    { color: active ? theme.colors.semantic.success : theme.colors.textMuted },
                  ]}
                >
                  {grade}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted, marginTop: 10 }]}>
          Discipline Rating ({disciplineRating}/10)
        </Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
            const active = disciplineRating === n;
            return (
              <TouchableOpacity
                key={n}
                activeOpacity={0.8}
                onPress={() => setDisciplineRating(n)}
                style={[
                  styles.ratingDot,
                  active && {
                    backgroundColor: theme.colors.accent,
                    borderColor: theme.colors.accent,
                  },
                  { borderColor: theme.colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.ratingDotText,
                    { color: active ? '#FFFFFF' : theme.colors.textMuted },
                  ]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="Confluences"
          placeholder="e.g. Daily Key Level + 15m FVG + London Open Liquidity Sweep"
          value={confluences}
          onChangeText={setConfluences}
          multiline
          numberOfLines={2}
          inputStyle={{ minHeight: 50 }}
          containerStyle={{ marginTop: 10 }}
        />

        <Text style={[styles.sectionHeading, { color: theme.colors.text, marginTop: 14 }]}>4. Strategy & Context</Text>

        <Select
          label="Trading Setup / Strategy"
          options={setupOptions}
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

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>Strategy Tags</Text>
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

        <Text style={[styles.sectionHeading, { color: theme.colors.text, marginTop: 14 }]}>5. Execution Mistakes</Text>
        <Text style={[styles.sectionSub, { color: theme.colors.textMuted }]}>
          Select mistakes made on this trade to track them in Mistake Intelligence.
        </Text>
        <View style={styles.mistakeChips}>
          {MISTAKE_NAMES.map((m) => {
            const isSelected = selectedMistakes.includes(m);
            return (
              <TouchableOpacity
                key={m}
                activeOpacity={0.8}
                onPress={() => toggleMistake(m)}
                style={[
                  styles.mistakeChip,
                  isSelected && {
                    backgroundColor: theme.colors.semantic.dangerDim,
                    borderColor: theme.colors.semantic.danger,
                  },
                  { borderColor: theme.colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.mistakeChipText,
                    { color: isSelected ? theme.colors.semantic.danger : theme.colors.textMuted },
                  ]}
                >
                  {isSelected ? '⚠️ ' : ''}{m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionHeading, { color: theme.colors.text, marginTop: 14 }]}>6. Notes & Reflections</Text>

        <Input
          label="Trade Management"
          placeholder="e.g. Scaled 50% at 1.5R, moved stop to breakeven, trailed rest."
          multiline
          numberOfLines={2}
          value={tradeManagement}
          onChangeText={setTradeManagement}
          inputStyle={{ minHeight: 55, textAlignVertical: 'top' }}
        />

        <Input
          label="Lessons Learned"
          placeholder="What would you do differently next time on this setup?"
          multiline
          numberOfLines={2}
          value={lessonsLearned}
          onChangeText={setLessonsLearned}
          inputStyle={{ minHeight: 55, textAlignVertical: 'top' }}
        />

        <Input
          label="Execution Notes & Observations"
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          inputStyle={{ minHeight: 70, textAlignVertical: 'top' }}
        />

        <ChecklistSection
          title="Risk Management Checklist"
          criteria={riskCriteria}
          values={riskChecklist}
          onChange={setRiskChecklist}
        />

        <ChecklistSection
          title="Trade Execution Checklist"
          criteria={checklistCriteria}
          values={tradeChecklist}
          onChange={setTradeChecklist}
        />

        <PsychologyMatrix
          values={psychology}
          onChange={setPsychology}
        />


        <Button
          title={loading ? 'Updating Trade...' : 'Update Trade'}
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
    gap: 8,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  sectionSub: {
    fontSize: 12,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  directionToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dirButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
  },
  third: {
    flex: 1,
  },
  gradeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  gradeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  gradeChipText: {
    fontSize: 14,
    fontWeight: '800',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  ratingDot: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  ratingDotText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tagChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  mistakeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  mistakeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  mistakeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 16,
    marginBottom: 32,
  },
});
