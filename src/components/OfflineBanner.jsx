import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../lib/offlineQueue';

// Persistent top-of-viewport strip while the browser is offline. Sits
// above the existing app chrome (Sidebar/Header untouched) so nothing
// about the current UI has to move or be redesigned — this just adds
// a thin notice above it, in flow, whenever connectivity drops.
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '9px 16px',
        background: 'var(--red)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
      }}
      role="status"
    >
      <WifiOff size={14} strokeWidth={2.5} />
      You're offline — new entries are being saved on this device and will sync automatically once you're back online.
    </div>
  );
}
