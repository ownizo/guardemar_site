import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { addonServiceCatalogue, optionalServices } from '../src/config/optional-services.ts'
import { addonPaymentDraftSchema, euroMinorUnits, includedVat, shoppingPaymentMessage } from '../src/lib/portal/addons.ts'
import { addonMetadata, assertAddonMetadata, buildAddonCheckout, sendAddonPayment, verifyAddonOpenSession } from '../netlify/functions/_addon-billing.mts'
import { isStripeHostedCheckoutUrl } from '../netlify/functions/_addon-shared.mts'
import { billingEmailEnvelope, deliverAddonBillingEmail } from '../netlify/functions/_addon-email.mts'
import { dispatchAddonOrCore, processAddonStripeEvent, verifyAddonSubscription, stripeObjectMetadata } from '../netlify/functions/_addon-webhook.mts'
import { handleAddonRequest } from '../netlify/functions/addon-api.mts'
const ids = { payment:'50000000-0000-4000-8000-000000000001', request:'40000000-0000-4000-8000-000000000001', client:'10000000-0000-4000-8000-000000000001', property:'20000000-0000-4000-8000-000000000001', sub:'70000000-0000-4000-8000-000000000001', attempt:'80000000-0000-4000-8000-000000000001', admin:'00000000-0000-4000-8000-000000000001' }
test('Stripe Checkout URL validation accepts only Stripe or Guardemar hosted domains',()=>{assert.equal(isStripeHostedCheckoutUrl('https://checkout.stripe.com/c/pay/session'),true);assert.equal(isStripeHostedCheckoutUrl('https://checkout.guardemar.com/c/pay/session'),true);assert.equal(isStripeHostedCheckoutUrl('https://evil.example/c/pay/session'),false);assert.equal(isStripeHostedCheckoutUrl('http://checkout.guardemar.com/c/pay/session'),false)})
function payment(monthly=false,external=false): any { return { id:ids.payment,addon_request_id:external?null:ids.request,client_id:external?null:ids.client,property_id:external?null:ids.property,service_code:external?'external-provider':'pre-arrival-shopping',payment_category:external?'external_provider':'guardemar_service',payment_type:monthly?'monthly':'one_time',amount:9840,amount_net:external?null:8000,amount_tax:external?null:1840,vat_rate:external?null:23,currency:'EUR',amount_semantics:external?'external_final':'vat_included',service_fee_only_confirmed:true,stripe_product_id:'prod_addon',stripe_tax_rate_id:external?null:'txr_addon_inclusive',stripe_customer_id:external?null:'cus_canonical',customer_email:'test@example.invalid',description:'Agreed Guardemar service fee',payment_status:'sent',created_by_admin:ids.admin } }
function fixtures(monthly=false,external=false) {
 const p=payment(monthly,external); const sub: any=monthly?{id:ids.sub,addon_payment_id:p.id,status:'checkout_open',stripe_subscription_id:'sub_addon',stripe_customer_id:'cus_canonical'}:null
 const attempt={id:ids.attempt,addon_payment_id:p.id,status:'open',generation:1,idempotency_key:'persisted-creation-key',stripe_checkout_session_id:'cs_addon'}
 const metadata=addonMetadata(p,sub,attempt.id)
 const stripeSub: any={object:'subscription',id:'sub_addon',livemode:true,metadata,customer:'cus_canonical',status:'active',items:{data:[{quantity:1,price:{id:'price_inline',product:'prod_addon',unit_amount:9840,currency:'eur',tax_behavior:'inclusive',recurring:{interval:'month',interval_count:1}},tax_rates:external?[]:['txr_addon_inclusive']}]},default_tax_rates:[],discounts:[],automatic_tax:{enabled:false}}
 const session: any={id:'cs_addon',object:'checkout.session',livemode:true,metadata,mode:monthly?'subscription':'payment',status:'complete',payment_status:'paid',customer:'cus_canonical',subscription:monthly?'sub_addon':null,payment_intent:monthly?null:'pi_addon',amount_total:9840,currency:'eur',total_details:{amount_tax:external?0:1840},url:'https://checkout.stripe.com/mock',expires_at:Math.floor(Date.now()/1000)+3600}
 const intent={id:'pi_addon',livemode:true,metadata,customer:'cus_canonical',status:'succeeded',currency:'eur',amount:9840,amount_received:9840}
 const invoice: any={id:'in_addon',livemode:true,status:'paid',customer:'cus_canonical',currency:'eur',amount_paid:9840,total:9840,parent:{subscription_details:{subscription:'sub_addon',metadata}},total_taxes:[{amount:external?0:1840}]}
 return {p,sub,attempt,metadata,stripeSub,session,intent,invoice}
}
function dbMock(f:ReturnType<typeof fixtures>) {
 const calls:any[]=[]; const state:any={addon_payments:f.p,addon_subscriptions:f.sub,addon_checkout_attempts:f.attempt,clients:{id:ids.client,stripe_customer_id:'cus_canonical'}}
 const db:any={from(table:string){const steps:any[]=[];calls.push({table,steps});const q:any={};for(const method of ['select','eq','in','not','is','order','limit','neq','or','insert','update'])q[method]=(...args:any[])=>{steps.push([method,...args]);return q};const result=(single:boolean)=>{let value=state[table]??null; const binding=steps.find(s=>s[0]==='eq'&&s[1]==='stripe_subscription_id');if(binding&&value?.stripe_subscription_id!==binding[2])value=null; const update=steps.find(s=>s[0]==='update');if(update&&value)Object.assign(value,update[1]); return {data:single?value:value?[value]:[],error:null}};q.single=q.maybeSingle=async()=>result(true);q.then=(resolve:any,reject:any)=>Promise.resolve(result(false)).then(resolve,reject);return q},rpc:async(name:string,args:any)=>{calls.push({rpc:name,args});if(name==='claim_addon_checkout')return{data:f.attempt,error:null};return{data:true,error:null}}}
 return{db,calls,state}
}
function stripeMock(f:ReturnType<typeof fixtures>,calls:any[]) {return (async(path:string,options?:any)=>{calls.push({path,options});if(path.startsWith('/checkout/sessions/'))return f.session;if(path.startsWith('/payment_intents/'))return f.intent;if(path.startsWith('/subscriptions/'))return f.stripeSub;if(path.startsWith('/invoices/'))return f.invoice;if(path.startsWith('/products/'))return{id:'prod_addon',livemode:true,active:true,metadata:{payment_domain:'addon',service_code:f.p.service_code}};if(path.startsWith('/tax_rates/'))return{livemode:true,active:true,inclusive:true,percentage:23,country:'PT',tax_type:'vat'};if(path.startsWith('/customers/'))return{id:'cus_canonical',livemode:true,tax_exempt:'none'};if(path==='/checkout/sessions')return f.session;throw Error(`Unexpected Stripe operation ${path}`)}) as any}
function event(type:string,f:ReturnType<typeof fixtures>,object?:any) {return{id:`evt_${type}`,type,livemode:true,created:1789500000,data:{object:object??(type.startsWith('invoice.')?f.invoice:type.startsWith('customer.subscription.')?f.stripeSub:f.session)}}}
const auth=(db:any,role='admin')=>({database:db,user:{id:ids.admin} as any,role:role as any})
test('gross EUR parsing and included 23% VAT use integer minor units',()=>{
 for(const [eur,gross,net,vat]of [['100.00',10000,8130,1870],['98.40',9840,8000,1840],['18.45',1845,1500,345],['30.75',3075,2500,575],['0.01',1,1,0]]as const){assert.equal(euroMinorUnits(eur),gross);assert.deepEqual(includedVat(gross),{gross,net,vat,rate:23})}
 for(const invalid of ['0','-1','1.234','1e2','NaN','0001','1000000'])assert.throws(()=>euroMinorUnits(invalid))
 for(const invalid of [0,1.5,NaN,100000000])assert.throws(()=>includedVat(invalid))
})
test('one canonical catalogue has 13 admin categories and 12 customer services',()=>{assert.equal(addonServiceCatalogue.length,13);assert.equal(optionalServices.length,12);assert.ok(!optionalServices.some(s=>s.id==='external-provider'));assert.equal(addonServiceCatalogue.at(-1)?.adminOnly,true);assert.equal(addonServiceCatalogue.at(-1)?.name,'External Provider Service')})
test('Pre-Arrival Shopping Checkout contains service fee only and exactly 9840 cents',()=>{
 const f=fixtures();const body=buildAddonCheckout({...f.p,shoppingItems:[{product:'Groceries',cost:99999}],shoppingExpenditure:99999},null,f.attempt)
 assert.equal(body.get('mode'),'payment');assert.equal(body.get('line_items[0][price_data][unit_amount]'),'9840');assert.equal(body.get('line_items[0][price_data][tax_behavior]'),'inclusive');assert.equal(body.get('line_items[0][tax_rates][0]'),'txr_addon_inclusive');assert.equal(body.get('automatic_tax[enabled]'),'false');assert.equal(body.get('adaptive_pricing[enabled]'),'false');assert.equal(body.get('payment_intent_data[description]'),f.p.description);assert.equal(body.get('customer'),'cus_canonical');assert.equal(body.get('metadata[payment_domain]'),'addon');assert.equal(body.get('payment_intent_data[metadata][addon_request_id]'),ids.request)
 assert.ok(!body.toString().includes('99999'));assert.equal(body.get('line_items[1][quantity]'),null);assert.ok(body.get('custom_text[submit][message]')?.includes('client account'));assert.throws(()=>buildAddonCheckout({...f.p,service_fee_only_confirmed:false},null,f.attempt));assert.throws(()=>buildAddonCheckout({...f.p,amount_semantics:'unapproved'},null,f.attempt))
})
test('monthly inline pricing accepts any canonical service at exact admin monthly gross',()=>{
 for(const service of optionalServices){const f=fixtures(true);const body=buildAddonCheckout({...f.p,service_code:service.id,amount:1845},f.sub,f.attempt);assert.equal(body.get('mode'),'subscription');assert.equal(body.get('line_items[0][price_data][recurring][interval]'),'month');assert.equal(body.get('line_items[0][price_data][unit_amount]'),'1845');assert.equal(body.get('subscription_data[metadata][addon_subscription_id]'),ids.sub);assert.equal(body.get('payment_intent_data[metadata][addon_payment_id]'),null)}
})
test('External Provider supports email-only exact final charge without assumed VAT',()=>{
 for(const monthly of [false,true]){const f=fixtures(monthly,true);const body=buildAddonCheckout(f.p,f.sub,f.attempt);assert.equal(body.get('customer_email'),'test@example.invalid');assert.equal(body.get('customer'),null);assert.equal(body.get('line_items[0][tax_rates][0]'),null);assert.equal(body.get('metadata[payment_category]'),'external_provider');assert.equal(body.get('metadata[client_id]'),null);assert.equal(body.get('line_items[0][price_data][unit_amount]'),'9840')}
 const parsed=addonPaymentDraftSchema.parse({serviceCode:'external-provider',email:'TEST@EXAMPLE.INVALID',amountEur:'12.34',description:'Provider',currency:'EUR',idempotencyKey:ids.payment});assert.equal(parsed.monthly,false);assert.equal(parsed.amountEur,1234)
})
test('confirmed server state owns all Stripe linkage; mixed core metadata fails closed',()=>{
 const f=fixtures(true);assertAddonMetadata(f.metadata,f.p,f.sub)
 for(const patch of [{client_id:'other'},{addon_payment_id:'other'},{addon_subscription_id:'other'},{payment_domain:'core'},{guardemar_subscription_id:'core'},{agreement_acceptance_id:'core'}])assert.throws(()=>assertAddonMetadata({...f.metadata,...patch},f.p,f.sub))
 for(const patch of [{unit_amount:10000},{currency:'usd'},{tax_behavior:'exclusive'},{product:'prod_care'},{recurring:{interval:'year',interval_count:1}}]){const bad=structuredClone(f.stripeSub);Object.assign(bad.items.data[0].price,patch);assert.throws(()=>verifyAddonSubscription(bad,f.p,f.sub))}
})
test('only verified paid Checkout plus authoritative PaymentIntent confirms one-time payment',async()=>{
 const f=fixtures();const {db,calls}=dbMock(f);const stripeCalls:any[]=[];const emails:any[]=[]
 await processAddonStripeEvent(db,event('checkout.session.completed',f),{stripe:stripeMock(f,stripeCalls),queueEmail:(async(...args:any[])=>{emails.push(args)}) as any})
 assert.equal(calls.find(c=>c.rpc)?.args.action,'paid');assert.equal(emails[0][2],`addon-confirmed-${ids.payment}`);assert.ok(stripeCalls.every(c=>!c.options?.method));assert.ok(calls.every(c=>c.table!=='service_subscriptions'))
 f.session.payment_status='unpaid';calls.length=0;await processAddonStripeEvent(db,event('checkout.session.completed',f),{stripe:stripeMock(f,[]),queueEmail:async()=>{}});assert.equal(calls.some(c=>c.rpc),false)
})
test('wrong payment amount, tax, customer or non-LIVE evidence never confirms',async()=>{
 for(const target of ['amount_total','customer','livemode']as const){const f=fixtures();f.session[target]=target==='amount_total'?10000:target==='customer'?'cus_other':false;const{db,calls}=dbMock(f);await assert.rejects(processAddonStripeEvent(db,event('checkout.session.completed',f),{stripe:stripeMock(f,[]),queueEmail:async()=>{}}));assert.equal(calls.some(c=>c.rpc),false)}
 const f=fixtures();f.intent.amount_received=0;await assert.rejects(processAddonStripeEvent(dbMock(f).db,event('checkout.session.completed',f),{stripe:stripeMock(f,[]),queueEmail:async()=>{}}))
})
test('monthly Checkout acceptance never marks ACTIVE; verified invoice.paid does',async()=>{
 const f=fixtures(true);const{db,calls}=dbMock(f);const emails:any[]=[];const deps={stripe:stripeMock(f,[]),queueEmail:(async(...args:any[])=>{emails.push(args)})as any}
 await processAddonStripeEvent(db,event('checkout.session.completed',f),deps);assert.equal(calls.some(c=>c.rpc),false);assert.equal(f.sub.status,'checkout_open')
 await processAddonStripeEvent(db,event('invoice.paid',f),deps);assert.equal(calls.find(c=>c.rpc)?.args.action,'invoice_paid');assert.equal(emails[0][2],`addon-activated-${ids.sub}`)
})
test('current Stripe lifecycle controls past due/cancelled and prevents stale activation',async()=>{
 const f=fixtures(true);const{db,calls}=dbMock(f);const deps={stripe:stripeMock(f,[]),queueEmail:async()=>{}}
 for(const [status,action]of [['past_due','past_due'],['canceled','cancelled'],['incomplete_expired','ended']]){f.stripeSub.status=status;calls.length=0;await processAddonStripeEvent(db,event('customer.subscription.updated',f),deps);assert.equal(calls.find(c=>c.rpc)?.args.action,action)}
 calls.length=0;await processAddonStripeEvent(db,event('invoice.paid',f),deps);assert.equal(calls.some(c=>c.rpc),false)
 f.stripeSub.status='active';calls.length=0;await processAddonStripeEvent(db,event('customer.subscription.created',f),deps);assert.equal(calls.some(c=>c.rpc),false)
})
test('Add-on events cannot reach CARE, CARE+ or COMPLETE processing under any lifecycle event',async()=>{
 for(const plan of ['care','care_plus','complete'])for(const type of ['checkout.session.completed','invoice.paid','invoice.payment_failed','customer.subscription.updated','customer.subscription.deleted']){const f=fixtures(true);const object=type.startsWith('invoice.')?f.invoice:type.startsWith('customer.')?f.stripeSub:f.session;object.metadata={...f.metadata,guardemar_subscription_id:`core-${plan}`};let core=0,addon=0;await dispatchAddonOrCore(dbMock(f).db,event(type,f,object),async()=>{core++},async()=>{addon++});assert.equal(core,0);assert.equal(addon,1)}
 const f=fixtures(true);let core=0,addon=0;await dispatchAddonOrCore(dbMock(f).db,event('invoice.paid',f,{object:'invoice',id:'in_addon',subscription:'sub_addon',metadata:{}}),async()=>{core++},async()=>{addon++});assert.equal(core,0);assert.equal(addon,1)
})
test('existing core event dispatch remains intact for all core plans',async()=>{
 for(const plan of ['care','care_plus','complete']){const f=fixtures();let core=0;await dispatchAddonOrCore(dbMock(f).db,event('invoice.paid',f,{object:'invoice',id:'in_core',metadata:{guardemar_subscription_id:`core-${plan}`},subscription:null}),async()=>{core++},async()=>{throw Error('Core routed to add-on')});assert.equal(core,1)}
 const source=readFileSync('netlify/functions/_addon-webhook.mts','utf8');assert.ok(!source.includes("from('service_subscriptions')"));assert.ok(!source.includes('/refunds'))
})
test('LIVE approval gate, paid payments and ever-active subscriptions prevent all Stripe creation',async()=>{
 for(const monthly of [false,true]){const f=fixtures(monthly);const{db}=dbMock(f);const stripeCalls:any[]=[];const deps={stripe:stripeMock(f,stripeCalls),configuration:()=>({livePaymentsEnabled:true,externalProviderEnabled:false}),queueEmail:async()=>{},deliverEmail:async()=>true};if(monthly)f.sub.activated_at='2026-09-15';else f.p.payment_status='paid';await assert.rejects(sendAddonPayment(auth(db),f.p.id,'send',ids.payment,deps));assert.equal(stripeCalls.length,0)}
 const f=fixtures();const{db,calls}=dbMock(f);await assert.rejects(sendAddonPayment(auth(db),f.p.id,'send',ids.payment,{stripe:stripeMock(f,[]),configuration:()=>({livePaymentsEnabled:false,externalProviderEnabled:false}),queueEmail:async()=>{},deliverEmail:async()=>true}));assert.equal(calls.length,0)
})
test('resend reuses unpaid open Checkout and email retry uses a stable action key',async()=>{
 const f=fixtures();f.session.status='open';f.session.payment_status='unpaid';f.session.payment_intent=null;const{db}=dbMock(f);const stripeCalls:any[]=[];const emails:any[]=[];const deps={stripe:stripeMock(f,stripeCalls),configuration:()=>({livePaymentsEnabled:true,externalProviderEnabled:false}),queueEmail:(async(...args:any[])=>{emails.push(args)})as any,deliverEmail:async()=>true}
 await sendAddonPayment(auth(db),f.p.id,'resend',ids.payment,deps);await sendAddonPayment(auth(db),f.p.id,'resend',ids.payment,deps);assert.ok(stripeCalls.every(c=>!c.options?.method));assert.equal(emails[0][2],emails[1][2]);await assert.rejects(sendAddonPayment(auth(db),f.p.id,'replace',ids.payment,deps))
})
test('expired replacement refuses paid/processing Intent and completed subscription Checkout',async()=>{
 for(const status of ['processing','succeeded']){const f=fixtures();f.session.status='expired';f.session.payment_status='unpaid';f.intent.status=status;const{db}=dbMock(f);const calls:any[]=[];await assert.rejects(sendAddonPayment(auth(db),f.p.id,'replace',ids.payment,{stripe:stripeMock(f,calls),configuration:()=>({livePaymentsEnabled:true,externalProviderEnabled:false}),queueEmail:async()=>{},deliverEmail:async()=>true}));assert.ok(calls.every(c=>!c.options?.method))}
})
test('email copy distinguishes one-time, monthly, external and shopping client account',()=>{
 for(const monthly of [false,true]){const f=fixtures(monthly);const envelope=billingEmailEnvelope(f.p,'link','https://checkout.stripe.com/mock');assert.ok(envelope.text.includes('€98.40'));assert.ok(envelope.text.includes('VAT included (23%)'));assert.ok(envelope.text.includes(shoppingPaymentMessage));assert.ok(envelope.text.includes('non-refundable'));assert.ok(envelope.text.includes(monthly?'recurring monthly payment':'One-time'));assert.ok(envelope.text.includes(monthly?'Set up monthly payment':'Proceed to secure payment'));assert.ok(!envelope.text.includes(ids.payment))}
 const f=fixtures(false,true);assert.ok(!billingEmailEnvelope(f.p,'link','https://checkout.stripe.com/mock').text.includes('23%'));assert.throws(()=>billingEmailEnvelope(f.p,'link','https://evil.example/'))
})
test('durable email sent marker prevents duplicate webhook confirmation emails',async()=>{
 const f=fixtures();const{db,state}=dbMock(f);state.addon_email_deliveries={email_key:'stable',sent_at:null,claimed_at:null,first_attempt_at:null,envelope:billingEmailEnvelope(f.p,'confirmed')};const original=db.rpc;db.rpc=async(name:string,args:any)=>{if(name==='record_addon_email_sent')state.addon_email_deliveries.sent_at=new Date().toISOString();return original(name,args)}
 ;(globalThis as any).Netlify={env:{get:(name:string)=>name==='RESEND_API_KEY'?'mock-not-a-secret':''}}
 let sent=0;const sender=async(_:any,options:any)=>{assert.equal(options.idempotencyKey,'stable');sent++;return{error:null,data:{id:'mock_email'}}};await deliverAddonBillingEmail(db,'stable',sender);await deliverAddonBillingEmail(db,'stable',sender);assert.equal(sent,1)
})
test('Admin must confirm stored payment; customer cannot control amount/frequency in send',async()=>{
 const f=fixtures();const{db}=dbMock(f);let sends=0;const deps={authenticate:async()=>auth(db),sendEmail:async()=>{},sendPayment:(async()=>{sends++;return{sent:true,emailDeliveryPending:false,reused:false}})as any}
 for(const body of [{},{confirmed:false,actionKey:ids.payment},{confirmed:true,actionKey:ids.payment,amount:1},{confirmed:true,actionKey:ids.payment,monthly:true}]){const res=await handleAddonRequest(new Request(`https://guardemar.com/api/addons/admin/payments/${f.p.id}/send`,{method:'POST',body:JSON.stringify(body)}),deps);assert.equal(res.status,400)}assert.equal(sends,0)
 const res=await handleAddonRequest(new Request(`https://guardemar.com/api/addons/admin/payments/${f.p.id}/send`,{method:'POST',body:JSON.stringify({confirmed:true,actionKey:ids.payment})}),deps);assert.equal(res.status,200);assert.equal(sends,1)
 const denied=await handleAddonRequest(new Request(`https://guardemar.com/api/addons/admin/payments/${f.p.id}/send`,{method:'POST',body:'{}'}),{...deps,authenticate:async()=>auth(db,'customer')});assert.equal(denied.status,403)
})
test('customer payment link denies another client or email-only access before Stripe',async()=>{
 for(const external of [false,true]){const f=fixtures(false,external);const{db}=dbMock(f);const response=await handleAddonRequest(new Request(`https://guardemar.com/api/addons/payments/${f.p.id}/link`),{authenticate:async()=>auth(db,'customer'),sendEmail:async()=>{}});assert.equal(response.status,404)}
})
test('Admin confirmation UX has unchecked monthly default, LIVE state, explicit VAT label and no return activation',()=>{
 const ui=readFileSync('src/components/portal/addon-payment-form.tsx','utf8');assert.ok(ui.includes('useState(false)'));assert.ok(ui.includes('Monthly recurring payment'));assert.ok(ui.includes('FINAL AMOUNT (VAT INCLUDED)'));assert.ok(ui.includes('Review payment'));assert.ok(ui.includes('SEND SUBSCRIPTION LINK'));assert.ok(ui.includes('confirmed: true'));assert.ok(ui.indexOf('Optional Service Request reference') < ui.indexOf('>Service<'));assert.ok(ui.includes('Review it and set it to Under review'));assert.ok(ui.includes('Payment processed'));assert.ok(ui.includes('Secure Stripe Add-on payment links are active.'));assert.ok(!ui.includes('Controlled LIVE tests await approval'));const route=readFileSync('src/routes/portal.add-on-payment-return.tsx','utf8');assert.ok(!route.includes('rpc('));assert.ok(!route.includes('payment_status:'));assert.ok(!ui.includes('Refund'))
})
test('Admin payment records include request reference and webhook-paid request state remains separate from completion',()=>{
 const api=readFileSync('netlify/functions/addon-api.mts','utf8');assert.ok(api.includes('addon_requests(request_reference,status)'))
 const migration=readFileSync('supabase/migrations/20260915210341_addon_payment_and_monthly_billing.sql','utf8');assert.match(migration,/action in \('paid','invoice_paid'\)[\s\S]*status='paid'[\s\S]*status='payment_pending'/);assert.ok(!migration.includes("set status='completed' where id=payment.addon_request_id"))
})
test('Checkout creation reuses canonical Customer and persisted idempotency without Product/Price POSTs',async()=>{
 const f=fixtures();f.p.payment_status='draft';f.attempt.status='prepared';f.attempt.stripe_checkout_session_id=null as any;f.session.status='open';f.session.payment_status='unpaid';f.session.payment_intent=null
 const{db}=dbMock(f);const original=db.rpc;db.rpc=async(name:string,args:any)=>{const result=await original(name,args);if(name==='record_addon_checkout'){f.attempt.status='open';f.attempt.stripe_checkout_session_id=args.session_id}return result}
 const calls:any[]=[];const deps={stripe:stripeMock(f,calls),configuration:()=>({livePaymentsEnabled:true,externalProviderEnabled:false}),queueEmail:async()=>{},deliverEmail:async()=>true}
 await sendAddonPayment(auth(db),f.p.id,'send',ids.payment,deps);await sendAddonPayment(auth(db),f.p.id,'send',ids.payment,deps)
 const creates=calls.filter(c=>c.options?.method==='POST');assert.equal(creates.length,1);assert.equal(creates[0].path,'/checkout/sessions');assert.equal(creates[0].options.idempotencyKey,'persisted-creation-key');assert.equal(creates[0].options.body.get('customer'),'cus_canonical');assert.equal(creates[0].options.body.get('line_items[0][price_data][unit_amount]'),'9840')
})
test('controlled expired replacement creates one new generation only after safe Stripe reconciliation',async()=>{
 const f=fixtures();f.session.status='expired';f.session.payment_status='unpaid';f.intent.status='canceled';f.intent.amount_received=0
 const replacement={...f.attempt,id:'80000000-0000-4000-8000-000000000002',generation:2,idempotency_key:'replacement-key',status:'prepared',stripe_checkout_session_id:null}
 const{db,calls}=dbMock(f);db.rpc=async(name:string,args:any)=>{calls.push({rpc:name,args});return{data:name==='claim_addon_checkout'?replacement:true,error:null}}
 const stripeCalls:any[]=[];const get=stripeMock(f,stripeCalls);const stripe:any=async(path:string,options:any)=>{if(path==='/checkout/sessions'){stripeCalls.push({path,options});return{...f.session,id:'cs_new',status:'open',payment_intent:null,metadata:addonMetadata(f.p,null,replacement.id)}}return get(path,options)}
 await sendAddonPayment(auth(db),f.p.id,'replace',ids.payment,{stripe,configuration:()=>({livePaymentsEnabled:true,externalProviderEnabled:false}),queueEmail:async()=>{},deliverEmail:async()=>true})
 assert.equal(calls.filter(c=>c.rpc==='expire_addon_checkout').length,1);assert.equal(calls.find(c=>c.rpc==='claim_addon_checkout').args.replace_attempt,ids.attempt);assert.equal(stripeCalls.filter(c=>c.options?.method==='POST').length,1);assert.equal(stripeCalls.find(c=>c.options?.method==='POST').options.idempotencyKey,'replacement-key')
})
test('External Provider activation flag blocks all Stripe reads and writes',async()=>{
 const f=fixtures(false,true);const{db}=dbMock(f);const calls:any[]=[];await assert.rejects(sendAddonPayment(auth(db),f.p.id,'send',ids.payment,{stripe:stripeMock(f,calls),configuration:()=>({livePaymentsEnabled:true,externalProviderEnabled:false}),queueEmail:async()=>{},deliverEmail:async()=>true}));assert.equal(calls.length,0)
})
test('resend verifies exact Stripe Checkout gross, currency, customer and attempt',()=>{
 const f=fixtures();f.session.status='open';f.session.payment_status='unpaid';f.session.payment_intent=null;verifyAddonOpenSession(f.session,f.p,null,f.attempt)
 for(const patch of [{amount_total:10000},{currency:'usd'},{customer:'cus_other'},{mode:'subscription'},{id:'cs_other'},{metadata:{...f.metadata,addon_checkout_attempt_id:'another'}},{total_details:{amount_tax:0}}])assert.throws(()=>verifyAddonOpenSession({...f.session,...patch},f.p,null,f.attempt))
})
test('first Add-on invoice without nested metadata is classified before local Stripe ID binding',async()=>{
 const f=fixtures(true);f.sub.stripe_subscription_id=null;const{db,calls}=dbMock(f);const stripeCalls:any[]=[];const stripe=stripeMock(f,stripeCalls);let core=0
 await dispatchAddonOrCore(db,event('invoice.paid',f,{id:'in_addon',object:'invoice',metadata:{},subscription:'sub_addon'}),async()=>{core++},async(database,evt)=>processAddonStripeEvent(database,evt,{stripe,queueEmail:async()=>{}}),stripe)
 assert.equal(core,0);assert.equal(calls.find(c=>c.rpc)?.args.action,'invoice_paid');assert.ok(calls.every(c=>c.table!=='service_subscriptions'));assert.ok(stripeCalls.every(c=>!c.options?.method))
})
test('monthly Customer credits, debit balances and discounts cannot alter the agreed gross charge',async()=>{
 for(const patch of [{balance:-100},{balance:100},{invoice_credit_balance:{eur:-100}},{discount:{id:'di_existing'}},{discounts:['di_existing']},{tax_exempt:'exempt'}]){
  const f=fixtures(true);f.p.payment_status='draft';f.attempt.status='prepared';f.attempt.stripe_checkout_session_id=null as any;const{db}=dbMock(f);const calls:any[]=[];const get=stripeMock(f,calls)
  const stripe:any=async(path:string,options:any)=>path.startsWith('/customers/')?{id:'cus_canonical',livemode:true,tax_exempt:'none',balance:0,...patch}:get(path,options)
  await assert.rejects(sendAddonPayment(auth(db),f.p.id,'send',ids.payment,{stripe,configuration:()=>({livePaymentsEnabled:true,externalProviderEnabled:false}),queueEmail:async()=>{},deliverEmail:async()=>true}));assert.equal(calls.some(c=>c.options?.method==='POST'),false)
 }
})
