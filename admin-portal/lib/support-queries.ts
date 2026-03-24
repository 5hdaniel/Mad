/**
 * Supabase query functions for the Support Ticketing system.
 *
 * All mutations go through SECURITY DEFINER RPCs.
 * Categories are fetched via direct table query (SELECT-only).
 *
 * Email notifications (TASK-2199):
 * After agent replies (not internal notes) and ticket assignments,
 * fire-and-forget notification calls are sent to the broker portal
 * via the admin portal's /api/support/notify proxy route.
 */

import { createClient } from '@/lib/supabase/client';
import type {
  TicketListParams,
  TicketListResponse,
  TicketStats,
  TicketDetailResponse,
  CreateTicketParams,
  SupportCategory,
  SupportTicketAttachment,
  SupportTicketEvent,
  SupportTicketParticipant,
  SupportResponseTemplate,
  ParticipantRole,
  AgentAnalyticsResponse,
  RelatedTicketsResponse,
  TicketLinkSearchResult,
  RequesterSearchResult,
  RecentTicket,
  SupportSavedView,
} from './support-types';

// ---------------------------------------------------------------------------
// Email notification helpers (TASK-2199)
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags and markdown formatting from text for plain-text preview.
 */
function stripHtmlAndMarkdown(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold **text**
    .replace(/\*(.*?)\*/g, '$1') // Italic *text*
    .replace(/#{1,6}\s/g, '') // Headers
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Links [text](url)
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // Code blocks
    .replace(/\n{2,}/g, '\n') // Multiple newlines
    .trim();
}

/**
 * Send a ticket notification via the admin portal proxy route.
 * Fire-and-forget: errors are logged but never thrown.
 */
function sendTicketNotification(payload: Record<string, unknown>): void {
  fetch('/api/support/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '(no body)');
        console.error('[Support] Notification proxy returned error:', res.status, text);
      }
    })
    .catch((err) => {
      console.error('[Support] Failed to send ticket notification:', err);
    });
}

/**
 * Notify customer that an agent has replied to their ticket.
 * Called after successful addMessage with messageType 'reply'.
 */
function notifyCustomerOfReply(
  ticketId: string,
  replyBody: string,
  ticket: { subject: string; ticket_number: number; requester_email: string },
  agentName: string,
  brokerPortalUrl: string
): void {
  const plainText = stripHtmlAndMarkdown(replyBody);
  const replyPreview = plainText.substring(0, 200) + (plainText.length > 200 ? '...' : '');
  const ticketNumber = `TKT-${String(ticket.ticket_number).padStart(4, '0')}`;

  sendTicketNotification({
    type: 'reply',
    ticketId,
    ticketNumber,
    ticketSubject: ticket.subject,
    customerEmail: ticket.requester_email,
    agentName,
    replyPreview,
    ticketUrl: `${brokerPortalUrl}/dashboard/support/${ticketId}`,
  });
}

/**
 * Notify agent that a ticket has been assigned to them.
 * Called after successful assignTicket.
 */
function notifyAgentOfAssignment(
  ticketId: string,
  ticket: {
    subject: string;
    ticket_number: number;
    requester_name: string;
    priority: string;
  },
  agentEmail: string,
  adminPortalUrl: string
): void {
  const ticketNumber = `TKT-${String(ticket.ticket_number).padStart(4, '0')}`;

  sendTicketNotification({
    type: 'assignment',
    ticketId,
    ticketNumber,
    ticketSubject: ticket.subject,
    agentEmail,
    customerName: ticket.requester_name,
    priority: ticket.priority,
    ticketUrl: `${adminPortalUrl}/support/${ticketId}`,
  });
}

export async function listTickets(params: TicketListParams): Promise<TicketListResponse> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_list_tickets', {
    p_status: params.status || null,
    p_priority: params.priority || null,
    p_category_id: params.category_id || null,
    p_assignee_id: params.assignee_id || null,
    p_search: params.search || null,
    p_requester_email: params.requester_email || null,
    p_page: params.page || 1,
    p_page_size: params.page_size || 20,
    p_sort_by: params.sort_by || 'created_at',
    p_sort_dir: params.sort_dir || 'desc',
  });
  if (error) throw error;
  return data as unknown as TicketListResponse;
}

export async function getTicketStats(): Promise<TicketStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_get_ticket_stats');
  if (error) throw error;
  return data as unknown as TicketStats;
}

export async function getTicketDetail(ticketId: string): Promise<TicketDetailResponse> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_get_ticket_detail', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return data as unknown as TicketDetailResponse;
}

