-- Unsent cancelled drafts must remain private; launched subscriptions stay visible.
drop policy addon_payments_read on public.addon_payments;
create policy addon_payments_read on public.addon_payments for select to authenticated using(private.is_staff() or (
 payment_status<>'draft' and (payment_status<>'cancelled' or stripe_checkout_session_id is not null)
 and exists(select 1 from public.client_users cu where cu.client_id=addon_payments.client_id and cu.user_id=(select auth.uid()))
 and (property_id is null or exists(select 1 from public.property_users pu where pu.property_id=addon_payments.property_id and pu.user_id=(select auth.uid())))
));
drop policy addon_subscriptions_read on public.addon_subscriptions;
create policy addon_subscriptions_read on public.addon_subscriptions for select to authenticated using(private.is_staff() or (
 status<>'draft' and (stripe_checkout_session_id is not null or activated_at is not null)
 and exists(select 1 from public.client_users cu where cu.client_id=addon_subscriptions.client_id and cu.user_id=(select auth.uid()))
 and (property_id is null or exists(select 1 from public.property_users pu where pu.property_id=addon_subscriptions.property_id and pu.user_id=(select auth.uid())))
));
