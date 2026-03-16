/**
 * Supabase query functions for the Support Ticketing system.
 *
 * All mutations go through SECURITY DEFINER RPCs.
 * Categories are fetched via direct table query (SELECT-only).
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
  RequesterSearchResult,
  RecentTicket,
} from './support-types';

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
  return data as unknown as { id: string; assignee_id: string; status: string };
}

export async function addMessage(
  ticketId: string,
  body: string,
  messageType: 'reply' | 'internal_note' = 'reply'
): Promise<{ id: string; ticket_id: string; message_type: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_add_message', {
    p_ticket_id: ticketId,
    p_body: body,
    p_message_type: messageType,
  });
  if (error) throw error;
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
