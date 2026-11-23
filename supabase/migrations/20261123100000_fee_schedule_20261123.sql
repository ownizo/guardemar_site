-- Fee Schedule applicable from 23 November 2026 (HNW repositioning).
-- New Plan Fees (net, VAT 23% exclusive): CARE €81.30, CARE+ €146.34, COMPLETE €243.90 per month
-- (€100 / €180 / €300 per month including VAT). Visit frequency is stated per Plan.
-- The 5 September 2026 schedule row is retained unchanged: it governs Service Orders accepted before this date.

insert into public.fee_schedule_versions (effective_date, title, document_text, sha256)
values (date '2026-11-23', 'GUARDEMAR — Fee Schedule', $guardemar_fees_20261123$# GUARDEMAR — Fee Schedule

**Applicable from 23 November 2026** to Service Orders accepted on or after that date. It supersedes the Fee Schedule applicable from 5 September 2026, which continues to govern Service Orders accepted before 23 November 2026.

This schedule is referred to in the Service Order. It does not form part of the General Terms and Conditions of Service and may be revised in accordance with Clause 15.17 of those Conditions.

---

## Plan Fees

| Plan | Visit frequency | Monthly Billing | Annual Billing (10% discount) | Annual saving |
|---|---|---|---|---|
| **CARE** | One documented visit per month | €81.30 / month | €878.04 / year | €97.56 |
| **CARE+** | Two documented visits per month | €146.34 / month | €1,580.47 / year | €175.61 |
| **COMPLETE** | A minimum of one documented visit per week | €243.90 / month | €2,634.12 / year | €292.68 |

All amounts are exclusive of VAT, which is added at the rate required by law.

Annual Billing is calculated by applying a 10% discount to the total of twelve monthly Plan Fees, in accordance with Clause 15.4 of the Conditions. The discount is granted as consideration for the commitment to the full twelve-month Term; on early termination the Services received are valued at the standard monthly Plan Fee, as set out in Clause 15.19-A.

A documented visit is an on-site inspection of the Property by GUARDEMAR, followed by a dated photographic report. The Plan is confirmed in the Service Order following the first property assessment. Estates, large properties and properties with household staff or complex installations may instead receive a GUARDEMAR PRIVATE ESTATE proposal, with a Fee agreed in writing in the Service Order.

For reference, with VAT at 23% the Plan Fees correspond to €100.00 (CARE), €180.00 (CARE+) and €300.00 (COMPLETE) per month under Monthly Billing, and €1,079.99 (CARE), €1,943.98 (CARE+) and €3,239.97 (COMPLETE) per year under Annual Billing.

---

## Administrative and default charges

| Charge | Amount | Clause |
|---|---|---|
| Failed collection cycle | €25 per cycle | 15.12(c) |
| Bank, card-scheme or chargeback charges | At cost | 15.12(d) |
| Reactivation after suspension | €75 | 15.12(e) |
| Administrative charge on annual refund recalculation | €50 | 15.19-A |
| Minimum recovery amount (non-consumer clients) | €40 | 15.12-B(b) |
| Urgent protective measures, authorised limit | Up to €250 per event, reimbursed at cost | 12.3 |

Default interest: 4% per annum for consumers (Portaria n.º 291/2003); the commercial supplementary rate in force for non-consumer clients.

Early termination compensation: 50% of the Plan Fees remaining for the Term (Clause 15.20), or, under Annual Billing, the recalculation in Clause 15.19-A.

---

## On-demand services

Additional visits, emergency call-outs, contractor access, delivery attendance, arrival preparation and other on-demand services are quoted separately and invoiced in accordance with Clause 15.14.

Works and repairs are contracted directly between the Client and the Third-Party Contractor, approved and provisioned in advance under Clause 11, and are not included in any Plan Fee. VAT on works at holiday homes, secondary residences and properties used for tourist accommodation applies at the standard rate.

---

*GUARDEMAR is a commercial brand of Ownizo Unipessoal Lda · NIPC 517169029*
$guardemar_fees_20261123$, '7b73b3440d41d2e82a17b0c547f07b1427d26e65ba4180a36f2942dc43d69c89');

do $guardemar_fee_validation_20261123$
begin
  if not exists (
    select 1 from public.fee_schedule_versions
    where effective_date = date '2026-11-23'
      and sha256 = encode(extensions.digest(convert_to(document_text, 'UTF8'), 'sha256'), 'hex')
      and sha256 = '7b73b3440d41d2e82a17b0c547f07b1427d26e65ba4180a36f2942dc43d69c89'
  ) then raise exception 'Guardemar Fee Schedule 2026-11-23 hash validation failed'; end if;
end;
$guardemar_fee_validation_20261123$;

