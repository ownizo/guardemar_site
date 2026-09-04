-- The Phase 1 Guardemar operational model moved to the dedicated Supabase project.
-- This forward-only migration retires the already-applied Netlify Database schema.

DROP TABLE IF EXISTS public.audit_events CASCADE;
DROP TABLE IF EXISTS public.staff_profiles CASCADE;
DROP TABLE IF EXISTS public.property_users CASCADE;
DROP TABLE IF EXISTS public.properties CASCADE;
DROP TABLE IF EXISTS public.client_users CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP FUNCTION IF EXISTS public.protect_profile_role() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.can_bootstrap_guardemar_admin() CASCADE;
DROP FUNCTION IF EXISTS public.app_is_staff() CASCADE;
DROP FUNCTION IF EXISTS public.current_app_role() CASCADE;
DROP FUNCTION IF EXISTS public.current_app_email() CASCADE;
DROP FUNCTION IF EXISTS public.current_app_user_id() CASCADE;

DROP TYPE IF EXISTS public.property_type CASCADE;
DROP TYPE IF EXISTS public.application_role CASCADE;
