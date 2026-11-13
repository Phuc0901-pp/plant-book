-- +migrate Up
-- Migration 012: Enterprise Database Cleanup & Security Hardening
-- 1. Index for fast tombstone pruning
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_deleted_at
  ON public._sync_tombstones (deleted_at);

-- 2. Stored procedure for automated tombstone pruning (default 30 days retention)
DROP FUNCTION IF EXISTS public.cleanup_old_sync_tombstones(integer);

CREATE FUNCTION public.cleanup_old_sync_tombstones(p_retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public._sync_tombstones
  WHERE deleted_at < NOW() - (p_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 3. Safely revoke write permissions on spatial_ref_sys from anon/authenticated if permitted
DO $$
BEGIN
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spatial_ref_sys FROM anon, authenticated;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
