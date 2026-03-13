/**
 * Type definitions for the Support Ticketing system (customer portal subset).
 *
 * Contains only the types needed by the customer-facing broker portal.
 */

export type TicketStatus = 'new' | 'assigned' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type MessageType = 'reply' | 'internal_note';

export interface SupportTicket {
  id: string;
  ticket_number: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  ticket_type: string | null;
  category_id: string | null;
  requester_email: string;
  requester_name: string;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  subcategory_name?: string | null;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_email: string | null;
  sender_name: string | null;
  message_type: MessageType;
  body: string;
  created_at: string;
}

export interface SupportCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  children?: SupportCategory[];
}

export interface TicketListResponse {
  tickets: SupportTicket[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TicketDetailResponse {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
  events: unknown[];
  attachments: unknown[];
  participants: unknown[];
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const STATUS_COLORS: Record<TicketStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  assigned: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-green-100 text-green-800',
  pending: 'bg-orange-100 text-orange-800',
  resolved: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-800',
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};
