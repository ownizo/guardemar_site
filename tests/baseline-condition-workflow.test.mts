import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// Initial Property Condition Report (internal concept: baseline condition
// record) -- General Terms v2.5, Clause 8. Static source-pattern coverage,
// matching the style used throughout this test suite (see
// phase2-security.test.mts, checkout-subscription-linkage.test.mts).

const migrationPath = new URL('../supabase/migrations/20260908090000_create_baseline_condition_workflow.sql', import.meta.url)
const portalApiPath = new URL('../netlify/functions/portal-api.mts', import.meta.url)
const configPath = new URL('../src/config/baseline-condition.ts', import.meta.url)
const reviewComponentPath = new URL('../src/components/portal/baseline-condition.tsx', import.meta.url)
const inspectionReportRoutePath = new URL('../src/routes/portal.inspections_.$id.tsx', import.meta.url)
const overviewRoutePath = new URL('../src/routes/portal.index.tsx', import.meta.url)
const propertiesRoutePath = new URL('../src/routes/portal.properties.tsx', import.meta.url)
const adminInspectionsRoutePath = new URL('../src/routes/admin.inspections.tsx', import.meta.url)
const adminInspectionRoutePath = new URL('../src/routes/admin.inspections_.$id.tsx', import.meta.url)
const subscriptionMigrationPath = new URL('../supabase/migrations/20260905120000_create_subscription_and_payment_domain.sql', import.meta.url)
const subscriptionApiPath = new URL('../netlify/functions/subscription-api.mts', import.meta.url)
const subscriptionSharedPath = new URL('../netlify/functions/_subscription-shared.mts', import.meta.url)

const source = (path: URL) => readFile(path, 'utf8')

function functionBody(migration: string, functionSignature: string) {
  const start = migration.indexOf(functionSignature)
  assert.ok(start >= 0, `expected to find ${functionSignature} in the migration`)
  const end = migration.indexOf('\n$$;', start)
  return migration.slice(start, end)
}

test('one canonical baseline per property is enforced by a unique index, not application logic', async () => {
  const migration = await source(migrationPath)
  assert.match(migration, /create unique index inspections_one_active_baseline_per_property_key\s*\non public\.inspections \(property_id\)\s*\nwhere is_baseline and superseded_by is null and status <> 'cancelled'/)
})

test('customer can see only their own property\'s baseline evidence, staff can see all', async () => {
  const migration = await source(migrationPath)
  assert.match(migration, /baseline_comments_customer_select[\s\S]*private\.customer_has_property_access\(inspection\.property_id\)/)
  assert.match(migration, /baseline_acks_customer_select[\s\S]*private\.customer_has_property_access\(property_id\)/)
  assert.match(migration, /baseline_comments_staff_select[\s\S]*private\.is_staff\(\)/)
  assert.match(migration, /baseline_acks_staff_select[\s\S]*private\.is_staff\(\)/)
  assert.match(migration, /alter table public\.baseline_condition_comments enable row level security/)
  assert.match(migration, /alter table public\.baseline_condition_acknowledgements enable row level security/)
})

test('the original staff observation and customer comment are immutable to the customer', async () => {
  const migration = await source(migrationPath)
  // Customers can only ever insert comments (never update/delete), and the
  // insert policy forbids setting the staff-response columns themselves.
  assert.match(migration, /revoke all on public\.baseline_condition_comments, public\.baseline_condition_acknowledgements from public, anon, authenticated/)
  assert.match(migration, /grant select, insert on public\.baseline_condition_comments to authenticated/)
  assert.doesNotMatch(migration, /grant update on public\.baseline_condition_comments/)
  assert.doesNotMatch(migration, /grant (update|delete) on public\.baseline_condition_acknowledgements/)
  assert.match(migration, /baseline_comments_customer_insert[\s\S]*staff_response_text is null and staff_responded_by is null and staff_responded_at is null/)
  // A trigger independently guarantees the origin fields can never change, even for the owning role.
  const trigger = functionBody(migration, 'create function private.protect_baseline_comment_origin()')
  assert.match(trigger, /new\.comment_text <> old\.comment_text/)
  assert.match(trigger, /new\.client_user_id <> old\.client_user_id/)
  assert.match(trigger, /the original customer comment is immutable/)
  assert.match(migration, /baseline_condition_comments_protect_origin before update/)
})

test('acknowledgement cannot occur before publication', async () => {
  const migration = await source(migrationPath)
  const acknowledge = functionBody(migration, 'create function public.acknowledge_baseline_condition(inspection_uuid uuid)')
  assert.match(acknowledge, /inspection_record\.status <> 'published'/)
  assert.match(acknowledge, /raise exception 'This is not a published baseline condition report'/)
  const comment = functionBody(migration, 'create function public.submit_baseline_condition_comment(inspection_uuid uuid, area_uuid uuid, comment_body text)')
  assert.match(comment, /inspection_record\.status <> 'published'/)
})

