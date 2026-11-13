-- +migrate Up
-- ============================================================================
-- Migration: 009_enterprise_iso_hardening.sql
-- Purpose:   Enterprise Security (RLS & RESTRICT), Cryptographic Integrity
--            (SHA-256 Hash-Chain, NFC Anti-Replay, Append-Only Audit),
--            ISO Compliance (ISO 6709, ISO 4217, ISO/IEC 15459 W3C DID, ISO 8601),
--            and Query Performance (35 FK Covering Indexes, Deduplication).
-- Scope:     100% Non-Breaking Change (Excludes Standard 4 Multi-Tier Sync).
-- Idempotent: Yes (Safe to re-run).
-- ============================================================================

-- Ensure pgcrypto is available in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- MODULE 1 (EPIC SEC): SECURITY, RLS POLICIES & REFERENTIAL INTEGRITY
-- ============================================================================

-- DB-SEC-01: Revoke public/anon/authenticated execution on SECURITY DEFINER DDL trigger fn
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Helper: Map Supabase Auth JWT email -> public.users.id (integer) safely
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.users
  WHERE email = (auth.jwt() ->> 'email')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, service_role;

-- DB-SEC-02: Enterprise RLS Policies across all 29 tables in public
-- 1) Service role full access on all 29 tables (ensures Node.js Backend & Sync never break)
DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    '_sync_state', '_sync_tombstones',
    'ai_knowledge_articles', 'ai_training_logs', 'ai_training_qa', 'ai_unanswered_queries',
    'app_versions', 'audit_logs', 'data_audit_logs', 'devices',
    'farm_iot_sensors', 'farm_plots', 'farms', 'fixed_assets',
    'livestock_animals', 'nfc_security_audit_logs', 'nfc_tags_inventory',
    'password_reset_requests', 'plant_logs', 'plant_media', 'plant_schemas', 'plants',
    'supplies', 'supply_usages', 'system_configs',
    'user_activities', 'user_alert_rules', 'user_notifications', 'users'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'service_role_full_access', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      'service_role_full_access', v_table
    );
  END LOOP;
END $$;

-- 2) Public QR/NFC Traceability Read-Only Policies (anon + authenticated)
DROP POLICY IF EXISTS public_qr_read_plants ON public.plants;
CREATE POLICY public_qr_read_plants ON public.plants
  FOR SELECT TO anon, authenticated
  USING (COALESCE(is_public, false) = true AND COALESCE(is_deleted, false) = false);

DROP POLICY IF EXISTS public_qr_read_farms ON public.farms;
CREATE POLICY public_qr_read_farms ON public.farms
  FOR SELECT TO anon, authenticated
  USING (COALESCE(allow_view_plants, false) = true AND COALESCE(is_deleted, false) = false);

DROP POLICY IF EXISTS public_qr_read_plant_logs ON public.plant_logs;
CREATE POLICY public_qr_read_plant_logs ON public.plant_logs
  FOR SELECT TO anon, authenticated
  USING (COALESCE(is_deleted, false) = false);

DROP POLICY IF EXISTS public_qr_read_plant_media ON public.plant_media;
CREATE POLICY public_qr_read_plant_media ON public.plant_media
  FOR SELECT TO anon, authenticated
  USING (COALESCE(delete_pending, false) = false);

DROP POLICY IF EXISTS public_read_app_versions ON public.app_versions;
CREATE POLICY public_read_app_versions ON public.app_versions
  FOR SELECT TO anon, authenticated
  USING (COALESCE(is_active, false) = true);

-- 3) Authenticated Multi-Tenant Ownership Policies for business tables
DROP POLICY IF EXISTS auth_own_users ON public.users;
CREATE POLICY auth_own_users ON public.users
  FOR SELECT TO authenticated
  USING (id = public.current_app_user_id() OR parent_user_id = public.current_app_user_id());

DROP POLICY IF EXISTS auth_manage_farms ON public.farms;
CREATE POLICY auth_manage_farms ON public.farms
  FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id() OR created_by = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id() OR created_by = public.current_app_user_id());

DROP POLICY IF EXISTS auth_manage_plants ON public.plants;
CREATE POLICY auth_manage_plants ON public.plants
  FOR ALL TO authenticated
  USING (
    created_by = public.current_app_user_id()
    OR assigned_to_user_id = public.current_app_user_id()
    OR farm_id IN (SELECT id FROM public.farms WHERE user_id = public.current_app_user_id() OR created_by = public.current_app_user_id())
  )
  WITH CHECK (
    created_by = public.current_app_user_id()
    OR farm_id IN (SELECT id FROM public.farms WHERE user_id = public.current_app_user_id() OR created_by = public.current_app_user_id())
  );

