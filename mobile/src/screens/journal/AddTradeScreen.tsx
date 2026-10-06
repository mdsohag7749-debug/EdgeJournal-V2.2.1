import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenContainer, Header, Input, Select, Button, Chip, ScreenshotPicker } from '../../components/common';
import { useTheme } from '../../hooks/useTheme';
import { useAccounts } from '../../hooks/useAccounts';
import { useData } from '../../hooks/useData';
import { useAuth } from '../../hooks/useAuth';
import { StagedScreenshot, TRADE_GRADES, MISTAKE_NAMES } from '../../types/models';
import { screenshotService } from '../../services/screenshotService';
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

export function AddTradeScreen({ navigation, route }: { navigation: any; route?: any }) {
  const { theme } = useTheme();
  const { accounts, preferredAccountId } = useAccounts();
  const { addTrade, models, riskCriteria, checklistCriteria } = useData();
  const { user } = useAuth();

  const setupOptions = useMemo(() => {
    if (models && models.length > 0) {
      return models.map((m) => ({ label: m, value: m }));
    }
    return SETUP_OPTIONS;
  }, [models]);

  const [accountId, setAccountId] = useState<string>(route?.params?.defaultAccountId || preferredAccountId || '');
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'Long' | 'Short'>('Long');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryTime, setEntryTime] = useState('09:45');
  const [exitTime, setExitTime] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [size, setSize] = useState('');
  const [netPnl, setNetPnl] = useState('');
  const [commission, setCommission] = useState('');
  const [riskPercent, setRiskPercent] = useState('');
  const [tradeGrade, setTradeGrade] = useState<string>('');
  const [disciplineRating, setDisciplineRating] = useState<number>(6);
  const [confluences, setConfluences] = useState('');
  const [tradeManagement, setTradeManagement] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [selectedMistakes, setSelectedMistakes] = useState<string[]>([]);
  const [setup, setSetup] = useState(models?.[0] || 'Breakout');
  const [session, setSession] = useState('NY Morning');
  const [timeframe, setTimeframe] = useState('5m');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [psychology, setPsychology] = useState<Record<string, number>>({});
  const [riskChecklist, setRiskChecklist] = useState<Record<string, boolean>>({});
  const [tradeChecklist, setTradeChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stagedScreenshots, setStagedScreenshots] = useState<StagedScreenshot[]>([]);

  useEffect(() => {
    if (!accountId && preferredAccountId) {
      setAccountId(preferredAccountId);
    }
  }, [preferredAccountId, accountId]);

  const handleComputePnl = () => {
    const ep = Number(entryPrice);
    const xp = Number(exitPrice);
    const sz = Number(size);
    if (!isNaN(ep) && !isNaN(xp) && !isNaN(sz) && ep > 0 && xp > 0 && sz > 0) {
      const comm = Number(commission) || 0;
      const gross = direction === 'Long' ? (xp - ep) * sz : (ep - xp) * sz;
      const calcPnl = gross - comm;
      setNetPnl(calcPnl.toFixed(2));
    }
  };

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
    const sz = Number(size);
    const commVal = commission ? Number(commission) : undefined;
    const rpVal = riskPercent ? Number(riskPercent) : undefined;

    let finalPnl = Number(netPnl);
    if (isNaN(finalPnl) && xp) {
      const gross = direction === 'Long' ? (xp - ep) * sz : (ep - xp) * sz;
      finalPnl = gross - (commVal || 0);
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
      exitTime: exitTime.trim() || undefined,
      entryPrice: ep,
      exitPrice: xp,
      stopLoss: sl,
      takeProfit: tp,
      size: sz,
      netPnl: isNaN(finalPnl) ? 0 : finalPnl,
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
      status: (xp !== undefined || netPnl !== '') ? 'Closed' as const : 'Open' as const,
    };

    const result = await addTrade(tradePayload);

    if (result?.id && stagedScreenshots.length > 0 && user?.id) {
      try {
        await screenshotService.uploadStagedScreenshots(user.id, result.id, stagedScreenshots);
      } catch {}
    }

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

        {accountOptions.length > 0 && (
          <Select
            label="Trading Account"
            options={accountOptions}
            selectedValue={accountId}
            onValueChange={setAccountId}
          />
        )}

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
            <Text style={[styles.dirText, { color: direction === 'Long' ? theme.colors.semantic.success : theme.colors.textMuted }]}>LONG (BUY)</Text>
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
            <Text style={[styles.dirText, { color: direction === 'Short' ? theme.colors.semantic.danger : theme.colors.textMuted }]}>SHORT (SELL)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <Input
            label="Ticker / Symbol"
            placeholder="EURUSD, NVDA, AAPL"
            autoCapitalize="characters"
            value={symbol}
            onChangeText={setSymbol}
            containerStyle={styles.half}
          />
          <Input
            label="Position Size (Lots/Qty)"
            placeholder="1.0"
            keyboardType="numeric"
            value={size}
            onChangeText={(v) => {
              setSize(v);
              handleComputePnl();
            }}
            containerStyle={styles.half}
          />
        </View>

        <View style={styles.row}>
          <Input
            label="Entry Price"
            placeholder="1.08500"
            keyboardType="numeric"
            value={entryPrice}
            onChangeText={(v) => {
              setEntryPrice(v);
              handleComputePnl();
            }}
            containerStyle={styles.half}
          />
          <Input
            label="Exit Price (Optional)"
            placeholder="1.09200"
            keyboardType="numeric"
            value={exitPrice}
            onChangeText={(v) => {
              setExitPrice(v);
              handleComputePnl();
            }}
            containerStyle={styles.half}
          />
        </View>

        <View style={styles.row}>
          <Input
            label="Stop Loss"
            placeholder="1.08200"
            keyboardType="numeric"
            value={stopLoss}
            onChangeText={setStopLoss}
            containerStyle={styles.half}
          />
          <Input
            label="Take Profit"
            placeholder="1.09500"
            keyboardType="numeric"
            value={takeProfit}
            onChangeText={setTakeProfit}
            containerStyle={styles.half}
          />
        </View>

        <View style={styles.row}>
          <Input
            label="Entry Date"
            placeholder="YYYY-MM-DD"
            value={entryDate}
            onChangeText={setEntryDate}
            containerStyle={styles.third}
          />
          <Input
            label="Entry Time"
            placeholder="09:45"
            value={entryTime}
            onChangeText={setEntryTime}
            containerStyle={styles.third}
          />
          <Input
            label="Exit Time"
            placeholder="11:30"
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
            onChangeText={(v) => {
              setCommission(v);
              handleComputePnl();
            }}
            containerStyle={styles.half}
          />
        </View>

        <Input
          label="Realized Net P&L ($)"
          placeholder="370.00 or -150.00"
          keyboardType="numeric"
          value={netPnl}
          onChangeText={setNetPnl}
          helper="Calculated automatically if Exit Price & Size are set, or enter manually."
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
                <Text style={[styles.gradeChipText, { color: active ? theme.colors.semantic.success : theme.colors.textMuted }]}>{grade}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted, marginTop: 10 }]}>Discipline Rating ({disciplineRating}/10)</Text>
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
                  active && { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
                  { borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.ratingDotText, { color: active ? '#FFFFFF' : theme.colors.textMuted }]}>{n}</Text>
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
        <Text style={[styles.sectionSub, { color: theme.colors.textMuted }]}>Select mistakes made on this trade to track them in Mistake Intelligence.</Text>
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
                <Text style={[styles.mistakeChipText, { color: isSelected ? theme.colors.semantic.danger : theme.colors.textMuted }]}>
                  {isSelected ? '⚠️ ' : ''}{m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="Execution Notes & Observations"
          placeholder="Reason for entry, market context, order flow notes..."
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
        {/* Psychology Matrix */}
        <PsychologyMatrix
          values={psychology}
          onChange={setPsychology}
        />

        {/* Screenshot / Media Upload */}
        <Text style={[styles.sectionHeading, { color: theme.colors.text, marginTop: 14 }]}>Execution Screenshots</Text>
        <ScreenshotPicker
          stagedScreenshots={stagedScreenshots}
          onStagedChange={setStagedScreenshots}
        />

        <Button
          title={loading ? 'Saving Trade...' : 'Save Trade'}
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