test('customer can confirm the baseline; the acknowledgement wording is fixed server-side, not client-supplied', async () => {
  const migration = await source(migrationPath)
  const config = await source(configPath)
  const acknowledge = functionBody(migration, 'create function public.acknowledge_baseline_condition(inspection_uuid uuid)')
  assert.match(acknowledge, /insert into public\.baseline_condition_acknowledgements/)
  // The RPC never reads confirmation text from its arguments -- only inspection_uuid is a parameter.
  assert.match(migration, /create function public\.acknowledge_baseline_condition\(inspection_uuid uuid\)/)
  const wordingConfirmation = /I confirm that I have reviewed the Initial Property Condition Report and that, except for any comments or corrections submitted by me, it fairly records the visible condition of the property at the commencement of Guardemar/
  const wordingCaveat = /I understand that the report is a visual, non-invasive condition record and not a technical survey, and that concealed, latent or inaccessible defects may not be identified\./
  assert.match(acknowledge, wordingConfirmation)
  assert.match(acknowledge, wordingCaveat)
  assert.match(config, wordingConfirmation)
  assert.match(config, wordingCaveat)
})

test('customer can submit a disagreement or comment without being forced to agree', async () => {
  const migration = await source(migrationPath)
  const portalApi = await source(portalApiPath)
  const comment = functionBody(migration, 'create function public.submit_baseline_condition_comment(inspection_uuid uuid, area_uuid uuid, comment_body text)')
  assert.match(comment, /insert into public\.baseline_condition_comments/)
  assert.match(portalApi, /baseline-comments' && segments\.length === 3\) \{[\s\S]{0,400}submit_baseline_condition_comment/)
  const review = await source(reviewComponentPath)
  assert.match(review, /Add a comment \/ request correction/)
})

test('silence is not acknowledgement: no cron, no auto-accept-after-N-days path exists', async () => {
  const migration = await source(migrationPath)
  assert.doesNotMatch(migration, /pg_cron|auto.?accept|deemed accepted|implicit(ly)? accept/i)
  // baseline_state only ever moves to 'acknowledged' inside acknowledge_baseline_condition, driven by an explicit customer call.
  const occurrences = [...migration.matchAll(/baseline_state = 'acknowledged'/g)]
  assert.equal(occurrences.length, 1)
  const acknowledge = functionBody(migration, 'create function public.acknowledge_baseline_condition(inspection_uuid uuid)')
  assert.match(acknowledge, /baseline_state = 'acknowledged'/)
})

test('acknowledgement timestamp and user are recorded as immutable evidence', async () => {
  const migration = await source(migrationPath)
  assert.match(migration, /user_id uuid not null references auth\.users\(id\)/)
  assert.match(migration, /acknowledged_at timestamptz not null default now\(\)/)
  assert.match(migration, /baseline_condition_acknowledgements_immutable before update or delete/)
  assert.match(migration, /private\.prevent_immutable_legal_record_change\(\)/)
})

test('duplicate acknowledgement is idempotent', async () => {
  const migration = await source(migrationPath)
  assert.match(migration, /inspection_id uuid not null unique references public\.inspections\(id\)/)
  const acknowledge = functionBody(migration, 'create function public.acknowledge_baseline_condition(inspection_uuid uuid)')
  assert.match(acknowledge, /select \* into existing from public\.baseline_condition_acknowledgements where inspection_id = inspection_uuid;\s*\n\s*if existing\.id is not null then return existing; end if;/)
  assert.match(acknowledge, /on conflict \(inspection_id\) do nothing/)
})

test('a subsequent inspection can trace an area back to the original baseline finding', async () => {
  const migration = await source(migrationPath)
  const getAdminInspection = functionBody(migration, 'create or replace function public.get_admin_inspection(inspection_uuid uuid)')
  assert.match(getAdminInspection, /not inspection\.is_baseline and area\.source_property_area_id is not null/)
  assert.match(getAdminInspection, /baseline_area\.source_property_area_id = area\.source_property_area_id/)
  assert.match(getAdminInspection, /baseline_inspection\.is_baseline and baseline_inspection\.superseded_by is null/)
})

test('cross-client access is denied: baseline policies gate on property access, never a bare authenticated check', async () => {
  const migration = await source(migrationPath)
  assert.doesNotMatch(migration, /for select to authenticated using \(true\)/)
  assert.doesNotMatch(migration, /for insert to authenticated with check \(true\)/)
  // Every customer-facing baseline RPC re-derives property access from the inspection row itself, not from client input.
  for (const rpc of ['get_baseline_condition_status', 'submit_baseline_condition_comment', 'acknowledge_baseline_condition']) {
    const body = functionBody(migration, `create function public.${rpc}(`) || functionBody(migration, `create or replace function public.${rpc}(`)
    assert.match(body, /private\.customer_has_property_access\(/)
  }
})

test('existing inspection functionality (create, publish, list) is extended, not replaced', async () => {
  const migration = await source(migrationPath)
  const createInspection = functionBody(migration, 'create or replace function public.create_inspection(inspection_data jsonb)')
  assert.match(createInspection, /insert into public\.inspection_areas/)
  assert.match(createInspection, /insert into public\.inspection_items/)
  assert.match(createInspection, /perform private\.require_staff\(\);/)
  const publish = functionBody(migration, 'create or replace function public.publish_admin_inspection(inspection_uuid uuid)')
  assert.match(publish, /private\.build_client_inspection_report\(inspection_uuid\)/)
  assert.match(publish, /if not private\.is_admin\(\) then/)
})

test('the Stripe/subscription domain is untouched by this migration and by portal-api.mts baseline routes', async () => {
  const migration = await source(migrationPath)
  // A comment may reference the subscription domain's immutability pattern for
  // design context, but the migration must never create, alter or grant on any
  // Stripe/subscription table or function.
  assert.doesNotMatch(migration, /\b(create|alter|drop) (table|function|policy|trigger).*(stripe|checkout_session|service_agreement_acceptances|service_subscriptions)/i)
  assert.doesNotMatch(migration, /grant[\s\S]{0,80}(service_agreement_acceptances|service_subscriptions)/i)
  const subscriptionMigration = await source(subscriptionMigrationPath)
  const subscriptionApi = await source(subscriptionApiPath)
  const subscriptionShared = await source(subscriptionSharedPath)
  for (const file of [subscriptionMigration, subscriptionApi, subscriptionShared]) {
    assert.doesNotMatch(file, /baseline_condition|is_baseline|baseline_state/)
  }
})

test('portal-api routes reuse the authenticated RLS client, matching the rest of the inspection domain (not the subscription domain\'s service-role pattern)', async () => {
  const portalApi = await source(portalApiPath)
  for (const rpc of ['get_baseline_condition_status', 'submit_baseline_condition_comment', 'acknowledge_baseline_condition', 'get_property_baseline_status', 'respond_to_baseline_condition_comment']) {
    assert.match(portalApi, new RegExp(`authenticated\\.supabase\\.rpc\\('${rpc}'`))
  }
  assert.doesNotMatch(portalApi, /createClient\([^)]*SUPABASE_SERVICE_ROLE_KEY/)
})

test('staff can read and respond to baseline comments for an inspection via dedicated admin routes', async () => {
  const portalApi = await source(portalApiPath)
  assert.match(portalApi, /segments\[1\] === 'inspections' && segments\[2\] && segments\[3\] === 'baseline' && segments\.length === 4\) \{[\s\S]{0,400}baseline_condition_comments/)
  assert.match(portalApi, /segments\[3\] === 'baseline-comments' && segments\[4\] && segments\[5\] === 'respond'/)
})

test('staff can designate an inspection as the Initial Property Condition Report, and the badge is surfaced across admin views', async () => {
  const adminInspections = await source(adminInspectionsRoutePath)
  assert.match(adminInspections, /isBaseline: form\.get\('isBaseline'\) === 'on'/)
  assert.match(adminInspections, /Initial Property Condition Report/)
  const adminInspection = await source(adminInspectionRoutePath)
  assert.match(adminInspection, /inspection\.is_baseline/)
  assert.match(adminInspection, /baselineConditionProductName/)
})

test('customer portal surfaces Action Required, per-property status and the review workflow with the exact required wording', async () => {
  const overview = await source(overviewRoutePath)
  assert.match(overview, /Action required — Review your \{baselineConditionProductName\}/)
  const properties = await source(propertiesRoutePath)
  assert.match(properties, /Initial condition: Acknowledged on/)
  assert.match(properties, /Initial condition: Awaiting your review/)
  const report = await source(inspectionReportRoutePath)
  assert.match(report, /<BaselineReview report={report} \/>/)
  const review = await source(reviewComponentPath)
  assert.match(review, /Review required — Initial Property Condition Report/)
  assert.match(review, /baselineConditionAcknowledgementWording\.confirmation/)
  assert.match(review, /baselineConditionAcknowledgementWording\.scopeCaveat/)
})

test('the config module is the single source of truth for the product name and acknowledgement wording, reused by both server and client', async () => {
  const config = await source(configPath)
  assert.match(config, /export const baselineConditionProductName = 'Initial Property Condition Report'/)
  assert.match(config, /export const baselineConditionAcknowledgementWording = \{/)
  assert.match(config, /confirmation:/)
  assert.match(config, /scopeCaveat:/)
})