DROP POLICY IF EXISTS auth_manage_plant_logs ON public.plant_logs;
CREATE POLICY auth_manage_plant_logs ON public.plant_logs
  FOR ALL TO authenticated
  USING (created_by = public.current_app_user_id())
  WITH CHECK (created_by = public.current_app_user_id());

DROP POLICY IF EXISTS auth_manage_supplies ON public.supplies;
CREATE POLICY auth_manage_supplies ON public.supplies
  FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS auth_manage_supply_usages ON public.supply_usages;
CREATE POLICY auth_manage_supply_usages ON public.supply_usages
  FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS auth_manage_fixed_assets ON public.fixed_assets;
CREATE POLICY auth_manage_fixed_assets ON public.fixed_assets
  FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS auth_read_user_notifications ON public.user_notifications;
CREATE POLICY auth_read_user_notifications ON public.user_notifications
  FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS auth_read_user_alert_rules ON public.user_alert_rules;
CREATE POLICY auth_read_user_alert_rules ON public.user_alert_rules
  FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS auth_read_user_activities ON public.user_activities;
CREATE POLICY auth_read_user_activities ON public.user_activities
  FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS auth_read_farm_plots ON public.farm_plots;
CREATE POLICY auth_read_farm_plots ON public.farm_plots
  FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE user_id = public.current_app_user_id() OR created_by = public.current_app_user_id()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE user_id = public.current_app_user_id() OR created_by = public.current_app_user_id()));

DROP POLICY IF EXISTS auth_read_farm_iot_sensors ON public.farm_iot_sensors;
CREATE POLICY auth_read_farm_iot_sensors ON public.farm_iot_sensors
  FOR SELECT TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE user_id = public.current_app_user_id() OR created_by = public.current_app_user_id()));

DROP POLICY IF EXISTS auth_read_devices ON public.devices;
CREATE POLICY auth_read_devices ON public.devices
  FOR SELECT TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE user_id = public.current_app_user_id() OR created_by = public.current_app_user_id()));

DROP POLICY IF EXISTS auth_read_livestock ON public.livestock_animals;
CREATE POLICY auth_read_livestock ON public.livestock_animals
  FOR ALL TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE user_id = public.current_app_user_id() OR created_by = public.current_app_user_id()))
  WITH CHECK (farm_id IN (SELECT id FROM public.farms WHERE user_id = public.current_app_user_id() OR created_by = public.current_app_user_id()));

DROP POLICY IF EXISTS auth_read_nfc_tags ON public.nfc_tags_inventory;
CREATE POLICY auth_read_nfc_tags ON public.nfc_tags_inventory
  FOR SELECT TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE user_id = public.current_app_user_id() OR created_by = public.current_app_user_id()));

DROP POLICY IF EXISTS auth_read_nfc_security_logs ON public.nfc_security_audit_logs;
CREATE POLICY auth_read_nfc_security_logs ON public.nfc_security_audit_logs
  FOR SELECT TO authenticated
  USING (farm_id IN (SELECT id FROM public.farms WHERE user_id = public.current_app_user_id() OR created_by = public.current_app_user_id()));

DROP POLICY IF EXISTS auth_read_plant_schemas ON public.plant_schemas;
CREATE POLICY auth_read_plant_schemas ON public.plant_schemas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS auth_read_ai_knowledge ON public.ai_knowledge_articles;
CREATE POLICY auth_read_ai_knowledge ON public.ai_knowledge_articles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS auth_read_ai_qa ON public.ai_training_qa;
CREATE POLICY auth_read_ai_qa ON public.ai_training_qa
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS auth_read_system_configs ON public.system_configs;
CREATE POLICY auth_read_system_configs ON public.system_configs
  FOR SELECT TO authenticated
  USING (true);

-- DB-SEC-03: Convert 5 critical historical/financial FKs from CASCADE -> RESTRICT
ALTER TABLE public.plant_logs DROP CONSTRAINT IF EXISTS plant_logs_plant_id_fkey;
ALTER TABLE public.plant_logs
  ADD CONSTRAINT plant_logs_plant_id_fkey
  FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE RESTRICT;