export async function createTicket(
  params: CreateTicketParams
): Promise<{ id: string; ticket_number: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_create_ticket', {
    p_subject: params.subject,
    p_description: params.description,
    p_priority: params.priority,
    p_ticket_type: params.ticket_type || null,
    p_category_id: params.category_id || null,
    p_subcategory_id: params.subcategory_id || null,
    p_requester_email: params.requester_email,
    p_requester_name: params.requester_name,
    p_source_channel: params.source_channel || 'admin_created',
    p_requester_phone: params.requester_phone || null,
    p_preferred_contact: params.preferred_contact || 'email',
  });
  if (error) throw error;
  return data as unknown as { id: string; ticket_number: number };
}

export async function updateTicketStatus(
  ticketId: string,
  newStatus: string,
  pendingReason?: string
): Promise<{ id: string; status: string; changed: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_update_ticket_status', {
    p_ticket_id: ticketId,
    p_new_status: newStatus,
    p_pending_reason: pendingReason || null,
  });
  if (error) throw error;
  return data as unknown as { id: string; status: string; changed: boolean };
}

export async function updateTicketPriority(
  ticketId: string,
  newPriority: string
): Promise<{ id: string; priority: string; changed: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_update_ticket_priority', {
    p_ticket_id: ticketId,
    p_new_priority: newPriority,
  });
  if (error) throw error;
  return data as unknown as { id: string; priority: string; changed: boolean };
}

export async function updateTicketCategory(
  ticketId: string,
  categoryId: string | null
): Promise<{ id: string; category_id: string | null; changed: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_update_ticket_category', {
    p_ticket_id: ticketId,
    p_category_id: categoryId,
  });
  if (error) throw error;
  return data as unknown as { id: string; category_id: string | null; changed: boolean };
}

export async function assignTicket(
  ticketId: string,
  assigneeId: string
): Promise<{ id: string; assignee_id: string; status: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_assign_ticket', {
    p_ticket_id: ticketId,
    p_assignee_id: assigneeId,
  });
  if (error) throw error;

  // Fire-and-forget: notify agent of ticket assignment.
  // Entire notification path is non-blocking -- we don't await any of it.
  const adminPortalUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://admin.keeprcompliance.com';

  Promise.all([
    supabase
      .from('support_tickets')
      .select('subject, ticket_number, requester_name, priority')
      .eq('id', ticketId)
      .single(),
    supabase.rpc('support_list_agents'),
  ])
    .then(([ticketResult, agentResult]) => {
      if (ticketResult.data && agentResult.data) {
        const agents = agentResult.data as unknown as AssignableAgent[];
        const agent = agents.find((a) => a.user_id === assigneeId);
        if (agent) {
          notifyAgentOfAssignment(ticketId, ticketResult.data, agent.email, adminPortalUrl);
        }
      }
    })
    .catch((notifyErr) => {
      console.error('[Support] Failed to prepare assignment notification:', notifyErr);
    });

  return data as unknown as { id: string; assignee_id: string; status: string };
}

export async function addMessage(
  ticketId: string,
  body: string,
  messageType: 'reply' | 'internal_note' = 'reply',
  ticketMeta?: { subject: string; ticket_number: number; requester_email: string }
): Promise<{ id: string; ticket_id: string; message_type: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_add_message', {
    p_ticket_id: ticketId,
    p_body: body,
    p_message_type: messageType,
  });
  if (error) throw error;

  // Fire-and-forget: notify customer of agent reply (never for internal notes).
  // Uses ticketMeta passed from the caller to avoid a direct table query
  // (RLS blocks direct support_tickets reads from the browser client).
  if (messageType === 'reply' && ticketMeta) {
    const brokerPortalUrl =
      process.env.NEXT_PUBLIC_BROKER_PORTAL_URL || 'https://app.keeprcompliance.com';

    supabase.auth.getUser()
      .then(({ data: userData }) => {
        if (userData?.user) {
          const agentName = userData.user.user_metadata?.full_name || 'Support Team';
          notifyCustomerOfReply(ticketId, body, ticketMeta, agentName, brokerPortalUrl);
        }
      })
      .catch((notifyErr) => {
        console.error('[Support] Failed to prepare reply notification:', notifyErr);
      });
  }

  return data as unknown as { id: string; ticket_id: string; message_type: string };
}

export async function getCategories(): Promise<SupportCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('support_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as SupportCategory[];
}

export interface AssignableAgent {
  user_id: string;
  email: string;
  display_name: string;
  role_name: string;
}

export async function getAssignableAgents(): Promise<AssignableAgent[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_list_agents');
  if (error) throw error;
  return (data ?? []) as unknown as AssignableAgent[];
}

