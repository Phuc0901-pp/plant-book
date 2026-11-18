-- +migrate Up

INSERT INTO public.data_audit_logs (user_id, user_name, action_type, target_type, record_id, title, old_data, new_data, note)
SELECT
  NULL,
  'SYSTEM_PHASE2_CLEANUP',
  'CLEANUP_ORPHAN_RECORDS',
  'plant_logs',
  id,
  'Soft-delete orphan plant_log #' || id::text || ' (plant_id IS NULL)',
  jsonb_build_object('plant_id', plant_id, 'log_date', log_date, 'log_type', log_type, 'is_deleted', is_deleted),
  jsonb_build_object('is_deleted', true),
  'Phase 2 Data Cleanliness: orphan plant_log without parent plant'
FROM public.plant_logs
WHERE plant_id IS NULL AND COALESCE(is_deleted, false) = false;

UPDATE public.plant_logs
SET is_deleted = true, deleted_at = COALESCE(deleted_at, NOW())
WHERE plant_id IS NULL AND COALESCE(is_deleted, false) = false;

INSERT INTO public.data_audit_logs (user_id, user_name, action_type, target_type, record_id, title, old_data, new_data, note)
SELECT
  NULL,
  'SYSTEM_PHASE2_CLEANUP',
  'CLEANUP_ORPHAN_RECORDS',
  'plants',
  id,
  'Soft-delete orphan plant #' || id::text || ' (' || COALESCE(public_slug, '') || ', farm_id IS NULL)',
  jsonb_build_object('farm_id', farm_id, 'public_slug', public_slug, 'is_deleted', is_deleted, 'is_public', is_public),
  jsonb_build_object('is_deleted', true, 'is_public', false),
  'Phase 2 Data Cleanliness: orphan plant without parent farm'
FROM public.plants
WHERE farm_id IS NULL AND COALESCE(is_deleted, false) = false;

UPDATE public.plants
SET is_deleted = true, deleted_at = COALESCE(deleted_at, NOW()), is_public = false
WHERE farm_id IS NULL AND COALESCE(is_deleted, false) = false;

ALTER TABLE public.users SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 10,
  autovacuum_analyze_scale_factor = 0.05
);

CREATE OR REPLACE FUNCTION public.cleanup_old_sync_tombstones(p_retention_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF p_retention_days < 7 THEN
    RAISE EXCEPTION 'Retention period must be at least 7 days for sync safety';
  END IF;

  DELETE FROM public._sync_tombstones
  WHERE deleted_at < NOW() - make_interval(days => p_retention_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$fn$;

REVOKE ALL ON FUNCTION public.cleanup_old_sync_tombstones(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_sync_tombstones(integer) TO service_role;

DO $v$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'plantbook_nfc_hmac_secret') THEN
    PERFORM vault.create_secret(
      'plantbook-ntags-iso-secret-v1',
      'plantbook_nfc_hmac_secret',
      'HMAC-SHA256 signing key for NTAG213 tag integrity'
    );
  END IF;
END $v$;

CREATE OR REPLACE FUNCTION public.get_nfc_hmac_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $fn$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'plantbook_nfc_hmac_secret'
  LIMIT 1;
$fn$;

REVOKE ALL ON FUNCTION public.get_nfc_hmac_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_nfc_hmac_secret() TO service_role;

ALTER POLICY public_qr_read_plants ON public.plants TO anon;
ALTER POLICY public_qr_read_farms ON public.farms TO anon;
ALTER POLICY public_qr_read_plant_logs ON public.plant_logs TO anon;
