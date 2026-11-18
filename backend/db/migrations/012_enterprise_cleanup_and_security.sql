-- +migrate Up
CREATE INDEX IF NOT EXISTS idx_sync_tombstones_deleted_at
  ON public._sync_tombstones (deleted_at);

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

DO $$
BEGIN
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spatial_ref_sys FROM anon, authenticated;
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;
