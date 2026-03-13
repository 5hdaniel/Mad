/**
 * Supabase query functions for the Support Ticketing system (customer portal).
 *
 * These functions are called from the broker portal for customer-facing operations.
 * All mutations go through SECURITY DEFINER RPCs.
 */

import { createClient } from '@/lib/supabase/client';
import type {
  TicketListResponse,
  TicketDetailResponse,
  TicketPriority,
  SupportCategory,
} from './support-types';

export async function listTickets(
  requesterEmail?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<TicketListResponse> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_list_tickets', {
    p_status: null,
    p_priority: null,
    p_category_id: null,
    p_assignee_id: null,
    p_search: null,
    p_requester_email: requesterEmail || null,
    p_page: page,
    p_page_size: pageSize,
  });
  if (error) throw error;
  return data as unknown as TicketListResponse;
}

export async function getTicketDetail(ticketId: string): Promise<TicketDetailResponse> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_get_ticket_detail', {
    p_ticket_id: ticketId,
  });
  if (error) throw error;
  return data as unknown as TicketDetailResponse;
}

export async function createTicket(params: {
  subject: string;
  description: string;
  priority: TicketPriority;
  category_id?: string | null;
  subcategory_id?: string | null;
  requester_email: string;
  requester_name: string;
}): Promise<{ id: string; ticket_number: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_create_ticket', {
    p_subject: params.subject,
    p_description: params.description,
    p_priority: params.priority,
    p_category_id: params.category_id || null,
    p_subcategory_id: params.subcategory_id || null,
    p_requester_email: params.requester_email,
    p_requester_name: params.requester_name,
    p_source_channel: 'web_form',
  });
  if (error) throw error;
  return data as unknown as { id: string; ticket_number: number };
}

export async function addMessage(
  ticketId: string,
  body: string,
  senderEmail?: string,
  senderName?: string
): Promise<{ id: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('support_add_message', {
    p_ticket_id: ticketId,
    p_body: body,
    p_message_type: 'reply',
    p_sender_email: senderEmail || null,
    p_sender_name: senderName || null,
  });
  if (error) throw error;
  return data as unknown as { id: string };
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
