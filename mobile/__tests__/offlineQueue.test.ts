import { offlineQueue, QueuedMutation } from '../src/services/offline/offlineQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Offline Queue & Sync Engine', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('enqueues pending mutations and persists to local storage', async () => {
    const mutation = await offlineQueue.enqueue({
      id: 'temp-1',
      tempId: 'temp-1',
      userId: 'user-123',
      table: 'trades',
      type: 'insert',
      payload: { instrument: 'NVDA', net_pnl: 500 },
    });

    expect(mutation.status).toBe('pending');
    expect(mutation.retryCount).toBe(0);

    const queue = await offlineQueue.getQueue('user-123');
    expect(queue.length).toBe(1);
    expect(queue[0].payload.instrument).toBe('NVDA');
  });

  it('transitions mutation statuses from pending to syncing and failed with retry count', async () => {
    await offlineQueue.enqueue({
      id: 'temp-2',
      tempId: 'temp-2',
      userId: 'user-123',
      table: 'trades',
      type: 'insert',
      payload: { instrument: 'TSLA', net_pnl: -200 },
    });

    await offlineQueue.updateStatus('user-123', 'temp-2', 'syncing');
    let q = await offlineQueue.getQueue('user-123');
    expect(q[0].status).toBe('syncing');

    await offlineQueue.updateStatus('user-123', 'temp-2', 'failed', true);
    q = await offlineQueue.getQueue('user-123');
    expect(q[0].status).toBe('failed');
    expect(q[0].retryCount).toBe(1);
  });

  it('dequeues successfully synced mutations', async () => {
    await offlineQueue.enqueue({
      id: 'temp-3',
      tempId: 'temp-3',
      userId: 'user-123',
      table: 'trades',
      type: 'insert',
      payload: { instrument: 'AAPL' },
    });

    await offlineQueue.dequeue('user-123', 'temp-3');
    const q = await offlineQueue.getQueue('user-123');
    expect(q.length).toBe(0);
  });
});
