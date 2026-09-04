CREATE TYPE "application_role" AS ENUM('customer', 'staff', 'admin');--> statement-breakpoint
CREATE TYPE "property_type" AS ENUM('villa', 'apartment', 'townhouse', 'other');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"relationship_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"tax_number" text,
	"billing_address" text,
	"country" text DEFAULT 'Portugal' NOT NULL,
	"internal_notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY,
	"role" "application_role" DEFAULT 'customer'::"application_role" NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"client_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"postal_code" text NOT NULL,
	"locality" text NOT NULL,
	"municipality" text NOT NULL,
	"country" text DEFAULT 'Portugal' NOT NULL,
	"property_type" "property_type" DEFAULT 'other'::"property_type" NOT NULL,
	"bedrooms" integer,
	"bathrooms" integer,
	"has_pool" boolean DEFAULT false NOT NULL,
	"has_garden" boolean DEFAULT false NOT NULL,
	"has_irrigation" boolean DEFAULT false NOT NULL,
	"has_alarm" boolean DEFAULT false NOT NULL,
	"access_notes_private" text,
	"internal_notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"property_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL UNIQUE,
	"display_name" text NOT NULL,
	"role_title" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "client_users_client_user_uidx" ON "client_users" ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "client_users_user_idx" ON "client_users" ("user_id");--> statement-breakpoint
CREATE INDEX "clients_name_idx" ON "clients" ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "clients_email_idx" ON "clients" ("email");--> statement-breakpoint
CREATE INDEX "clients_phone_idx" ON "clients" ("phone");--> statement-breakpoint
CREATE INDEX "clients_tax_number_idx" ON "clients" ("tax_number");--> statement-breakpoint
CREATE INDEX "properties_client_idx" ON "properties" ("client_id");--> statement-breakpoint
CREATE INDEX "properties_locality_idx" ON "properties" ("locality");--> statement-breakpoint
CREATE UNIQUE INDEX "property_users_property_user_uidx" ON "property_users" ("property_id","user_id");--> statement-breakpoint
CREATE INDEX "property_users_user_idx" ON "property_users" ("user_id");--> statement-breakpoint
CREATE INDEX "property_users_property_idx" ON "property_users" ("property_id");--> statement-breakpoint
CREATE INDEX "staff_profiles_user_idx" ON "staff_profiles" ("user_id");--> statement-breakpoint
ALTER TABLE "client_users" ADD CONSTRAINT "client_users_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "property_users" ADD CONSTRAINT "property_users_property_id_properties_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER properties_set_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER staff_profiles_set_updated_at BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.current_app_user_email()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(current_setting('app.user_email', true), '');
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS application_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT role FROM public.profiles WHERE id = public.current_app_user_id();
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(public.current_app_role() IN ('staff', 'admin'), false);
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.can_bootstrap_guardemar_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.current_app_user_email() = 'info@guardemar.com'
    AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin');
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.app_is_staff() THEN
    RAISE EXCEPTION 'role changes require administrator access';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER profiles_protect_role BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
--> statement-breakpoint
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties FORCE ROW LEVEL SECURITY;
ALTER TABLE public.property_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY profiles_select_authorised ON public.profiles
FOR SELECT USING (id = public.current_app_user_id() OR public.app_is_staff());
--> statement-breakpoint
CREATE POLICY profiles_insert_self ON public.profiles
FOR INSERT WITH CHECK (
  id = public.current_app_user_id()
  AND (role = 'customer' OR (role = 'admin' AND public.can_bootstrap_guardemar_admin()))
);
--> statement-breakpoint
CREATE POLICY profiles_update_authorised ON public.profiles
FOR UPDATE USING (id = public.current_app_user_id() OR public.app_is_staff())
WITH CHECK (id = public.current_app_user_id() OR public.app_is_staff());
--> statement-breakpoint
CREATE POLICY clients_select_authorised ON public.clients
FOR SELECT USING (
  public.app_is_staff()
  OR EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.client_id = clients.id AND cu.user_id = public.current_app_user_id()
  )
);
--> statement-breakpoint
CREATE POLICY clients_staff_insert ON public.clients FOR INSERT WITH CHECK (public.app_is_staff());
CREATE POLICY clients_staff_update ON public.clients FOR UPDATE USING (public.app_is_staff()) WITH CHECK (public.app_is_staff());
CREATE POLICY clients_admin_delete ON public.clients FOR DELETE USING (public.current_app_role() = 'admin');
--> statement-breakpoint
CREATE POLICY client_users_select_authorised ON public.client_users
FOR SELECT USING (user_id = public.current_app_user_id() OR public.app_is_staff());
CREATE POLICY client_users_staff_insert ON public.client_users FOR INSERT WITH CHECK (public.app_is_staff());
CREATE POLICY client_users_staff_update ON public.client_users FOR UPDATE USING (public.app_is_staff()) WITH CHECK (public.app_is_staff());
CREATE POLICY client_users_staff_delete ON public.client_users FOR DELETE USING (public.app_is_staff());
--> statement-breakpoint
CREATE POLICY properties_select_authorised ON public.properties
FOR SELECT USING (
  public.app_is_staff()
  OR EXISTS (
    SELECT 1 FROM public.property_users pu
    WHERE pu.property_id = properties.id AND pu.user_id = public.current_app_user_id()
  )
);
CREATE POLICY properties_staff_insert ON public.properties FOR INSERT WITH CHECK (public.app_is_staff());
CREATE POLICY properties_staff_update ON public.properties FOR UPDATE USING (public.app_is_staff()) WITH CHECK (public.app_is_staff());
CREATE POLICY properties_admin_delete ON public.properties FOR DELETE USING (public.current_app_role() = 'admin');
--> statement-breakpoint
CREATE POLICY property_users_select_authorised ON public.property_users
FOR SELECT USING (user_id = public.current_app_user_id() OR public.app_is_staff());
CREATE POLICY property_users_staff_insert ON public.property_users FOR INSERT WITH CHECK (public.app_is_staff());
CREATE POLICY property_users_staff_update ON public.property_users FOR UPDATE USING (public.app_is_staff()) WITH CHECK (public.app_is_staff());
CREATE POLICY property_users_staff_delete ON public.property_users FOR DELETE USING (public.app_is_staff());
--> statement-breakpoint
CREATE POLICY staff_profiles_select_staff ON public.staff_profiles
FOR SELECT USING (user_id = public.current_app_user_id() OR public.app_is_staff());
CREATE POLICY staff_profiles_admin_insert ON public.staff_profiles FOR INSERT WITH CHECK (public.current_app_role() = 'admin');
CREATE POLICY staff_profiles_admin_update ON public.staff_profiles FOR UPDATE USING (public.current_app_role() = 'admin') WITH CHECK (public.current_app_role() = 'admin');
CREATE POLICY staff_profiles_admin_delete ON public.staff_profiles FOR DELETE USING (public.current_app_role() = 'admin');
--> statement-breakpoint
CREATE POLICY audit_events_staff_select ON public.audit_events FOR SELECT USING (public.app_is_staff());
CREATE POLICY audit_events_authenticated_insert ON public.audit_events
FOR INSERT WITH CHECK (actor_user_id = public.current_app_user_id());
--> statement-breakpoint
DROP TRIGGER profiles_protect_role ON public.profiles;
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'role changes require administrator access';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_protect_role BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
--> statement-breakpoint
CREATE POLICY profiles_admin_insert ON public.profiles
FOR INSERT WITH CHECK (public.current_app_role() = 'admin');
