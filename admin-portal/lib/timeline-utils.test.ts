import { describe, it, expect } from 'vitest';
import { buildTimeline } from './timeline-utils';
import type { SupportTicketMessage, SupportTicketEvent } from './support-types';

function makeMessage(overrides: Partial<SupportTicketMessage> = {}): SupportTicketMessage {
  return {
    id: 'msg-1',
    ticket_id: 'ticket-1',
    sender_id: 'user-1',
    sender_email: 'agent@example.com',
    sender_name: 'Agent Smith',
    message_type: 'reply',
    body: 'Test message',
    created_at: '2026-03-10T10:00:00Z',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<SupportTicketEvent> = {}): SupportTicketEvent {
  return {
    id: 'evt-1',
    ticket_id: 'ticket-1',
    actor_id: 'user-1',
    event_type: 'status_changed',
    old_value: 'new',
    new_value: 'assigned',
    metadata: null,
    created_at: '2026-03-10T09:00:00Z',
    ...overrides,
  };
}

describe('buildTimeline', () => {
  it('returns empty array when both messages and events are empty', () => {
    const result = buildTimeline([], []);
    expect(result).toEqual([]);
  });

  it('returns only messages when events are empty (newest first)', () => {
    const msg1 = makeMessage({ id: 'msg-1', created_at: '2026-03-10T10:00:00Z' });
    const msg2 = makeMessage({ id: 'msg-2', created_at: '2026-03-10T11:00:00Z' });

    const result = buildTimeline([msg1, msg2], []);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('message');
    expect(result[0].data).toBe(msg2);
    expect(result[1].type).toBe('message');
    expect(result[1].data).toBe(msg1);
  });

  it('returns only events when messages are empty (newest first)', () => {
    const evt1 = makeEvent({ id: 'evt-1', created_at: '2026-03-10T09:00:00Z' });
    const evt2 = makeEvent({ id: 'evt-2', created_at: '2026-03-10T10:00:00Z' });

    const result = buildTimeline([], [evt1, evt2]);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('event');
    expect(result[0].data).toBe(evt2);
    expect(result[1].type).toBe('event');
    expect(result[1].data).toBe(evt1);
  });

  it('merges and sorts messages and events newest first', () => {
    const msg1 = makeMessage({ id: 'msg-1', created_at: '2026-03-10T10:00:00Z' });
    const msg2 = makeMessage({ id: 'msg-2', created_at: '2026-03-10T12:00:00Z' });
    const evt1 = makeEvent({ id: 'evt-1', created_at: '2026-03-10T09:00:00Z' });
    const evt2 = makeEvent({ id: 'evt-2', created_at: '2026-03-10T11:00:00Z' });

    const result = buildTimeline([msg1, msg2], [evt1, evt2]);
    expect(result).toHaveLength(4);

    // Should be: msg2 (12:00) -> evt2 (11:00) -> msg1 (10:00) -> evt1 (09:00)
    expect(result[0].type).toBe('message');
    expect(result[0].timestamp).toBe('2026-03-10T12:00:00Z');

    expect(result[1].type).toBe('event');
    expect(result[1].timestamp).toBe('2026-03-10T11:00:00Z');

    expect(result[2].type).toBe('message');
    expect(result[2].timestamp).toBe('2026-03-10T10:00:00Z');

    expect(result[3].type).toBe('event');
    expect(result[3].timestamp).toBe('2026-03-10T09:00:00Z');
  });

  it('filters out message_added events', () => {
    const msg1 = makeMessage({ id: 'msg-1', created_at: '2026-03-10T10:00:00Z' });
    const evtMessageAdded = makeEvent({
      id: 'evt-ma',
      event_type: 'message_added',
      created_at: '2026-03-10T10:00:00Z',
    });
    const evtStatus = makeEvent({
      id: 'evt-status',
      event_type: 'status_changed',
      created_at: '2026-03-10T11:00:00Z',
    });

    const result = buildTimeline([msg1], [evtMessageAdded, evtStatus]);
    expect(result).toHaveLength(2);

    // message_added event should be excluded
    expect(result.find((e) => e.type === 'event' && e.data.id === 'evt-ma')).toBeUndefined();

    // status_changed event should be included (newest first: evt-status at 11:00, then msg at 10:00)
    expect(result[0].type).toBe('event');
    expect((result[0].data as SupportTicketEvent).id).toBe('evt-status');
  });

  it('preserves all non-message_added event types', () => {
    const events: SupportTicketEvent[] = [
      makeEvent({ id: 'evt-1', event_type: 'created', created_at: '2026-03-10T08:00:00Z' }),
      makeEvent({ id: 'evt-2', event_type: 'status_changed', created_at: '2026-03-10T09:00:00Z' }),
      makeEvent({ id: 'evt-3', event_type: 'assigned', created_at: '2026-03-10T10:00:00Z' }),
      makeEvent({ id: 'evt-4', event_type: 'priority_changed', created_at: '2026-03-10T11:00:00Z' }),
      makeEvent({ id: 'evt-5', event_type: 'ticket_linked', created_at: '2026-03-10T12:00:00Z' }),
      makeEvent({ id: 'evt-6', event_type: 'participant_added', created_at: '2026-03-10T13:00:00Z' }),
      makeEvent({ id: 'evt-7', event_type: 'message_added', created_at: '2026-03-10T14:00:00Z' }),
    ];

    const result = buildTimeline([], events);
    // 7 events minus 1 message_added = 6
    expect(result).toHaveLength(6);
    expect(result.every((e) => e.type === 'event')).toBe(true);
    expect(result.every((e) => (e.data as SupportTicketEvent).event_type !== 'message_added')).toBe(true);
  });

  it('handles entries with identical timestamps', () => {
    const sameTime = '2026-03-10T10:00:00Z';
    const msg = makeMessage({ id: 'msg-1', created_at: sameTime });
    const evt = makeEvent({ id: 'evt-1', created_at: sameTime });

    const result = buildTimeline([msg], [evt]);
    expect(result).toHaveLength(2);
    // Both present, order among equal timestamps is stable but both should be included
    const types = result.map((e) => e.type);
    expect(types).toContain('message');
    expect(types).toContain('event');
  });
});
