import { describe, it, expect } from 'vitest';
import {
  buildPmTimeline,
  getPmEventIcon,
  getPmEventDescription,
  getPmActorName,
} from '../pm-timeline-utils';
import type { PmComment, PmEvent } from '../pm-types';

// ---------------------------------------------------------------------------
// Factory helpers -- minimal objects that satisfy the interfaces
// ---------------------------------------------------------------------------

function makeComment(overrides: Partial<PmComment> = {}): PmComment {
  return {
    id: 'comment-1',
    item_id: 'item-1',
    task_id: null,
    author_id: 'user-1',
    body: 'Test comment',
    deleted_at: null,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<PmEvent> = {}): PmEvent {
  return {
    id: 'event-1',
    item_id: 'item-1',
    task_id: null,
    actor_id: 'user-1',
    event_type: 'status_changed',
    old_value: 'pending',
    new_value: 'in_progress',
    metadata: null,
    created_at: '2026-03-01T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildPmTimeline
// ---------------------------------------------------------------------------

describe('buildPmTimeline', () => {
  it('merges comments and events into a single array', () => {
    const comments = [makeComment()];
    const events = [makeEvent()];
    const timeline = buildPmTimeline(comments, events);

    expect(timeline).toHaveLength(2);

    const types = timeline.map((e) => e.type);
    expect(types).toContain('comment');
    expect(types).toContain('event');
  });

  it('filters out "commented" events to avoid duplicates with comments', () => {
    const comments = [makeComment()];
    const events = [
      makeEvent({ id: 'e1', event_type: 'commented' }),
      makeEvent({ id: 'e2', event_type: 'status_changed' }),
    ];
    const timeline = buildPmTimeline(comments, events);

    // Only the comment + the status_changed event should appear
    expect(timeline).toHaveLength(2);
    const eventEntries = timeline.filter((e) => e.type === 'event');
    expect(eventEntries).toHaveLength(1);
    expect((eventEntries[0].data as PmEvent).event_type).toBe('status_changed');
  });

  it('sorts entries newest-first', () => {
    const comments = [
      makeComment({ id: 'c1', created_at: '2026-03-01T08:00:00Z' }),
      makeComment({ id: 'c2', created_at: '2026-03-03T08:00:00Z' }),
    ];
    const events = [
      makeEvent({ id: 'e1', created_at: '2026-03-02T08:00:00Z' }),
    ];
    const timeline = buildPmTimeline(comments, events);

    expect(timeline).toHaveLength(3);
    // Newest first: c2 (Mar 3), e1 (Mar 2), c1 (Mar 1)
    expect(timeline[0].data.id).toBe('c2');
    expect(timeline[1].data.id).toBe('e1');
    expect(timeline[2].data.id).toBe('c1');
  });

  it('handles empty comments array', () => {
    const events = [makeEvent()];
    const timeline = buildPmTimeline([], events);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe('event');
  });

  it('handles empty events array', () => {
    const comments = [makeComment()];
    const timeline = buildPmTimeline(comments, []);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe('comment');
  });

  it('handles both arrays empty', () => {
    const timeline = buildPmTimeline([], []);
    expect(timeline).toHaveLength(0);
  });

  it('preserves the correct timestamp on each entry', () => {
    const ts = '2026-03-15T14:30:00Z';
    const comments = [makeComment({ created_at: ts })];
    const timeline = buildPmTimeline(comments, []);
    expect(timeline[0].timestamp).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// getPmEventIcon
// ---------------------------------------------------------------------------

describe('getPmEventIcon', () => {
  const knownTypes = [
    'created',
    'status_changed',
    'assigned',
    'field_changed',
    'linked',
    'unlinked',
    'sprint_changed',
    'deleted',
  ];

  it('returns an object with symbol and color for every known event type', () => {
    for (const type of knownTypes) {
      const result = getPmEventIcon(type);
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('color');
      expect(typeof result.symbol).toBe('string');
      expect(typeof result.color).toBe('string');
      expect(result.symbol.length).toBeGreaterThan(0);
      expect(result.color.length).toBeGreaterThan(0);
    }
  });

  it('returns a fallback icon for unknown event types', () => {
    const result = getPmEventIcon('some_unknown_event');
    expect(result).toHaveProperty('symbol');
    expect(result).toHaveProperty('color');
  });

  it('returns distinct icons for different event types', () => {
    const created = getPmEventIcon('created');
    const deleted = getPmEventIcon('deleted');
    // At minimum, different event types should have different symbols
    expect(created.symbol).not.toBe(deleted.symbol);
  });
});

// ---------------------------------------------------------------------------
// getPmEventDescription
// ---------------------------------------------------------------------------

describe('getPmEventDescription', () => {
  it('returns "Item created" for created events', () => {
    const event = makeEvent({ event_type: 'created' });
    expect(getPmEventDescription(event)).toBe('Item created');
  });

  it('returns a status transition string for status_changed with old and new values', () => {
    const event = makeEvent({
      event_type: 'status_changed',
      old_value: 'pending',
      new_value: 'in_progress',
    });
    const desc = getPmEventDescription(event);
    expect(desc).toContain('pending');
    expect(desc).toContain('in_progress');
    expect(desc).toContain('\u2192');
  });

  it('handles status_changed with only new_value', () => {
    const event = makeEvent({
      event_type: 'status_changed',
      old_value: null,
      new_value: 'in_progress',
    });
    const desc = getPmEventDescription(event);
    expect(desc).toContain('in_progress');
  });

  it('returns assigned message with assignee name', () => {
    const event = makeEvent({
      event_type: 'assigned',
      new_value: 'Jane Doe',
    });
    expect(getPmEventDescription(event)).toBe('Assigned to Jane Doe');
  });

  it('returns "Assignment cleared" when assigned with no new_value', () => {
    const event = makeEvent({
      event_type: 'assigned',
      new_value: null,
    });
    expect(getPmEventDescription(event)).toBe('Assignment cleared');
  });

  it('returns field change description using metadata.field', () => {
    const event = makeEvent({
      event_type: 'field_changed',
      old_value: 'low',
      new_value: 'high',
      metadata: { field: 'priority' },
    });
    const desc = getPmEventDescription(event);
    expect(desc).toContain('priority');
    expect(desc).toContain('low');
    expect(desc).toContain('high');
  });

  it('returns generic "Field updated" when field_changed has no metadata.field', () => {
    const event = makeEvent({
      event_type: 'field_changed',
      metadata: null,
    });
    expect(getPmEventDescription(event)).toBe('Field updated');
  });

  it('returns linked description', () => {
    const event = makeEvent({ event_type: 'linked', new_value: 'BACKLOG-42' });
    expect(getPmEventDescription(event)).toContain('BACKLOG-42');
  });

  it('returns unlinked description', () => {
    const event = makeEvent({ event_type: 'unlinked', old_value: 'BACKLOG-42' });
    expect(getPmEventDescription(event)).toContain('BACKLOG-42');
  });

  it('returns "Removed from sprint" for sprint_changed with old_value "removed"', () => {
    const event = makeEvent({
      event_type: 'sprint_changed',
      old_value: 'removed',
    });
    expect(getPmEventDescription(event)).toBe('Removed from sprint');
  });

  it('returns "Moved to sprint" for sprint_changed with a sprint', () => {
    const event = makeEvent({
      event_type: 'sprint_changed',
      old_value: 'sprint-1',
      new_value: 'sprint-2',
    });
    expect(getPmEventDescription(event)).toContain('sprint');
  });

  it('returns "Item deleted" for deleted events', () => {
    const event = makeEvent({ event_type: 'deleted' });
    expect(getPmEventDescription(event)).toBe('Item deleted');
  });

  it('returns "Comment added" for commented events', () => {
    const event = makeEvent({ event_type: 'commented' });
    expect(getPmEventDescription(event)).toBe('Comment added');
  });

  it('returns humanized event_type for unknown events', () => {
    const event = makeEvent({ event_type: 'some_custom_event' });
    // Should replace underscores with spaces
    expect(getPmEventDescription(event)).toBe('some custom event');
  });
});

// ---------------------------------------------------------------------------
// getPmActorName
// ---------------------------------------------------------------------------

describe('getPmActorName', () => {
  it('returns actor_name from top-level when present', () => {
    const event = {
      ...makeEvent(),
      actor_name: 'Alice',
    } as unknown as PmEvent;
    expect(getPmActorName(event)).toBe('Alice');
  });

  it('returns actor_email from top-level when actor_name is absent', () => {
    const event = {
      ...makeEvent(),
      actor_email: 'alice@example.com',
    } as unknown as PmEvent;
    expect(getPmActorName(event)).toBe('alice@example.com');
  });

  it('returns actor_name from metadata when not on top-level', () => {
    const event = makeEvent({
      metadata: { actor_name: 'Bob from metadata' },
    });
    expect(getPmActorName(event)).toBe('Bob from metadata');
  });

  it('returns actor_email from metadata as fallback', () => {
    const event = makeEvent({
      metadata: { actor_email: 'bob@example.com' },
    });
    expect(getPmActorName(event)).toBe('bob@example.com');
  });

  it('returns null when no actor info is available', () => {
    const event = makeEvent({ metadata: null });
    expect(getPmActorName(event)).toBeNull();
  });

  it('returns null when metadata exists but has no actor fields', () => {
    const event = makeEvent({ metadata: { some_other_field: 'value' } });
    expect(getPmActorName(event)).toBeNull();
  });

  it('prefers top-level actor_name over metadata', () => {
    const event = {
      ...makeEvent({ metadata: { actor_name: 'Metadata Name' } }),
      actor_name: 'Top Level Name',
    } as unknown as PmEvent;
    expect(getPmActorName(event)).toBe('Top Level Name');
  });
});
