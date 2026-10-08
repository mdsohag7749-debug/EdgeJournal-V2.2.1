import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { DEFAULT_FREE_PLAN } from '../../lib/entitlements';
import { fetchCurrentSubscription } from '../../lib/subscriptionApi';
import { supabase } from '../../lib/supabase';

const realtime = vi.hoisted(() => ({ onChange: null }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn((event, filter, callback) => {
          realtime.onChange = callback;
          return channel;
        }),
        subscribe: vi.fn(() => channel),
      };
      return channel;
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../lib/profileApi', () => ({
  fetchProfile: vi.fn().mockResolvedValue({ id: 'user-1', role: 'user' }),
}));

vi.mock('../../lib/subscriptionApi', () => ({
  fetchCurrentSubscription: vi.fn(),
}));

function EntitlementStatus() {
  const { currentPlan, canUse } = useAuth();
  return (
    <output>
      {currentPlan.name}:{canUse('edge_ai') ? 'enabled' : 'locked'}
    </output>
  );
}

describe('live subscription entitlement refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realtime.onChange = null;
    vi.mocked(fetchCurrentSubscription)
      .mockResolvedValueOnce({
        subscription: null,
        plan: DEFAULT_FREE_PLAN,
        status: 'none',
        isActive: false,
      })
      .mockResolvedValueOnce({
        subscription: { id: 'sub-1', status: 'active' },
        plan: {
          ...DEFAULT_FREE_PLAN,
          name: 'Pro',
          slug: 'pro',
          features: [...DEFAULT_FREE_PLAN.features, 'edge_ai'],
        },
        status: 'active',
        isActive: true,
      });
  });

  it('refreshes Edge AI entitlement when the signed-in user subscription changes', async () => {
    render(
      <AuthProvider>
        <EntitlementStatus />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('Free:locked')).toBeInTheDocument());
    await waitFor(() => expect(realtime.onChange).toEqual(expect.any(Function)));
    expect(supabase.channel).toHaveBeenCalledWith('subscription-entitlement-user-1');

    await act(async () => {
      realtime.onChange({ eventType: 'UPDATE' });
    });

    await waitFor(() => expect(screen.getByText('Pro:enabled')).toBeInTheDocument());
    expect(fetchCurrentSubscription).toHaveBeenCalledTimes(2);
  });
});