create or replace function public.create_service_agreement_acceptance(
  actor_user_id uuid,
  acceptance_idempotency uuid,
  property_uuid uuid,
  requested_plan public.guardemar_plan_code,
  requested_billing public.guardemar_billing_interval,
  approved_stripe_price_id text,
  approved_service_scope jsonb,
  approved_fee_schedule_effective_date date,
  approved_fee_schedule_sha256 text,
  approved_tax_statement text,
  approved_tax_rate_id text,
  approved_tax_percentage numeric,
  approved_tax_display_name text,
  approved_tax_amount integer,
  approved_gross_amount integer,
  requested_start_date date,
  acknowledgement_evidence jsonb,
  early_start_requested boolean,
  request_user_agent text,
  request_ip inet,
  technical_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  property_record public.properties;
  client_record public.clients;
  terms_record public.legal_terms_versions;
  fee_schedule_record public.fee_schedule_versions;
  subscription_record public.service_subscriptions;
  acceptance_record public.service_agreement_acceptances;
  monthly_amount integer;
  annual_list_amount integer;
  annual_discount_amount integer;
  selected_amount integer;
  service_order jsonb;
  required_acknowledgements text[] := array[
    'serviceOrder', 'mainTerms', 'scope', 'propertyResponsibility', 'accessMeans', 'contractors',
    'insurance', 'baselineCondition', 'conditionsPrecedent', 'contractTerm', 'recurringAuthority',
    'annualDiscount', 'nonPayment', 'earlyTermination', 'liability'
  ];
  acknowledgement_key text;
begin
  if actor_user_id is null then raise exception 'actor user is required' using errcode = '22023'; end if;
  if acceptance_idempotency is null then raise exception 'acceptance idempotency key is required' using errcode = '22023'; end if;
  if approved_stripe_price_id is null or approved_stripe_price_id !~ '^price_' then raise exception 'approved Stripe Price is required' using errcode = '22023'; end if;
  if approved_tax_rate_id is null or approved_tax_rate_id !~ '^txr_' then raise exception 'approved Stripe Tax Rate is required' using errcode = '22023'; end if;
  if approved_tax_percentage is null or approved_tax_percentage < 0 or approved_tax_display_name is null or length(trim(approved_tax_display_name)) = 0 then raise exception 'approved tax configuration is required' using errcode = '22023'; end if;
  if jsonb_typeof(approved_service_scope) <> 'array' or jsonb_array_length(approved_service_scope) = 0 then raise exception 'approved service scope is required' using errcode = '22023'; end if;
  if requested_start_date < current_date then raise exception 'service start date cannot be in the past' using errcode = '22023'; end if;

  select * into subscription_record from public.service_subscriptions
  where acceptance_idempotency_key = acceptance_idempotency and created_by = actor_user_id;
  if found then
    return jsonb_build_object('subscriptionId', subscription_record.id, 'acceptanceId', subscription_record.agreement_acceptance_id);
  end if;

  select * into property_record from public.properties where id = property_uuid and active;
  if not found then raise exception 'property not found' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.property_users
    where property_id = property_uuid and user_id = actor_user_id
  ) then raise exception 'property access denied' using errcode = '42501'; end if;

  select * into client_record from public.clients where id = property_record.client_id and active;
  if not found then raise exception 'client not found' using errcode = 'P0002'; end if;

  select * into terms_record from public.legal_terms_versions
  where version = '2.5' and effective_date = date '2026-09-05';
  if not found then raise exception 'General Terms Version 2.5 is not configured' using errcode = '55000'; end if;
  if terms_record.sha256 <> '7bdf2ed911c1c6f312e20a985c8e40ddc09af5b7e401925a9c3ffd49d6bf76fd'
    or terms_record.sha256 <> encode(extensions.digest(convert_to(terms_record.document_text, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'General Terms Version 2.5 hash validation failed' using errcode = '55000';
  end if;

  select * into fee_schedule_record from public.fee_schedule_versions
  where effective_date = approved_fee_schedule_effective_date
    and sha256 = approved_fee_schedule_sha256;
  if not found or fee_schedule_record.effective_date <> date '2026-11-23'
    or fee_schedule_record.sha256 <> '7b73b3440d41d2e82a17b0c547f07b1427d26e65ba4180a36f2942dc43d69c89'
    or fee_schedule_record.sha256 <> encode(extensions.digest(convert_to(fee_schedule_record.document_text, 'UTF8'), 'sha256'), 'hex') then
    raise exception 'Guardemar Fee Schedule hash validation failed' using errcode = '55000';
  end if;
  if approved_tax_statement is null or position(E'\n' || approved_tax_statement || E'\n' in fee_schedule_record.document_text) = 0 then
    raise exception 'approved tax statement is not present in the canonical Fee Schedule' using errcode = '22023';
  end if;
  if jsonb_typeof(acknowledgement_evidence -> 'contractClauses') <> 'object' then
    raise exception 'canonical contract clauses are missing' using errcode = '22023';
  end if;
  foreach acknowledgement_key in array array['1.6', '5.1', '5.2', '5.3', '15.3', '15.4', '15.5', '15.6', '15.7'] loop
    if coalesce(acknowledgement_evidence -> 'contractClauses' ->> acknowledgement_key, '') = ''
      or position(acknowledgement_evidence -> 'contractClauses' ->> acknowledgement_key in terms_record.document_text) = 0 then
      raise exception 'canonical contract clause is invalid: %', acknowledgement_key using errcode = '22023';
    end if;
  end loop;

  foreach acknowledgement_key in array required_acknowledgements loop
    if coalesce((acknowledgement_evidence ->> acknowledgement_key)::boolean, false) is not true then
      raise exception 'required acknowledgement missing: %', acknowledgement_key using errcode = '22023';
    end if;
  end loop;
  if coalesce((acknowledgement_evidence ->> 'isConsumer')::boolean, false)
    and requested_start_date <= current_date + 14
    and early_start_requested is not true then
    raise exception 'consumer early-start acknowledgement is required for the requested start date' using errcode = '22023';
  end if;

  case requested_plan
    when 'care' then monthly_amount := 8130;
    when 'care_plus' then monthly_amount := 14634;
    when 'complete' then monthly_amount := 24390;
  end case;
  annual_list_amount := monthly_amount * 12;
  annual_discount_amount := round(annual_list_amount / 10.0)::integer;
  selected_amount := case when requested_billing = 'month' then monthly_amount else annual_list_amount - annual_discount_amount end;
  if approved_tax_amount <> round(selected_amount * approved_tax_percentage / 100.0)::integer
    or approved_gross_amount <> selected_amount + approved_tax_amount then
    raise exception 'approved tax configuration does not match the selected Fee' using errcode = '22023';
  end if;
  if jsonb_typeof(acknowledgement_evidence -> 'annexC') <> 'array'
    or jsonb_array_length(acknowledgement_evidence -> 'annexC') <> 13 then
    raise exception 'canonical Annex C evidence is incomplete' using errcode = '22023';
  end if;

  insert into public.service_subscriptions (
    client_id, property_id, plan_code, billing_interval, currency,
    monthly_net_amount, annual_list_net_amount, annual_discount_percent,
    annual_discount_net_amount, selected_net_amount, tax_percentage, tax_display_name,
    tax_amount, gross_amount, tax_configuration, stripe_tax_rate_id, contract_start_date,
    contract_end_date, renews_at, local_status, payment_status, created_by,
    checkout_idempotency_key, acceptance_idempotency_key, stripe_price_id
  ) values (
    client_record.id, property_record.id, requested_plan, requested_billing, 'EUR',
    monthly_amount, annual_list_amount, 10.00, annual_discount_amount, selected_amount,
    approved_tax_percentage, approved_tax_display_name, approved_tax_amount, approved_gross_amount,
    'stripe_tax_rate', approved_tax_rate_id,
    requested_start_date, (requested_start_date + interval '1 year')::date, (requested_start_date + interval '1 year')::date,
    'accepted', 'not_started', actor_user_id, extensions.gen_random_uuid()::text, acceptance_idempotency, approved_stripe_price_id
  ) returning * into subscription_record;

  service_order := jsonb_build_object(
    'supplier', jsonb_build_object('tradingName', 'GUARDEMAR', 'legalName', 'Ownizo Unipessoal Lda', 'taxId', '517169029'),
    'client', jsonb_build_object('id', client_record.id, 'name', trim(client_record.first_name || ' ' || client_record.last_name), 'email', client_record.email, 'billingAddress', client_record.billing_address, 'country', client_record.country),
    'property', jsonb_build_object('id', property_record.id, 'name', property_record.display_name, 'address', concat_ws(', ', property_record.address_line_1, property_record.address_line_2, property_record.postal_code, property_record.locality, property_record.municipality, property_record.country)),
    'planCode', requested_plan, 'billingInterval', requested_billing, 'currency', 'EUR',
    'serviceFrequency', case requested_plan when 'care' then 'One documented visit per month' when 'care_plus' then 'Two documented visits per month' else 'A minimum of one documented visit per week' end,
    'serviceScope', approved_service_scope,
    'monthlyPlanFeeNet', monthly_amount, 'twelveMonthEquivalentNet', annual_list_amount,
    'annualDiscountPercent', 10, 'annualDiscountAmountNet', annual_discount_amount,
    'agreedPlanFeeNet', selected_amount,
    'tax', jsonb_build_object('treatment', 'exclusive', 'displayName', approved_tax_display_name, 'percentage', approved_tax_percentage, 'amount', approved_tax_amount, 'statement', approved_tax_statement),
    'amountBeingChargedGross', approved_gross_amount,
    'feeSchedule', jsonb_build_object('effectiveDate', fee_schedule_record.effective_date, 'sha256', fee_schedule_record.sha256),
    'startDate', requested_start_date, 'contractEndDate', (requested_start_date + interval '1 year')::date,
    'contractTerm', acknowledgement_evidence -> 'contractClauses' ->> '5.2',
    'renewalArrangement', acknowledgement_evidence -> 'contractClauses' ->> '5.3',
    'billingWording', case when requested_billing = 'month' then acknowledgement_evidence -> 'contractClauses' ->> '15.3' else acknowledgement_evidence -> 'contractClauses' ->> '15.4' end,
    'paymentAuthority', case when requested_billing = 'month' then acknowledgement_evidence -> 'contractClauses' ->> '15.6' else acknowledgement_evidence -> 'contractClauses' ->> '15.7' end,
    'termsVersion', terms_record.version, 'termsEffectiveDate', terms_record.effective_date, 'termsSha256', terms_record.sha256,
    'contractualAcknowledgements', acknowledgement_evidence,
    'acceptedAt', now()
  );

  insert into public.service_agreement_acceptances (
    subscription_id, user_id, client_id, property_id, terms_version,
    terms_effective_date, terms_sha256, fee_schedule_effective_date, fee_schedule_sha256,
    accepted_at, plan_code, billing_interval, currency, monthly_amount, annual_list_amount,
    annual_discount_percent, annual_discount_amount, selected_amount, stripe_price_id,
    stripe_tax_rate_id, tax_percentage, tax_display_name, tax_amount, gross_amount,
    client_snapshot, property_snapshot,
    service_order_snapshot, acknowledgements, withdrawal_early_start_requested,
    withdrawal_early_start_text, user_agent, request_metadata, ip_address
  ) values (
    subscription_record.id, actor_user_id, client_record.id, property_record.id, terms_record.version,
    terms_record.effective_date, terms_record.sha256, fee_schedule_record.effective_date, fee_schedule_record.sha256,
    now(), requested_plan, requested_billing, 'EUR', monthly_amount, annual_list_amount, 10.00,
    annual_discount_amount, selected_amount, approved_stripe_price_id, approved_tax_rate_id,
    approved_tax_percentage, approved_tax_display_name, approved_tax_amount, approved_gross_amount,
    to_jsonb(client_record) - 'internal_notes' - 'stripe_customer_id',
    to_jsonb(property_record) - 'access_notes_private' - 'internal_notes' - 'has_alarm',
    service_order, acknowledgement_evidence, early_start_requested,
    case when early_start_requested then acknowledgement_evidence ->> 'withdrawalClause5_4' else null end,
    left(request_user_agent, 1000), coalesce(technical_metadata, '{}'::jsonb), request_ip
  ) returning * into acceptance_record;

  update public.service_subscriptions
  set agreement_acceptance_id = acceptance_record.id, updated_at = now()
  where id = subscription_record.id;

  insert into public.audit_events(actor_user_id, event_type, entity_type, entity_id, metadata)
  values
    (actor_user_id, 'subscription_created', 'service_subscription', subscription_record.id, jsonb_build_object('propertyId', property_record.id, 'planCode', requested_plan, 'billingInterval', requested_billing)),
    (actor_user_id, 'terms_accepted', 'service_subscription', subscription_record.id, jsonb_build_object('acceptanceId', acceptance_record.id, 'termsVersion', terms_record.version, 'termsSha256', terms_record.sha256)),
    (actor_user_id, 'service_order_accepted', 'service_subscription', subscription_record.id, jsonb_build_object('acceptanceId', acceptance_record.id));

  return jsonb_build_object('subscriptionId', subscription_record.id, 'acceptanceId', acceptance_record.id);
end;
$$;

revoke all on function public.create_service_agreement_acceptance(uuid, uuid, uuid, public.guardemar_plan_code, public.guardemar_billing_interval, text, jsonb, date, text, text, text, numeric, text, integer, integer, date, jsonb, boolean, text, inet, jsonb) from public, anon, authenticated;
grant execute on function public.create_service_agreement_acceptance(uuid, uuid, uuid, public.guardemar_plan_code, public.guardemar_billing_interval, text, jsonb, date, text, text, text, numeric, text, integer, integer, date, jsonb, boolean, text, inet, jsonb) to service_role;