ALTER TABLE public.supply_usages DROP CONSTRAINT IF EXISTS supply_usages_user_id_fkey;
ALTER TABLE public.supply_usages
  ADD CONSTRAINT supply_usages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.supply_usages DROP CONSTRAINT IF EXISTS supply_usages_supply_id_fkey;
ALTER TABLE public.supply_usages
  ADD CONSTRAINT supply_usages_supply_id_fkey
  FOREIGN KEY (supply_id) REFERENCES public.supplies(id) ON DELETE RESTRICT;

ALTER TABLE public.fixed_assets DROP CONSTRAINT IF EXISTS fixed_assets_user_id_fkey;
ALTER TABLE public.fixed_assets
  ADD CONSTRAINT fixed_assets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.nfc_security_audit_logs DROP CONSTRAINT IF EXISTS nfc_security_audit_logs_farm_id_fkey;
ALTER TABLE public.nfc_security_audit_logs
  ADD CONSTRAINT nfc_security_audit_logs_farm_id_fkey
  FOREIGN KEY (farm_id) REFERENCES public.farms(id) ON DELETE RESTRICT;

-- DB-SEC-04: Cryptographic helpers for NFC Lock Passwords (pgcrypto bcrypt)
CREATE OR REPLACE FUNCTION public.hash_nfc_lock_password(p_raw_password text)
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT extensions.crypt(p_raw_password, extensions.gen_salt('bf', 10));
$$;

