/**
 * EmailThreadCard Tests
 * TASK-1183: Tests for email thread grouping and display
 */
import {
  normalizeSubject,
  groupEmailsByThread,
  createEmailThreads,
  sortEmailThreadsByRecent,
  processEmailThreads,
} from "../EmailThreadCard";
import type { Communication } from "../../types";

// Helper to create mock emails
function createMockEmail(overrides: Partial<Communication> = {}): Communication {
  return {
    id: `email-${Math.random().toString(36).substr(2, 9)}`,
    user_id: "user-1",
    communication_type: "email",
    channel: "email",
    sender: "sender@example.com",
    recipients: "recipient@example.com",
    subject: "Test Subject",
    body_plain: "Test body",
    sent_at: new Date().toISOString(),
    has_attachments: false,
    is_false_positive: false,
    created_at: new Date().toISOString(),
    ...overrides,
  } as Communication;
}

describe("normalizeSubject", () => {
  it("removes Re: prefix", () => {
    expect(normalizeSubject("Re: Hello")).toBe("hello");
    expect(normalizeSubject("RE: Hello")).toBe("hello");
    expect(normalizeSubject("re: Hello")).toBe("hello");
  });

  it("removes Fwd: and FW: prefixes", () => {
    expect(normalizeSubject("Fwd: Hello")).toBe("hello");
    expect(normalizeSubject("FW: Hello")).toBe("hello");
    expect(normalizeSubject("Fw: Hello")).toBe("hello");
    expect(normalizeSubject("fwd: Hello")).toBe("hello");
  });

  it("removes multiple prefixes", () => {
    expect(normalizeSubject("Re: Re: Hello")).toBe("hello");
    expect(normalizeSubject("Fwd: Re: Hello")).toBe("hello");
    expect(normalizeSubject("Re: Fwd: Re: Hello")).toBe("hello");
  });

  it("handles empty/null subjects", () => {
    expect(normalizeSubject("")).toBe("");
    expect(normalizeSubject(null)).toBe("");
    expect(normalizeSubject(undefined)).toBe("");
  });

  it("preserves original subject when no prefix", () => {
    expect(normalizeSubject("Hello World")).toBe("hello world");
  });
});

describe("groupEmailsByThread", () => {
  it("groups emails by email_thread_id", () => {
    const emails = [
      createMockEmail({ id: "1", email_thread_id: "thread-A", subject: "Hello" }),
      createMockEmail({ id: "2", email_thread_id: "thread-A", subject: "Re: Hello" }),
      createMockEmail({ id: "3", email_thread_id: "thread-B", subject: "Other" }),
    ];

    const grouped = groupEmailsByThread(emails);

    expect(grouped.size).toBe(2);
    expect(grouped.get("provider-thread-A")).toHaveLength(2);
    expect(grouped.get("provider-thread-B")).toHaveLength(1);
  });

  it("groups emails by thread_id when email_thread_id is missing", () => {
    const emails = [
      createMockEmail({ id: "1", thread_id: "msg-thread-1", subject: "Hello" }),
      createMockEmail({ id: "2", thread_id: "msg-thread-1", subject: "Re: Hello" }),
    ];

    const grouped = groupEmailsByThread(emails);

    expect(grouped.size).toBe(1);
    expect(grouped.get("thread-msg-thread-1")).toHaveLength(2);
  });

  it("groups emails by normalized subject when no thread ID", () => {
    const emails = [
      createMockEmail({ id: "1", subject: "Project Update" }),
      createMockEmail({ id: "2", subject: "Re: Project Update" }),
      createMockEmail({ id: "3", subject: "RE: project update" }),
    ];

    const grouped = groupEmailsByThread(emails);

    // All three should be in the same group (normalized subject)
    expect(grouped.size).toBe(1);
    const threadKey = Array.from(grouped.keys())[0];
    expect(grouped.get(threadKey)).toHaveLength(3);
  });

  it("creates separate threads for different subjects", () => {
    const emails = [
      createMockEmail({ id: "1", subject: "Topic A" }),
      createMockEmail({ id: "2", subject: "Topic B" }),
    ];

    const grouped = groupEmailsByThread(emails);

    expect(grouped.size).toBe(2);
  });

  it("sorts emails within thread chronologically", () => {
    const emails = [
      createMockEmail({ id: "3", email_thread_id: "t1", sent_at: "2024-01-03T10:00:00Z" }),
      createMockEmail({ id: "1", email_thread_id: "t1", sent_at: "2024-01-01T10:00:00Z" }),
      createMockEmail({ id: "2", email_thread_id: "t1", sent_at: "2024-01-02T10:00:00Z" }),
    ];

    const grouped = groupEmailsByThread(emails);
    const thread = grouped.get("provider-t1");

    expect(thread).toBeDefined();
    expect(thread![0].id).toBe("1");
    expect(thread![1].id).toBe("2");
    expect(thread![2].id).toBe("3");
  });

  it("filters out non-email communications", () => {
    const communications = [
      createMockEmail({ id: "1", subject: "Email" }),
      createMockEmail({ id: "2", communication_type: "text", channel: "sms", subject: "Text" }),
      createMockEmail({ id: "3", subject: "Another Email" }),
    ];

    const grouped = groupEmailsByThread(communications);

    // Should only have 2 emails (text message filtered out)
    let totalEmails = 0;
    grouped.forEach((emails) => {
      totalEmails += emails.length;
    });
    expect(totalEmails).toBe(2);
  });
});

