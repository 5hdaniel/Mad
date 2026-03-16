# BACKLOG-948: Expand Support Ticket Search — Database Layer

## Status: Completed

## Description

Expand the support ticket full-text search from subject+description to also include requester name, requester email, and message bodies. Add tsvector columns, GIN indexes, and triggers on the messages table. Update the `support_list_tickets` RPC to search across both tables and return `ts_headline` highlight snippets showing where the match occurred.

## Sprint Assignment

SPRINT-132

## Task

TASK-2182
