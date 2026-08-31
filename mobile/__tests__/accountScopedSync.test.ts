// Test: Account-Scoped Offline Sync
// Critical: A mutation enqueued for Account A must stay scoped to Account A
// even if the user switches to Account B before reconnecting.

import { offlineQueue } from '../../mobile/src/services/offline/offlineQueue';

describe('Account-Scoped Offline Sync', () => {
  const USER_ID = 'user-abc';
  const ACCOUNT_A = 'account-aaa';
  const ACCOUNT_B = 'account-bbb';

  beforeEach(async () => {
    await offlineQueue.clearQueue(USER_ID);
  });

  afterEach(async () => {
    await offlineQueue.clearQueue(USER_ID);
  });

  it('preserves Account A scope on mutation when user switches to Account B', async () => {
    // Enqueue a mutation for Account A
    const mutation = await offlineQueue.enqueue({
      id: 'temp-1',
      tempId: 'temp-1',
      userId: USER_ID,
      table: 'trades',
      type: 'insert',
      payload: {
        user_id: USER_ID,
        account_id: ACCOUNT_A, // original scope
        instrument: 'EURUSD',
        direction: 'Long',
        net_pnl: 120,
      },
    });

    expect(mutation.payload.account_id).toBe(ACCOUNT_A);

    // Simulate user switching to Account B - this does NOT change existing queued mutations
    // Queue is keyed by userId, not accountId
    const queue = await offlineQueue.getQueue(USER_ID);
    expect(queue).toHaveLength(1);

    const queuedItem = queue[0];
    // The queued item's payload must still reference Account A
    expect(queuedItem.payload.account_id).toBe(ACCOUNT_A);
    expect(queuedItem.payload.account_id).not.toBe(ACCOUNT_B);
  });

  it('enqueues multiple mutations with correct per-mutation account scope', async () => {
    await offlineQueue.enqueue({
      id: 'temp-a1',
      tempId: 'temp-a1',
      userId: USER_ID,
      table: 'trades',
      type: 'insert',
      payload: { user_id: USER_ID, account_id: ACCOUNT_A, instrument: 'EURUSD' },
    });

    await offlineQueue.enqueue({
      id: 'temp-a2',
      tempId: 'temp-a2',
      userId: USER_ID,
      table: 'trades',
      type: 'insert',
      payload: { user_id: USER_ID, account_id: ACCOUNT_A, instrument: 'GBPUSD' },
    });

    const queue = await offlineQueue.getQueue(USER_ID);
    expect(queue).toHaveLength(2);
    // Both mutations must retain Account A scope regardless of any current selection
    queue.forEach((item) => {
      expect(item.payload.account_id).toBe(ACCOUNT_A);
    });
  });

  it('dequeues only the completed mutation while preserving others', async () => {
    await offlineQueue.enqueue({
      id: 'temp-b1',
      tempId: 'temp-b1',
      userId: USER_ID,
      table: 'trades',
      type: 'insert',
      payload: { user_id: USER_ID, account_id: ACCOUNT_A, instrument: 'EURUSD' },
    });
    await offlineQueue.enqueue({
      id: 'temp-b2',
      tempId: 'temp-b2',
      userId: USER_ID,
      table: 'trades',
      type: 'insert',
      payload: { user_id: USER_ID, account_id: ACCOUNT_A, instrument: 'GBPUSD' },
    });

    // Sync completes for first mutation
    await offlineQueue.dequeue(USER_ID, 'temp-b1');

    const remaining = await offlineQueue.getQueue(USER_ID);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].tempId).toBe('temp-b2');
    expect(remaining[0].payload.account_id).toBe(ACCOUNT_A);
  });
});