/** Build hierarchical category tree from flat list */
export function buildCategoryTree(categories: SupportCategory[]): SupportCategory[] {
  const topLevel = categories.filter((c) => !c.parent_id);
  return topLevel.map((parent) => ({
    ...parent,
    children: categories
      .filter((c) => c.parent_id === parent.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

// --- Requester Lookup functions ---

export async function searchRequesters(query: string): Promise<RequesterSearchResult[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_search_requesters', {
    p_query: query,
  });
  if (error) throw error;
  return (data ?? []) as unknown as RequesterSearchResult[];
}

export async function getRequesterRecentTickets(email: string): Promise<RecentTicket[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_requester_recent_tickets', {
    p_email: email,
  });
  if (error) throw error;
  return (data ?? []) as unknown as RecentTicket[];
}

// --- Analytics functions ---

export async function getAgentAnalytics(periodDays: number = 30): Promise<AgentAnalyticsResponse> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_agent_analytics', {
    p_period_days: periodDays,
  });
  if (error) throw error;
  return data as unknown as AgentAnalyticsResponse;
}

// --- Bulk update functions (TASK-2292) ---

export async function bulkUpdateTickets(
  ticketIds: string[],
  options: { status?: string; assignee_id?: string; priority?: string; category_id?: string; unassign?: boolean }
): Promise<{ updated_count: number; ticket_ids: string[] }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_bulk_update_tickets', {
    p_ticket_ids: ticketIds,
    p_status: options.status || null,
    p_assignee_id: options.assignee_id || null,
    p_priority: options.priority || null,
    p_category_id: options.category_id || null,
    p_unassign: options.unassign || false,
  });
  if (error) throw error;
  return data as unknown as { updated_count: number; ticket_ids: string[] };
}

// --- Delete functions ---

export async function deleteTicket(ticketId: string): Promise<{ deleted: boolean; ticket_number: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_delete_ticket', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return data as unknown as { deleted: boolean; ticket_number: number };
}

// --- Attachment functions ---

