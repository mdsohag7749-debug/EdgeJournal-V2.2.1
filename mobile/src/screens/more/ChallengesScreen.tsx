import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
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
import { useAccounts } from '../../hooks/useAccounts';
import { computeChallengeMetrics, ChallengeMetrics } from '../../utils/challengeStats';
import { formatCurrency } from '../../utils/formatters';
import { Challenge } from '../../types/models';

const CHALLENGE_TYPES = [
  { label: 'Prop Firm Evaluation — Phase 1 (2-Step)', value: 'Phase 1' },
  { label: 'Prop Firm Evaluation — Phase 2 (2-Step)', value: 'Phase 2' },
  { label: 'Prop Firm 1-Step Challenge', value: '1-Step' },
  { label: 'Funded Account Live Management', value: 'Funded' },
  { label: 'Personal Discipline Sprint (21 Days)', value: 'Discipline' },
  { label: 'Custom Target Sprint', value: 'Custom' },
];

function ChallengeProgressBar({
  label,
  value,
  max,
  color,
  hint,
  valueLabel,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  hint?: string;
  valueLabel?: string;
}) {
  const { theme } = useTheme();
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressLabelRow}>
        <Text style={[styles.progressLabel, { color: theme.colors.textMuted }]}>{label}</Text>
        <Text style={[styles.progressPct, { color }]}>
          {valueLabel || `${pct.toFixed(1)}%`}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${pct}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      {hint && <Text style={[styles.progressHint, { color: theme.colors.textFaint }]}>{hint}</Text>}
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { theme } = useTheme();

  const getStatusConfig = () => {
    switch (status) {
      case 'pass':
        return { label: 'PASS', color: theme.colors.semantic.success, bg: `${theme.colors.semantic.success}1A` };
      case 'warning':
        return { label: 'WARNING', color: theme.colors.semantic.warning, bg: `${theme.colors.semantic.warning}1A` };
      case 'failed':
        return { label: 'FAILED', color: theme.colors.semantic.danger, bg: `${theme.colors.semantic.danger}1A` };
      case 'completed':
        return { label: 'COMPLETED', color: theme.colors.semantic.success, bg: `${theme.colors.semantic.success}1A` };
      case 'archived':
        return { label: 'ARCHIVED', color: theme.colors.textFaint, bg: 'rgba(255, 255, 255, 0.08)' };
      case 'active':
      default:
        return { label: 'ACTIVE', color: theme.colors.accent, bg: `${theme.colors.accent}1A` };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

export function ChallengesScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const { challenges, trades, addChallenge, updateChallenge, deleteChallenge } = useData();
  const { accounts, selectedAccount, selectedAccountId } = useAccounts();

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [propFirm, setPropFirm] = useState('');
  const [challengeType, setChallengeType] = useState('Phase 1');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [startingBalance, setStartingBalance] = useState('100000');
  const [profitTarget, setProfitTarget] = useState('10000');
  const [dailyDrawdown, setDailyDrawdown] = useState('5000');
  const [maximumDrawdown, setMaximumDrawdown] = useState('10000');
  const [minTradingDays, setMinTradingDays] = useState('5');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Account options for modal
  const accountOptions = useMemo(() => {
    const list = [{ label: 'Selected / Default Account', value: '' }];
    accounts.forEach((a) => {
      list.push({ label: a.name, value: a.id });
    });
    return list;
  }, [accounts]);

  // Compute live metrics for every challenge derived from actual journal trades
  const enrichedChallenges = useMemo(() => {
    return challenges.map((c) => {
      const linkedAccId = c.accountId || selectedAccountId;
      const acc = linkedAccId ? accounts.find((a) => a.id === linkedAccId) || null : selectedAccount;
      const cTrades = c.accountId
        ? trades.filter((t) => t.accountId === c.accountId)
        : selectedAccountId
        ? trades.filter((t) => t.accountId === selectedAccountId)
        : trades;

      const metrics = computeChallengeMetrics(c, cTrades, acc);
      return {
        challenge: c,
        metrics,
        accountName: acc?.name || 'All Accounts',
      };
    });
  }, [challenges, trades, accounts, selectedAccountId, selectedAccount]);

  const activeChallenges = enrichedChallenges.filter(
    (item) =>
      item.metrics.status !== 'archived' &&
      item.metrics.status !== 'completed' &&
      item.metrics.status !== 'failed'
  );

  const historyChallenges = enrichedChallenges.filter(
    (item) =>
      item.metrics.status === 'completed' ||
      item.metrics.status === 'archived' ||
      item.metrics.status === 'failed'
  );

  const displayList = activeTab === 'active' ? activeChallenges : historyChallenges;

  const handleOpenAdd = () => {
    setEditingChallenge(null);
    setName('');
    setPropFirm('');
    setChallengeType('Phase 1');
    setTargetAccountId(selectedAccountId || '');
    setStartingBalance('100000');
    setProfitTarget('10000');
    setDailyDrawdown('5000');
    setMaximumDrawdown('10000');
    setMinTradingDays('5');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setModalOpen(true);
  };

  const handleOpenEdit = (c: Challenge) => {
    setEditingChallenge(c);
    setName(c.name || c.title || '');
    setPropFirm(c.propFirm || '');
    setChallengeType(c.challengeType || 'Phase 1');
    setTargetAccountId(c.accountId || '');
    setStartingBalance(String(c.startingBalance || 100000));
    setProfitTarget(String(c.profitTarget || 10000));
    setDailyDrawdown(String(c.dailyDrawdown || 5000));
    setMaximumDrawdown(String(c.maximumDrawdown || 10000));
    setMinTradingDays(String(c.minTradingDays || 5));
    setStartDate(c.startDate || new Date().toISOString().split('T')[0]);
    setEndDate(c.endDate || '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a challenge name.');
      return;
    }
    setSaving(true);
    const payload: Partial<Challenge> = {
      name: name.trim(),
      propFirm: propFirm.trim(),
      challengeType,
      accountId: targetAccountId || undefined,
      startingBalance: Number(startingBalance) || 100000,
      profitTarget: Number(profitTarget) || 10000,
      dailyDrawdown: Number(dailyDrawdown) || 5000,
      maximumDrawdown: Number(maximumDrawdown) || 10000,
      minTradingDays: Number(minTradingDays) || 0,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || undefined,
      status: editingChallenge ? editingChallenge.status : 'active',
    };

    if (editingChallenge) {
      await updateChallenge(editingChallenge.id, payload);
    } else {
      await addChallenge(payload);
    }

    setSaving(false);
    setModalOpen(false);
  };

  const handleArchiveToggle = async (c: Challenge, currentStatus: string) => {
    const newStatus = currentStatus === 'archived' ? 'active' : 'archived';
    await updateChallenge(c.id, { status: newStatus });
  };

  const handleDelete = (c: Challenge) => {
    Alert.alert(
      'Delete Challenge',
      `Are you sure you want to delete "${c.name || c.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteChallenge(c.id);
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer scrollable>
      <Header
        title="Live Challenge Progress"
        subtitle="Prop Firm Evaluations & Consistency Rules"
        leftAction={
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back</Text>
          </TouchableOpacity>
        }
      />

      {/* Top Action Bar */}
      <View style={styles.topActionRow}>
        {/* Tab Switcher */}
        <View
          style={[
            styles.tabBar,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('active')}
            style={[
              styles.tabBtn,
              activeTab === 'active' && {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'active' ? theme.colors.text : theme.colors.textMuted },
              ]}
            >
              Active ({activeChallenges.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('history')}
            style={[
              styles.tabBtn,
              activeTab === 'history' && {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'history' ? theme.colors.text : theme.colors.textMuted },
              ]}
            >
              History ({historyChallenges.length})
            </Text>
          </TouchableOpacity>
        </View>

        <Button
          title="+ New Challenge"
          onPress={handleOpenAdd}
          variant="primary"
          size="sm"
        />
      </View>

      {/* Challenge Cards List */}
      {displayList.length === 0 ? (
        <EmptyState
          title={activeTab === 'active' ? 'No Active Challenges' : 'No Challenge History'}
          description={
            activeTab === 'active'
              ? 'Track prop firm evaluations, max drawdown limits, and daily consistency rules.'
              : 'Completed, failed, or archived challenges will appear here.'
          }
          actionTitle={activeTab === 'active' ? 'Create Challenge' : undefined}
          onAction={activeTab === 'active' ? handleOpenAdd : undefined}
        />
      ) : (
        displayList.map(({ challenge: c, metrics: m, accountName }) => {
          const isProfitable = m.netPnl >= 0;
          return (
            <View
              key={c.id}
              style={[
                styles.challengeCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.lg,
                },
              ]}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.challengeTitle, { color: theme.colors.text }]}>
                    {c.name || c.title}
                  </Text>
                  <View style={styles.subInfoRow}>
                    {c.propFirm ? (
                      <Text style={[styles.firmText, { color: theme.colors.textMuted }]}>
                        {c.propFirm} •{' '}
                      </Text>
                    ) : null}
                    <Text style={[styles.typeText, { color: theme.colors.accent }]}>
                      {c.challengeType || 'Evaluation'}
                    </Text>
                    <Text style={[styles.accountTag, { color: theme.colors.textFaint }]}>
                      {' '}· {accountName}
                    </Text>
                  </View>
                </View>
                <StatusBadge status={m.status} />
              </View>

              {/* 2x2 Key Metrics Matrix */}
              <View
                style={[
                  styles.metricMatrix,
                  { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                ]}
              >
                <View style={styles.matrixCell}>
                  <Text style={[styles.matrixLabel, { color: theme.colors.textMuted }]}>
                    Current Balance
                  </Text>
                  <Text style={[styles.matrixVal, { color: theme.colors.text }]}>
                    {formatCurrency(m.currentBalance)}
                  </Text>
                </View>

                <View style={styles.matrixCell}>
                  <Text style={[styles.matrixLabel, { color: theme.colors.textMuted }]}>
                    Realized P&L
                  </Text>
                  <Text
                    style={[
                      styles.matrixVal,
                      {
                        color: isProfitable
                          ? theme.colors.semantic.success
                          : theme.colors.semantic.danger,
                      },
                    ]}
                  >
                    {isProfitable ? `+${formatCurrency(m.netPnl)}` : formatCurrency(m.netPnl)}
                  </Text>
                </View>

                <View style={styles.matrixCell}>
                  <Text style={[styles.matrixLabel, { color: theme.colors.textMuted }]}>
                    Profit Target
                  </Text>
                  <Text style={[styles.matrixVal, { color: theme.colors.text }]}>
                    {formatCurrency(m.profitTarget)}
                  </Text>
                </View>

                <View style={styles.matrixCell}>
                  <Text style={[styles.matrixLabel, { color: theme.colors.textMuted }]}>
                    Trading Days
                  </Text>
                  <Text
                    style={[
                      styles.matrixVal,
                      {
                        color:
                          m.minTradingDays > 0 && m.tradingDaysCompleted >= m.minTradingDays
                            ? theme.colors.semantic.success
                            : theme.colors.text,
                      },
                    ]}
                  >
                    {m.tradingDaysCompleted} / {m.minTradingDays || '∞'}
                  </Text>
                </View>
              </View>

              {/* Live Progress Bars */}
              <View style={styles.progressStack}>
                {/* 1. Profit Target Progress */}
                {m.profitTarget > 0 && (
                  <ChallengeProgressBar
                    label="Profit Target Progress"
                    value={Math.max(0, m.netPnl)}
                    max={m.profitTarget}
                    color={theme.colors.semantic.success}
                    valueLabel={`${(m.profitProgress * 100).toFixed(1)}%`}
                    hint={`${formatCurrency(Math.max(0, m.profitRemaining))} remaining`}
                  />
                )}

                {/* 2. Daily Drawdown */}
                {m.dailyDrawdown > 0 && (
                  <ChallengeProgressBar
                    label="Daily Drawdown Used"
                    value={m.dailyDDUsed}
                    max={m.dailyDrawdown}
                    color={
                      m.dailyDDProgress >= 0.8
                        ? theme.colors.semantic.danger
                        : theme.colors.semantic.warning
                    }
                    valueLabel={`${(m.dailyDDProgress * 100).toFixed(1)}% used`}
                    hint={`${formatCurrency(Math.max(0, m.dailyDDRemaining))} buffer left today`}
                  />
                )}

                {/* 3. Maximum Drawdown */}
                {m.maximumDrawdown > 0 && (
                  <ChallengeProgressBar
                    label="Maximum Drawdown Used"
                    value={m.maxDDUsed}
                    max={m.maximumDrawdown}
                    color={theme.colors.semantic.danger}
                    valueLabel={`${(m.maxDDProgress * 100).toFixed(1)}% used`}
                    hint={`${formatCurrency(Math.max(0, m.maxDDRemaining))} buffer remaining`}
                  />
                )}

                {/* 4. Minimum Trading Days */}
                {m.minTradingDays > 0 && (
                  <ChallengeProgressBar
                    label="Trading Days Requirement"
                    value={m.tradingDaysCompleted}
                    max={m.minTradingDays}
                    color={
                      m.tradingDaysCompleted >= m.minTradingDays
                        ? theme.colors.semantic.success
                        : theme.colors.accent
                    }
                    valueLabel={`${(m.tradingDaysProgress * 100).toFixed(0)}%`}
                    hint={`${m.tradingDaysCompleted} days completed • ${
                      m.tradingDaysRemaining > 0
                        ? `${m.tradingDaysRemaining} days to go`
                        : 'Requirement met'
                    }`}
                  />
                )}
              </View>

              {/* Date Metadata & Days Left */}
              <View style={styles.dateMetaRow}>
                <Text style={[styles.metaText, { color: theme.colors.textFaint }]}>
                  Start: {m.startDate || 'Unset'}
                </Text>
                {m.endDate ? (
                  <Text style={[styles.metaText, { color: theme.colors.textFaint }]}>
                    End: {m.endDate}
                  </Text>
                ) : null}
                {m.daysRemaining !== null && (
                  <Text
                    style={[
                      styles.metaText,
                      {
                        color:
                          m.daysRemaining < 0
                            ? theme.colors.semantic.danger
                            : theme.colors.textMuted,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {m.daysRemaining >= 0
                      ? `${m.daysRemaining} days left`
                      : `${Math.abs(m.daysRemaining)} days overdue`}
                  </Text>
                )}
              </View>

              {/* Action Buttons Row */}
              <View
                style={[
                  styles.cardActionsRow,
                  { borderTopColor: 'rgba(255, 255, 255, 0.06)' },
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleOpenEdit(c)}
                  style={[styles.actionBtn, { backgroundColor: theme.colors.bgElevated }]}
                >
                  <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleArchiveToggle(c, m.status)}
                  style={[styles.actionBtn, { backgroundColor: theme.colors.bgElevated }]}
                >
                  <Text style={[styles.actionBtnText, { color: theme.colors.textMuted }]}>
                    {m.status === 'archived' ? 'Unarchive' : 'Archive'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDelete(c)}
                  style={[styles.actionBtn, { backgroundColor: `${theme.colors.semantic.danger}15` }]}
                >
                  <Text style={[styles.actionBtnText, { color: theme.colors.semantic.danger }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Add / Edit Challenge Modal */}
      <Modal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingChallenge ? 'Edit Challenge' : 'New Prop Evaluation / Challenge'}
      >
        <ScrollView style={{ maxHeight: 460 }}>
          <Input
            label="Challenge Name *"
            placeholder="e.g. 100K Funded Evaluation Phase 1"
            value={name}
            onChangeText={setName}
          />
          <Input
            label="Prop Firm / Platform"
            placeholder="e.g. FTMO, Apex, Topstep, FundedNext"
            value={propFirm}
            onChangeText={setPropFirm}
          />
          <Select
            label="Challenge Type / Phase"
            options={CHALLENGE_TYPES}
            selectedValue={challengeType}
            onValueChange={setChallengeType}
          />
          <Select
            label="Linked Account"
            options={accountOptions}
            selectedValue={targetAccountId}
            onValueChange={setTargetAccountId}
          />
          <Input
            label="Starting Balance ($)"
            keyboardType="numeric"
            value={startingBalance}
            onChangeText={setStartingBalance}
          />
          <Input
            label="Profit Target ($)"
            keyboardType="numeric"
            value={profitTarget}
            onChangeText={setProfitTarget}
          />
          <Input
            label="Max Daily Drawdown ($)"
            keyboardType="numeric"
            value={dailyDrawdown}
            onChangeText={setDailyDrawdown}
          />
          <Input
            label="Overall Max Drawdown ($)"
            keyboardType="numeric"
            value={maximumDrawdown}
            onChangeText={setMaximumDrawdown}
          />
          <Input
            label="Minimum Trading Days"
            keyboardType="numeric"
            value={minTradingDays}
            onChangeText={setMinTradingDays}
          />
          <Input
            label="Start Date (YYYY-MM-DD)"
            placeholder="2026-01-01"
            value={startDate}
            onChangeText={setStartDate}
          />
          <Input
            label="End Date (Optional, YYYY-MM-DD)"
            placeholder="2026-02-01"
            value={endDate}
            onChangeText={setEndDate}
          />

          <Button
            title={editingChallenge ? 'Update Challenge' : 'Save Challenge'}
            onPress={handleSave}
            loading={saving}
            variant="primary"
            size="md"
            style={{ marginTop: 12, marginBottom: 16 }}
          />
        </ScrollView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
    gap: 8,
  },
  tabBar: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  challengeCard: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 3,
  },
  firmText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  accountTag: {
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 14,
  },
  matrixCell: {
    width: '50%',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  matrixLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  matrixVal: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  progressStack: {
    gap: 10,
    marginBottom: 12,
  },
  progressContainer: {
    gap: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressHint: {
    fontSize: 10.5,
    textAlign: 'right',
  },
  dateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  metaText: {
    fontSize: 11,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
