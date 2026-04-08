-- ============================================
-- SUPPORT TICKET CONFIRMATION WEBHOOK
-- Migration: 20260406_support_ticket_confirmation_webhook
-- Purpose: Trigger send-ticket-confirmation edge function on ticket INSERT
-- Task: BACKLOG-1573
-- ============================================

-- Enable pg_net for async HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Trigger function: calls send-ticket-confirmation edge function via pg_net
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_ticket_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _project_url text := 'https://nercleijfrxqcvfjskbc.supabase.co';
  _function_url text;
  _payload jsonb;
BEGIN
  _function_url := _project_url || '/functions/v1/send-ticket-confirmation';

  -- Build the webhook payload matching Supabase webhook format
  _payload := jsonb_build_object(
    'type', 'INSERT',
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', jsonb_build_object(
      'id', NEW.id,
      'ticket_number', NEW.ticket_number,
      'subject', NEW.subject,
      'requester_email', NEW.requester_email,
      'requester_name', NEW.requester_name,
      'source_channel', NEW.source_channel,
      'created_at', NEW.created_at
    ),
    'old_record', null
  );

  -- Fire-and-forget: pg_net.http_post is async, does not block the INSERT
  PERFORM net.http_post(
    url := _function_url,
    body := _payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    )
  );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger: fires after each new ticket is inserted
-- ---------------------------------------------------------------------------
CREATE TRIGGER support_ticket_confirmation_webhook
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ticket_confirmation();

-- Add comment for documentation
COMMENT ON FUNCTION public.notify_ticket_confirmation() IS
  'BACKLOG-1573: Async webhook trigger that calls send-ticket-confirmation edge function on ticket INSERT. Fire-and-forget via pg_net.';
