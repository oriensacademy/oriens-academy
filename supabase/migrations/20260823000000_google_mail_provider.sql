-- Oriens Academy Database Migration: Update Default Notification Provider to Google Workspace
-- Migration ID: 20260823000000_google_mail_provider.sql

-- 1. Update the default provider column on notification_deliveries outbox table
alter table if exists public.notification_deliveries
  alter column provider set default 'google_workspace';

-- 2. Preserve all existing historical delivery rows unchanged (historical integrity).
-- Any new inserts will default to 'google_workspace' or accept 'google_workspace'.