describe("createEmailThreads", () => {
  it("creates EmailThread objects from grouped emails", () => {
    const emails = [
      createMockEmail({
        id: "1",
        email_thread_id: "t1",
        subject: "Meeting",
        sender: "Alice <alice@example.com>",
        recipients: "bob@example.com",
        sent_at: "2024-01-01T10:00:00Z",
      }),
      createMockEmail({
        id: "2",
        email_thread_id: "t1",
        subject: "Re: Meeting",
        sender: "Bob <bob@example.com>",
        recipients: "alice@example.com",
        sent_at: "2024-01-02T10:00:00Z",
      }),
    ];

    const grouped = groupEmailsByThread(emails);
    const threads = createEmailThreads(grouped);

    expect(threads).toHaveLength(1);
    const thread = threads[0];
    expect(thread.subject).toBe("Meeting");
    expect(thread.emailCount).toBe(2);
    expect(thread.participants).toContain("Alice <alice@example.com>");
    expect(thread.startDate.toISOString()).toBe("2024-01-01T10:00:00.000Z");
    expect(thread.endDate.toISOString()).toBe("2024-01-02T10:00:00.000Z");
  });

  it("deduplicates participants by email address", () => {
    const emails = [
      createMockEmail({
        id: "1",
        email_thread_id: "t1",
        sender: "alice@example.com",
        recipients: "bob@example.com",
      }),
      createMockEmail({
        id: "2",
        email_thread_id: "t1",
        sender: "Alice Smith <alice@example.com>",
        recipients: "bob@example.com",
      }),
    ];

    const grouped = groupEmailsByThread(emails);
    const threads = createEmailThreads(grouped);

    // Should prefer the version with display name
    const thread = threads[0];
    const aliceEntries = thread.participants.filter((p) =>
      p.toLowerCase().includes("alice")
    );
    expect(aliceEntries).toHaveLength(1);
    expect(aliceEntries[0]).toContain("Alice Smith");
  });
});

describe("sortEmailThreadsByRecent", () => {
  it("sorts threads by most recent email (newest first)", () => {
    const threads = [
      {
        id: "old",
        subject: "Old Thread",
        participants: [],
        emailCount: 1,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-01"),
        emails: [],
      },
      {
        id: "new",
        subject: "New Thread",
        participants: [],
        emailCount: 1,
        startDate: new Date("2024-01-05"),
        endDate: new Date("2024-01-10"),
        emails: [],
      },
      {
        id: "middle",
        subject: "Middle Thread",
        participants: [],
        emailCount: 1,
        startDate: new Date("2024-01-03"),
        endDate: new Date("2024-01-05"),
        emails: [],
      },
    ];

    const sorted = sortEmailThreadsByRecent(threads);

    expect(sorted[0].id).toBe("new");
    expect(sorted[1].id).toBe("middle");
    expect(sorted[2].id).toBe("old");
  });
});

describe("processEmailThreads", () => {
  it("processes communications into sorted email threads", () => {
    const communications = [
      createMockEmail({
        id: "1",
        email_thread_id: "t1",
        subject: "First Thread",
        sent_at: "2024-01-01T10:00:00Z",
      }),
      createMockEmail({
        id: "2",
        email_thread_id: "t1",
        subject: "Re: First Thread",
        sent_at: "2024-01-02T10:00:00Z",
      }),
      createMockEmail({
        id: "3",
        email_thread_id: "t2",
        subject: "Second Thread",
        sent_at: "2024-01-05T10:00:00Z",
      }),
    ];

    const threads = processEmailThreads(communications);

    // Should have 2 threads, sorted by most recent
    expect(threads).toHaveLength(2);
    expect(threads[0].subject).toBe("Second Thread"); // More recent
    expect(threads[1].subject).toBe("First Thread");
  });

  it("handles empty communications array", () => {
    const threads = processEmailThreads([]);
    expect(threads).toHaveLength(0);
  });

  it("handles single email", () => {
    const communications = [
      createMockEmail({ id: "1", subject: "Solo Email" }),
    ];

    const threads = processEmailThreads(communications);

    expect(threads).toHaveLength(1);
    expect(threads[0].emailCount).toBe(1);
  });
});
