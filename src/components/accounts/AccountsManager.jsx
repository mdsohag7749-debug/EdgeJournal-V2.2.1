import { useMemo, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Search, ArrowUpDown, Wallet, AlertCircle } from 'lucide-react';
import { useAccounts } from '../../context/AccountContext';
import AccountCard from './AccountCard';
import AccountFormModal from './AccountFormModal';
import ConfirmDialog from '../ConfirmDialog';
import { formatBalance } from './accounts';

const SORT_OPTIONS = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'balance-desc', label: 'Balance (High→Low)' },
  { value: 'balance-asc', label: 'Balance (Low→High)' },
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc', label: 'Oldest first' },
];

function matchesSearch(account, q) {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  return [account.name, account.broker, account.accountType, account.platform, account.currency]
    .filter(Boolean)
    .some((v) => v.toLowerCase().includes(term));
}

export default function AccountsManager() {
  const {
    accounts,
    loading,
    selectedAccountId,
    selectAccount,
    addAccount,
    saveAccount,
    removeAccount,
    makeDefault,
  } = useAccounts();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name-asc');
  const [filter, setFilter] = useState('active'); // 'active' | 'archived'
  const [modal, setModal] = useState(null); // { mode: 'create' } | { mode: 'edit', account }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    window.setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 3600);
  }, []);

  const visible = useMemo(() => {
    const archived = filter === 'archived';
    let list = accounts.filter((a) => (a.status === 'archived') === archived).filter((a) => matchesSearch(a, query));

    switch (sort) {
      case 'name-asc':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        list.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'balance-desc':
        list.sort((a, b) => (Number(b.currentBalance) || 0) - (Number(a.currentBalance) || 0));
        break;
      case 'balance-asc':
        list.sort((a, b) => (Number(a.currentBalance) || 0) - (Number(b.currentBalance) || 0));
        break;
      case 'created-desc':
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        break;
      case 'created-asc':
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        break;
      default:
        break;
    }
    return list;
  }, [accounts, query, sort, filter]);

  const archivedCount = accounts.filter((a) => a.status === 'archived').length;
  const activeCount = accounts.length - archivedCount;

  async function handleCreate(input) {
    setBusy(true);
    const saved = await addAccount(input);
    setBusy(false);
    setModal(null);
    if (saved) {
      showToast('success', `${saved.name} created${saved.isDefault ? ' and set as default' : ''}.`);
      if (saved.isDefault) selectAccount(saved.id);
    } else {
      showToast('error', 'Could not create account. Please try again.');
    }
  }

  async function handleEdit(input) {
    if (!modal?.account) return;
    setBusy(true);
    const saved = await saveAccount(modal.account.id, input);
    setBusy(false);
    setModal(null);
    if (saved) showToast('success', `${saved.name} updated.`);
    else showToast('error', 'Could not update account. Please try again.');
  }

  async function handleDuplicate(account) {
    const copy = {
      ...account,
      name: `${account.name} (Copy)`,
      status: 'active',
      isDefault: false,
    };
    const saved = await addAccount(copy);
    if (saved) showToast('success', `${account.name} duplicated as ${saved.name}.`);
    else showToast('error', 'Could not duplicate account.');
  }

  async function handleArchive(account) {
    const fallback = accounts
      .filter((a) => a.id !== account.id && a.status !== 'archived')
      .sort((a, b) => (!!b.isDefault) - (!!a.isDefault))[0];
    const saved = await saveAccount(account.id, { status: 'archived' });
    if (saved) {
      showToast('success', `${account.name} archived.`);
      if (selectedAccountId === account.id && fallback) selectAccount(fallback.id);
    } else {
      showToast('error', 'Could not archive account.');
    }
  }

  async function handleRestore(account) {
    const saved = await saveAccount(account.id, { status: 'active' });
    if (saved) showToast('success', `${account.name} restored.`);
    else showToast('error', 'Could not restore account.');
  }

  async function handleSetDefault(account) {
    await makeDefault(account.id);
    showToast('success', `${account.name} is now your default account.`);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setBusy(true);
    const ok = await removeAccount(deleteTarget.id);
    setBusy(false);
    if (ok) showToast('success', `${deleteTarget.name} deleted.`);
    else showToast('error', 'Could not delete this account. It may still have trades attached.');
    setDeleteTarget(null);
  }

  function openCreate() {
    setModal({ mode: 'create' });
  }
  function openEdit(account) {
    setModal({ mode: 'edit', account });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Toolbar */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn btn-accent"
                onClick={openCreate}
                disabled={loading}
              >
                <Plus size={16} /> Create Account
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search accounts..."
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    padding: '9px 12px 9px 34px',
                    fontSize: 13.5,
                    width: 210,
                  }}
                />
              </div>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  padding: '9px 12px',
                  fontSize: 13.5,
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'active', label: `Active (${activeCount})` },
              { key: 'archived', label: `Archived (${archivedCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: filter === tab.key ? 'var(--red)' : 'transparent',
                  color: filter === tab.key ? '#fff' : 'var(--text-muted)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              background: toast.type === 'success' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)',
              color: toast.type === 'success' ? 'var(--win)' : 'var(--loss)',
              border: `1px solid ${toast.type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
            }}
          >
            {toast.type === 'success' ? <Wallet size={14} /> : <AlertCircle size={14} />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {loading ? (
        <div className="empty-state">
          <p>Loading your accounts…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <Wallet size={26} style={{ marginBottom: 10, color: 'var(--text-faint)' }} />
          <h3>{filter === 'archived' ? 'No archived accounts' : 'No accounts found'}</h3>
          <p>
            {accounts.length === 0
              ? 'Create your first trading account to get started.'
              : query
                ? 'No accounts match your search.'
                : 'Create an account to get started.'}
          </p>
        </div>
      ) : (
        <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
          <AnimatePresence mode="popLayout">
            {visible.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                isSelected={account.id === selectedAccountId}
                onSelect={filter !== 'archived' ? selectAccount : undefined}
                onEdit={openEdit}
                onDuplicate={handleDuplicate}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onSetDefault={() => handleSetDefault(account)}
                onDelete={setDeleteTarget}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Create / Edit modal */}
      <AccountFormModal
        open={!!modal}
        mode={modal?.mode}
        account={modal?.mode === 'edit' ? modal.account : null}
        isFirst={accounts.length === 0}
        busy={busy}
        onClose={() => setModal(null)}
        onSubmit={modal?.mode === 'edit' ? handleEdit : handleCreate}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete account?"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed. Accounts that still hold trades can't be deleted.`
            : ''
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}