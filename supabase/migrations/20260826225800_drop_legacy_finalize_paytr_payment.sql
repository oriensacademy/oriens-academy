-- Migration: 20260826225800_drop_legacy_finalize_paytr_payment.sql
-- Explicitly drop the legacy 4-arg finalize_paytr_payment signature to resolve function call ambiguity

drop function if exists public.finalize_paytr_payment(text, text, numeric, jsonb);
