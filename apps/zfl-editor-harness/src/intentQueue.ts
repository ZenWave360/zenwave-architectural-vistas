// ZVE-R14: intents are queued first-in, first-out and one is in flight at a time. The queue holds and sends them; it
// does not interpret them. After a rejection the intents queued behind it are cancelled and kept listed, never dropped.
import type { EditOutcome, Intent } from './adapter.ts';

export type QueueState = 'pending' | 'inflight' | 'rejected' | 'cancelled';

export interface QueueItem {
  id: number;
  intent: Intent;
  state: QueueState;
  /** Why a rejected or cancelled item is in that state (ZVE-R16). */
  reason?: string;
}

export function describeOutcome(outcome: EditOutcome): string {
  switch (outcome.status) {
    case 'applied': return `${outcome.edits.length} edit(s) applied`;
    case 'invalid': return outcome.messages.join('; ');
    default: return outcome.reason;
  }
}

export interface IntentQueue {
  enqueue(intent: Intent): number;
  /** Removes a queued, rejected or cancelled item. An in-flight item cannot be discarded. */
  discard(id: number): boolean;
  items(): readonly QueueItem[];
}

export function createIntentQueue(
  run: (intent: Intent) => Promise<EditOutcome>,
  onChange: (items: readonly QueueItem[]) => void = () => {},
): IntentQueue {
  let list: QueueItem[] = [];
  let nextId = 1;
  let running = false;

  const publish = () => onChange([...list]);

  async function pump(): Promise<void> {
    if (running) return;
    const item = list.find((entry) => entry.state === 'pending');
    if (!item) return;
    running = true;
    item.state = 'inflight';
    publish();
    let outcome: EditOutcome;
    try {
      outcome = await run(item.intent);
    } catch (error) {
      outcome = { status: 'invalid', messages: [(error as Error).message] };
    }
    running = false;
    if (outcome.status === 'applied') {
      list = list.filter((entry) => entry !== item);
    } else {
      item.state = 'rejected';
      item.reason = `${outcome.status}: ${describeOutcome(outcome)}`;
      for (const entry of list) {
        if (entry.state === 'pending') {
          entry.state = 'cancelled';
          entry.reason = `cancelled: ${item.intent.op} was rejected before it`;
        }
      }
    }
    publish();
    await pump();
  }

  return {
    enqueue(intent) {
      const id = nextId++;
      list.push({ id, intent, state: 'pending' });
      publish();
      void pump();
      return id;
    },
    discard(id) {
      const item = list.find((entry) => entry.id === id);
      if (!item || item.state === 'inflight') return false;
      list = list.filter((entry) => entry !== item);
      publish();
      return true;
    },
    items: () => [...list],
  };
}