export async function uploadAttachment(
  ticketId: string,
  file: File,
  messageId?: string
): Promise<{ id: string; storage_path: string }> {
  const supabase = createClient();
  const attachmentId = crypto.randomUUID();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${ticketId}/${attachmentId}/${sanitizedName}`;

  const { error: uploadError } = await supabase.storage
    .from('support-attachments')
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.rpc('support_add_attachment', {
    p_ticket_id: ticketId,
    p_message_id: messageId || null,
    p_file_name: file.name,
    p_file_size: file.size,
    p_file_type: file.type,
    p_storage_path: storagePath,
  });
  if (error) throw error;
  return data as unknown as { id: string; storage_path: string };
}

export async function listAttachments(ticketId: string): Promise<SupportTicketAttachment[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_list_attachments', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as SupportTicketAttachment[];
}

export async function getAttachmentUrl(storagePath: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// --- Participant functions ---

export async function addParticipant(
  ticketId: string,
  email: string,
  name?: string,
  role: ParticipantRole = 'cc'
): Promise<{ id: string; email: string; role: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_add_participant', {
    p_ticket_id: ticketId,
    p_email: email,
    p_name: name || null,
    p_role: role,
  });
  if (error) throw error;
  return data as unknown as { id: string; email: string; role: string };
}

export async function removeParticipant(participantId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('support_remove_participant', {
    p_participant_id: participantId,
  });
  if (error) throw error;
}

// --- Event functions ---

export async function listEvents(ticketId: string): Promise<SupportTicketEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_list_events', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as SupportTicketEvent[];
}

// --- Response Template functions ---

export async function listTemplates(): Promise<SupportResponseTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_list_templates');
  if (error) throw error;
  return (data ?? []) as unknown as SupportResponseTemplate[];
}

export async function listAllTemplates(): Promise<SupportResponseTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_list_all_templates');
  if (error) throw error;
  return (data ?? []) as unknown as SupportResponseTemplate[];
}

export async function createTemplate(
  name: string,
  body: string,
  category?: string
): Promise<{ id: string; name: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_create_template', {
    p_name: name,
    p_body: body,
    p_category: category || null,
  });
  if (error) throw error;
  return data as unknown as { id: string; name: string };
}

export async function updateTemplate(
  id: string,
  name: string,
  body: string,
  category?: string,
  isActive?: boolean
): Promise<{ id: string; updated: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_update_template', {
    p_id: id,
    p_name: name,
    p_body: body,
    p_category: category || null,
    p_is_active: isActive ?? true,
  });
  if (error) throw error;
  return data as unknown as { id: string; updated: boolean };
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('support_delete_template', {
    p_id: id,
  });
  if (error) throw error;
}

// --- Related Tickets functions ---

export async function getRelatedTickets(ticketId: string): Promise<RelatedTicketsResponse> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_get_related_tickets', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return data as unknown as RelatedTicketsResponse;
}

export async function linkTickets(
  ticketId: string,
  linkedTicketId: string,
  linkType: string = 'related'
): Promise<{ link_id: string; linked: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_link_tickets', {
    p_ticket_id: ticketId,
    p_linked_ticket_id: linkedTicketId,
    p_link_type: linkType,
  });
  if (error) throw error;
  return data as unknown as { link_id: string; linked: boolean };
}

export async function unlinkTickets(
  ticketId: string,
  linkedTicketId: string
): Promise<{ unlinked: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_unlink_tickets', {
    p_ticket_id: ticketId,
    p_linked_ticket_id: linkedTicketId,
  });
  if (error) throw error;
  return data as unknown as { unlinked: boolean };
}

export async function searchTicketsForLink(
  query: string,
  excludeTicketId: string
): Promise<TicketLinkSearchResult[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_search_tickets_for_link', {
    p_query: query,
    p_exclude_ticket_id: excludeTicketId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as TicketLinkSearchResult[];
}

// --- Diagnostics functions (TASK-2283) ---

/**
 * Fetch diagnostics data for a support ticket.
 *
 * Diagnostics are uploaded as JSON file attachments:
 * - Desktop app: "diagnostics.json"
 * - Broker portal: "browser-diagnostics.json"
 *
 * This function finds the diagnostics attachment, downloads the JSON
 * content from Supabase Storage, and returns the parsed object.
 */
export async function getTicketDiagnostics(
  ticketId: string,
  attachments: SupportTicketAttachment[]
): Promise<Record<string, unknown> | null> {
  const diagnosticsAttachment = attachments.find(
    (a) =>
      (a.file_name === 'diagnostics.json' || a.file_name === 'browser-diagnostics.json') &&
      a.file_type === 'application/json'
  );

  if (!diagnosticsAttachment) return null;

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from('support-attachments')
    .download(diagnosticsAttachment.storage_path);

  if (error || !data) return null;

  try {
    const text = await data.text();
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Saved View functions (TASK-2299)
// ---------------------------------------------------------------------------

/** Save a filter view for the current user. */
export async function supportSaveView(
  name: string,
  filtersJson: Record<string, unknown>,
  isShared: boolean = false
): Promise<{ id: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_save_view', {
    p_name: name,
    p_filters_json: filtersJson,
    p_is_shared: isShared,
  });
  if (error) throw error;
  return data as unknown as { id: string };
}

/** List the current user's saved views plus shared views. */
export async function supportListSavedViews(): Promise<SupportSavedView[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_list_saved_views');
  if (error) throw error;
  return (data ?? []) as unknown as SupportSavedView[];
}

/** Delete a saved view. Only the owner can delete it. */
export async function supportDeleteSavedView(viewId: string): Promise<{ success: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_delete_saved_view', {
    p_view_id: viewId,
  });
  if (error) throw error;
  return data as unknown as { success: boolean };
}

// ---------------------------------------------------------------------------
// Backlog Links (BACKLOG-1343)
// ---------------------------------------------------------------------------

export interface BacklogLinkRow {
  id: string;
  link_type: 'fix' | 'related' | 'duplicate';
  backlog_item_id: string;
  item_number: number;
  title: string;
  status: string;
  priority: string;
}

/**
 * Fetch backlog items linked to a support ticket.
 * Joins support_ticket_backlog_links with pm_backlog_items.
 */
export async function getBacklogLinks(ticketId: string): Promise<BacklogLinkRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('support_ticket_backlog_links')
    .select(`
      id,
      link_type,
      backlog_item_id,
      pm_backlog_items!inner (
        item_number,
        title,
        status,
        priority
      )
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Flatten the joined result
  return ((data ?? []) as unknown as Array<{
    id: string;
    link_type: 'fix' | 'related' | 'duplicate';
    backlog_item_id: string;
    pm_backlog_items: {
      item_number: number;
      title: string;
      status: string;
      priority: string;
    };
  }>).map((row) => ({
    id: row.id,
    link_type: row.link_type,
    backlog_item_id: row.backlog_item_id,
    item_number: row.pm_backlog_items.item_number,
    title: row.pm_backlog_items.title,
    status: row.pm_backlog_items.status,
    priority: row.pm_backlog_items.priority,
  }));
}