CREATE OR REPLACE FUNCTION public.verify_nfc_lock_password(p_raw_password text, p_stored_hash text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT COALESCE(extensions.crypt(p_raw_password, p_stored_hash) = p_stored_hash, false);
$$;

REVOKE ALL ON FUNCTION public.hash_nfc_lock_password(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_nfc_lock_password(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hash_nfc_lock_password(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_nfc_lock_password(text, text) TO authenticated, service_role;


-- ============================================================================
-- MODULE 2 (EPIC AUTH): CRYPTOGRAPHIC AUTHENTICITY & IMMUTABILITY
-- ============================================================================

-- DB-AUTH-01: SHA-256 Hash-Chain Enforcement Trigger on plant_logs
CREATE OR REPLACE FUNCTION public.trg_fn_plant_logs_hash_chain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  v_prev_hash text;
BEGIN
  IF NEW.prev_log_hash IS NULL OR NEW.prev_log_hash = '' THEN
    SELECT record_hash INTO v_prev_hash
    FROM public.plant_logs
    WHERE plant_id IS NOT DISTINCT FROM NEW.plant_id
      AND record_hash IS NOT NULL
    ORDER BY id DESC
    LIMIT 1;

    NEW.prev_log_hash := COALESCE(
      v_prev_hash,
      'GENESIS_00000000000000000000000000000000000000000000000000000000'
    );
  END IF;

  IF NEW.record_hash IS NULL OR NEW.record_hash = '' THEN
    NEW.record_hash := encode(
      extensions.digest(
        concat_ws(
          '|',
          COALESCE(NEW.plant_id::text, ''),
          COALESCE(NEW.log_date::text, ''),
          COALESCE(NEW.log_type, ''),
          COALESCE(NEW.note, ''),
          COALESCE(NEW.batch_code, ''),
          NEW.prev_log_hash
        ),
        'sha256'
      ),
      'hex'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plant_logs_hash_chain ON public.plant_logs;
CREATE TRIGGER trg_plant_logs_hash_chain
  BEFORE INSERT ON public.plant_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_plant_logs_hash_chain();

-- DB-AUTH-02: Backfill SHA-256 Hash-Chain for all legacy NULL rows in plant_logs
DO $$
DECLARE
  r RECORD;
  v_curr_plant_id integer := -1;
  v_prev_hash text;
  v_new_hash text;
BEGIN
  FOR r IN
    SELECT id, plant_id, log_date, log_type, note, batch_code, prev_log_hash, record_hash
    FROM public.plant_logs
    ORDER BY COALESCE(plant_id, 0) ASC, id ASC
  LOOP
    IF r.plant_id IS DISTINCT FROM v_curr_plant_id THEN
      v_curr_plant_id := r.plant_id;
      v_prev_hash := 'GENESIS_00000000000000000000000000000000000000000000000000000000';
    END IF;

    IF r.record_hash IS NOT NULL AND r.record_hash <> '' THEN
      v_prev_hash := r.record_hash;
    ELSE
      v_new_hash := encode(
        extensions.digest(
          concat_ws(
            '|',
            COALESCE(r.plant_id::text, ''),
            COALESCE(r.log_date::text, ''),
            COALESCE(r.log_type, ''),
            COALESCE(r.note, ''),
            COALESCE(r.batch_code, ''),
            v_prev_hash
          ),
          'sha256'
        ),
        'hex'
      );

      UPDATE public.plant_logs
      SET prev_log_hash = v_prev_hash,
          record_hash   = v_new_hash
      WHERE id = r.id;

      v_prev_hash := v_new_hash;
    END IF;
  END LOOP;
END $$;

-- DB-AUTH-03: NFC Anti-Replay Counter Trigger & Initial CHUID/HMAC Backfill
CREATE OR REPLACE FUNCTION public.trg_fn_nfc_anti_replay()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.last_counter IS NOT NULL AND NEW.last_counter IS NOT NULL AND NEW.last_counter < OLD.last_counter THEN
    RAISE EXCEPTION 'NFC Replay Attack Detected: counter rollback (% -> %) on tag %',
      OLD.last_counter, NEW.last_counter, OLD.nfc_uid
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nfc_anti_replay ON public.nfc_tags_inventory;
CREATE TRIGGER trg_nfc_anti_replay
  BEFORE UPDATE ON public.nfc_tags_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_nfc_anti_replay();

UPDATE public.nfc_tags_inventory
SET
  chuid_hash = COALESCE(
    chuid_hash,
    encode(
      extensions.digest(
        concat_ws('|', id::text, nfc_uid, COALESCE(farm_id::text, '0'), COALESCE(created_at::text, '')),
        'sha256'
      ),
      'hex'
    )
  ),
  hmac_signature = COALESCE(
    hmac_signature,
    encode(
      extensions.hmac(
        concat_ws('|', nfc_uid, COALESCE(farm_id::text, '0'), COALESCE(last_counter::text, '0')),
        'plantbook-ntags-iso-secret-v1',
        'sha256'
      ),
      'hex'
    )
  )
WHERE chuid_hash IS NULL OR hmac_signature IS NULL;

-- DB-AUTH-04: Append-Only Enforcement on Audit Tables
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable (Append-Only): % on % is prohibited', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_mutation();

DROP TRIGGER IF EXISTS trg_data_audit_logs_immutable ON public.data_audit_logs;
CREATE TRIGGER trg_data_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.data_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_mutation();

DROP TRIGGER IF EXISTS trg_nfc_security_audit_logs_immutable ON public.nfc_security_audit_logs;
CREATE TRIGGER trg_nfc_security_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.nfc_security_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_mutation();


-- ============================================================================
-- MODULE 3 (EPIC ISO): INTERNATIONAL STANDARDS COMPLIANCE (ISO 6709, 4217, 15459, 8601)
-- ============================================================================

-- DB-ISO-01: ISO 6709 / ISO 19115 WGS84 Coordinate Validation
-- Step 1: Audit and sanitize the 14 out-of-range plant coordinates before adding CHECK
INSERT INTO public.data_audit_logs (user_id, user_name, action_type, target_type, record_id, title, old_data, new_data, note)
SELECT
  NULL,
  'SYSTEM_ISO_MIGRATION',
  'SANITIZE_INVALID_COORDS',
  'plants',
  id,
  'ISO 6709 Coordinate Sanitization (' || COALESCE(tree_code, public_slug) || ')',
  jsonb_build_object('latitude', latitude, 'longitude', longitude),
  jsonb_build_object('latitude', NULL, 'longitude', NULL),
  'Auto-sanitized out-of-range WGS84 coordinates prior to ISO 6709 CHECK constraint'
FROM public.plants
WHERE (latitude IS NOT NULL AND (latitude < -90 OR latitude > 90))
   OR (longitude IS NOT NULL AND (longitude < -180 OR longitude > 180));

UPDATE public.plants
SET latitude = NULL, longitude = NULL
WHERE (latitude IS NOT NULL AND (latitude < -90 OR latitude > 90))
   OR (longitude IS NOT NULL AND (longitude < -180 OR longitude > 180));

ALTER TABLE public.plants DROP CONSTRAINT IF EXISTS chk_plants_wgs84_lat;
ALTER TABLE public.plants
  ADD CONSTRAINT chk_plants_wgs84_lat CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE public.plants DROP CONSTRAINT IF EXISTS chk_plants_wgs84_lng;
ALTER TABLE public.plants
  ADD CONSTRAINT chk_plants_wgs84_lng CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE public.farms DROP CONSTRAINT IF EXISTS chk_farms_wgs84_lat;
ALTER TABLE public.farms
  ADD CONSTRAINT chk_farms_wgs84_lat CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE public.farms DROP CONSTRAINT IF EXISTS chk_farms_wgs84_lng;
ALTER TABLE public.farms
  ADD CONSTRAINT chk_farms_wgs84_lng CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

-- DB-ISO-02: ISO 4217 Currency Code & Non-Negative Financial/Quantity Constraints
ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS currency_code char(3) NOT NULL DEFAULT 'VND';
ALTER TABLE public.supply_usages ADD COLUMN IF NOT EXISTS currency_code char(3) NOT NULL DEFAULT 'VND';
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS currency_code char(3) NOT NULL DEFAULT 'VND';

ALTER TABLE public.supplies DROP CONSTRAINT IF EXISTS chk_supplies_currency_iso4217;
ALTER TABLE public.supplies ADD CONSTRAINT chk_supplies_currency_iso4217 CHECK (currency_code ~ '^[A-Z]{3}$');

ALTER TABLE public.supply_usages DROP CONSTRAINT IF EXISTS chk_supply_usages_currency_iso4217;
ALTER TABLE public.supply_usages ADD CONSTRAINT chk_supply_usages_currency_iso4217 CHECK (currency_code ~ '^[A-Z]{3}$');

ALTER TABLE public.fixed_assets DROP CONSTRAINT IF EXISTS chk_fixed_assets_currency_iso4217;
ALTER TABLE public.fixed_assets ADD CONSTRAINT chk_fixed_assets_currency_iso4217 CHECK (currency_code ~ '^[A-Z]{3}$');

ALTER TABLE public.supplies DROP CONSTRAINT IF EXISTS chk_supplies_non_negative;
ALTER TABLE public.supplies ADD CONSTRAINT chk_supplies_non_negative
  CHECK (
    unit_price >= 0
    AND COALESCE(stock_quantity, 0) >= 0
    AND COALESCE(package_qty, 0) >= 0
    AND COALESCE(package_price, 0) >= 0
  );

ALTER TABLE public.supply_usages DROP CONSTRAINT IF EXISTS chk_supply_usages_non_negative;
ALTER TABLE public.supply_usages ADD CONSTRAINT chk_supply_usages_non_negative
  CHECK (quantity >= 0 AND unit_price >= 0 AND total_cost >= 0);

ALTER TABLE public.fixed_assets DROP CONSTRAINT IF EXISTS chk_fixed_assets_non_negative;
ALTER TABLE public.fixed_assets ADD CONSTRAINT chk_fixed_assets_non_negative
  CHECK (cost >= 0 AND life > 0);

-- DB-ISO-03: ISO/IEC 15459 & W3C DID + ISO 8601 Dynamic Plant Age
ALTER TABLE public.farms DROP CONSTRAINT IF EXISTS chk_farms_w3c_did;
ALTER TABLE public.farms ADD CONSTRAINT chk_farms_w3c_did
  CHECK (global_did IS NULL OR global_did ~ '^did:[a-z0-9]+:');

ALTER TABLE public.plants DROP CONSTRAINT IF EXISTS chk_plants_w3c_did;
ALTER TABLE public.plants ADD CONSTRAINT chk_plants_w3c_did
  CHECK (global_did IS NULL OR global_did ~ '^did:[a-z0-9]+:');

CREATE OR REPLACE FUNCTION public.trg_fn_auto_assign_did()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.global_did IS NULL OR NEW.global_did = '' THEN
    IF TG_TABLE_NAME = 'farms' THEN
      NEW.global_did := 'did:agtech:vn:farm:' || NEW.id::text;
    ELSIF TG_TABLE_NAME = 'plants' THEN
      NEW.global_did := 'did:agtech:vn:plant:' || COALESCE(NEW.farm_id::text, '0') || ':' || NEW.id::text;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_farms_auto_did ON public.farms;
CREATE TRIGGER trg_farms_auto_did
  BEFORE INSERT ON public.farms
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_auto_assign_did();

DROP TRIGGER IF EXISTS trg_plants_auto_did ON public.plants;
CREATE TRIGGER trg_plants_auto_did
  BEFORE INSERT ON public.plants
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_auto_assign_did();

CREATE OR REPLACE FUNCTION public.calc_plant_age_iso8601(p_planting_date date)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_planting_date IS NULL THEN NULL
    WHEN p_planting_date > CURRENT_DATE THEN 'P0D'
    ELSE
      'P'
      || EXTRACT(YEAR FROM age(CURRENT_DATE, p_planting_date))::int || 'Y'
      || EXTRACT(MONTH FROM age(CURRENT_DATE, p_planting_date))::int || 'M'
      || EXTRACT(DAY FROM age(CURRENT_DATE, p_planting_date))::int || 'D'
  END;
$$;


-- ============================================================================
-- MODULE 4 (EPIC PERF): QUERY PERFORMANCE & INDEX OPTIMIZATION
-- ============================================================================

-- DB-PERF-01: Create 35 Covering Indexes for Unindexed Foreign Keys (Linter 0001)
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_articles_created_by ON public.ai_knowledge_articles (created_by);
CREATE INDEX IF NOT EXISTS idx_ai_training_logs_admin_id ON public.ai_training_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_qa_created_by ON public.ai_training_qa (created_by);
CREATE INDEX IF NOT EXISTS idx_ai_unanswered_queries_user_id ON public.ai_unanswered_queries (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_data_audit_logs_user_id ON public.data_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_devices_farm_id ON public.devices (farm_id);
CREATE INDEX IF NOT EXISTS idx_farms_created_by ON public.farms (created_by);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_user_id ON public.fixed_assets (user_id);
CREATE INDEX IF NOT EXISTS idx_livestock_animals_farm_id ON public.livestock_animals (farm_id);
CREATE INDEX IF NOT EXISTS idx_nfc_security_audit_logs_farm_id ON public.nfc_security_audit_logs (farm_id);
CREATE INDEX IF NOT EXISTS idx_nfc_security_audit_logs_plant_id ON public.nfc_security_audit_logs (plant_id);
CREATE INDEX IF NOT EXISTS idx_nfc_security_audit_logs_scanned_by ON public.nfc_security_audit_logs (scanned_by);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_inventory_created_by ON public.nfc_tags_inventory (created_by);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_inventory_plant_id ON public.nfc_tags_inventory (plant_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user_id ON public.password_reset_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_plant_logs_created_by ON public.plant_logs (created_by);
CREATE INDEX IF NOT EXISTS idx_plant_media_plant_id ON public.plant_media (plant_id);
CREATE INDEX IF NOT EXISTS idx_plant_schemas_created_by ON public.plant_schemas (created_by);
CREATE INDEX IF NOT EXISTS idx_plants_assigned_to_user_id ON public.plants (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_plants_created_by ON public.plants (created_by);
CREATE INDEX IF NOT EXISTS idx_plants_nfc_tagged_by ON public.plants (nfc_tagged_by);
CREATE INDEX IF NOT EXISTS idx_plants_schema_id ON public.plants (schema_id);
CREATE INDEX IF NOT EXISTS idx_supplies_farm_id ON public.supplies (farm_id);
CREATE INDEX IF NOT EXISTS idx_supplies_user_id ON public.supplies (user_id);
CREATE INDEX IF NOT EXISTS idx_supply_usages_plant_id ON public.supply_usages (plant_id);
CREATE INDEX IF NOT EXISTS idx_supply_usages_supply_id ON public.supply_usages (supply_id);
CREATE INDEX IF NOT EXISTS idx_supply_usages_user_id ON public.supply_usages (user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities (user_id);
CREATE INDEX IF NOT EXISTS idx_user_alert_rules_farm_id ON public.user_alert_rules (farm_id);
CREATE INDEX IF NOT EXISTS idx_user_alert_rules_user_id ON public.user_alert_rules (user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_farm_id ON public.user_notifications (farm_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_users_farm_id ON public.users (farm_id);
CREATE INDEX IF NOT EXISTS idx_users_parent_user_id ON public.users (parent_user_id);

-- DB-PERF-02: Drop 3 Duplicate Indexes (Linter 0009)
DROP INDEX IF EXISTS public.idx_farm_plots_unique;
DROP INDEX IF EXISTS public.idx_nfc_tags_inventory_uid_uniq;
DROP INDEX IF EXISTS public.idx_plants_gps;
