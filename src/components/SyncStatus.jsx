import { AnimatePresence, motion } from 'framer-motion';
import { CloudUpload, CheckCircle2 } from 'lucide-react';
import { useQueueCount, useSyncToast } from '../lib/offlineQueue';
import { useAuth } from '../context/AuthContext';

// Floating pill, bottom-left, that appears only while there are
// offline-queued changes waiting to sync. Purely additive — doesn't
// touch Sidebar/Header/any existing layout.
export function SyncPendingIndicator() {
  const { user } = useAuth();
  const count = useQueueCount(user?.id ?? null);

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            left: 20,
            bottom: 20,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            boxShadow: 'var(--shadow-lifted)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          <CloudUpload size={15} color="var(--red)" />
          {count} {count === 1 ? 'change' : 'changes'} pending sync
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Transient toast, bottom-left (same slot the pending indicator just
// vacated), confirming a successful sync. Auto-dismisses on its own
// via useSyncToast.
export function SyncCompletedToast() {
  const [toast, dismiss] = useSyncToast();

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={dismiss}
          role="status"
          style={{
            position: 'fixed',
            left: 20,
            bottom: 20,
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            boxShadow: 'var(--shadow-lifted)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          <CheckCircle2 size={15} color="var(--win)" />
          Synced {toast.count} {toast.count === 1 ? 'change' : 'changes'} to your account
        </motion.div>
      )}
    </AnimatePresence>
  );
}
