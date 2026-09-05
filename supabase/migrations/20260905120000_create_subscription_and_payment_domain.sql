-- Guardemar subscription and payment domain for Supabase project ablktbpledjceddessyg.
-- Review before applying. Never apply this migration to uqjxjymvhuvtwbqtesbr.

create type public.guardemar_plan_code as enum ('care', 'care_plus', 'complete');
create type public.guardemar_billing_interval as enum ('month', 'year');
create type public.guardemar_subscription_status as enum (
  'pending_acceptance', 'accepted', 'pending_payment', 'active', 'past_due',
  'payment_action_required', 'suspended', 'ended', 'cancelled'
);
create type public.guardemar_payment_status as enum (
  'not_started', 'pending', 'paid', 'failed', 'action_required', 'refunded'
);

alter table public.clients add column stripe_customer_id text;
create unique index clients_stripe_customer_id_key on public.clients (stripe_customer_id)
where stripe_customer_id is not null;

create table public.legal_terms_versions (
  version text primary key,
  effective_date date not null,
  title text not null,
  document_text text not null,
  sha256 text not null unique,
  created_at timestamptz not null default now(),
  constraint legal_terms_versions_sha256_check check (sha256 ~ '^[a-f0-9]{64}$'),
  constraint legal_terms_versions_document_check check (length(document_text) > 0)
);

create table public.fee_schedule_versions (
  effective_date date primary key,
  title text not null,
  document_text text not null,
  sha256 text not null unique,
  created_at timestamptz not null default now(),
  constraint fee_schedule_versions_sha256_check check (sha256 ~ '^[a-f0-9]{64}$'),
  constraint fee_schedule_versions_document_check check (length(document_text) > 0)
);

insert into public.legal_terms_versions (version, effective_date, title, document_text, sha256)
values ('2.5', date '2026-09-05', 'GUARDEMAR — General Terms and Conditions of Service', $guardemar_terms_v25$# GUARDEMAR — General Terms and Conditions of Service

**Private Property Care · Western Algarve**

GUARDEMAR is a commercial brand of **Ownizo Unipessoal Lda**, NIPC 517169029, registered office at Avenida do Atlântico 16, Escritório 5.07, 1990-019 Lisboa, Portugal. Operational address: Varandas de São João, Lote 4, 2º E, Lagos, Portugal. Contact: info@guardemar.com · +351 928 226 570.

**Version 2.5 — in force from 5 September 2026.**

---

## 1. Purpose and scope of these Conditions

1.1. These General Conditions ("**Conditions**") govern the provision by GUARDEMAR of home watch, property inspection, key holding, coordination and related property-care services (the "**Services**") to the client identified in the Service Order (the "**Client**"), in respect of the property identified in the Service Order (the "**Property**").

1.2. These Conditions form an integral part of the contract between the parties (the "**Agreement**") and apply to every plan, subscription, additional visit and on-demand service supplied by GUARDEMAR, whether or not expressly referred to in later correspondence.

1.3. The Agreement is composed of the following documents, which in the event of conflict take precedence in this order:
   a) the signed Service Order or written service proposal accepted by the Client;
   b) the Property Profile and any written special conditions agreed for the Property;
   c) these Conditions;
   d) the descriptions of plans and services published on guardemar.com.

1.4. Content published on guardemar.com, including plan descriptions, indicative prices, checklists and marketing material, is provided for general commercial presentation. It does not constitute a contractual commitment in itself and does not extend the scope of the Services beyond what is set out in the Service Order. No statement, description, illustration or expression used in any commercial, promotional or informal communication — whether on the website, in social media, in correspondence or orally — may be construed as extending the Services, as creating an obligation of result, or as offering surveillance, guarding, alarm response, protection or any other activity reserved to licensed private security undertakings. In the event of any inconsistency between such a communication and these Conditions, these Conditions prevail.

1.5. The website terms of use published at guardemar.com/terms govern use of the website only. They do not govern the Services, which are governed by the Agreement.

1.6. By signing the Service Order, paying the first invoice, or delivering the Access Means to GUARDEMAR, the Client accepts these Conditions in full.

1.7. **Express acknowledgement of key provisions.** Because certain provisions of these Conditions define the scope of the Services and the allocation of risk between the parties, the Client is required, as part of the subscription process and before the Services commence, to confirm expressly and separately the acknowledgements set out in Annex C, which concern the object of the Agreement (Clause 3), the exclusion of responsibility for the Property, its contents and its installations (Clause 4), the delivery of the Access Means within five days (Clause 6), the regime applicable to works and to Third-Party Contractors (Clauses 10 and 11), the insurance obligations of the Client (Clause 13) and the billing arrangement and the consequences of non-payment (Clauses 15.2 to 15.4 and 15.12).

1.8. That confirmation is given by signature of Annex C or by separate electronic acceptance during subscription, which the parties agree has the same effect as signature. It is recorded and retained by GUARDEMAR and forms an integral part of the Agreement. GUARDEMAR may decline to commence, and is under no obligation to commence, the Services until the confirmation has been given.

1.9. **Conditions precedent to commencement.** GUARDEMAR is not obliged to carry out any visit or to perform any part of the Services until all of the following have been satisfied:
   a) acceptance of the Service Order and confirmation of the acknowledgements under Clauses 1.7 and 1.8;
   b) delivery of the complete Access Means in accordance with Clause 6;
   c) delivery of the proof of insurance required by Clause 13;
   d) provision of a valid payment method and receipt of the first payment due under Clause 15.

Until each of these is satisfied, GUARDEMAR bears no obligation and no liability of any kind in relation to the Property, while the Fees accrue and remain payable from the Start Date in accordance with Clause 6.4.

---

## 2. Definitions

**Access Means** — the keys, remote controls, fobs, cards, codes, credentials, authorisations and any other item or information necessary for GUARDEMAR to enter and move safely within the Property, as described in Clause 6.

**Inspection** — a scheduled, visual, non-invasive observation of the visible condition of the Property, carried out within the agreed scope.

**Report** — the digital record of the visible condition of the Property issued by GUARDEMAR following an Inspection.

**Client Area** — the secure online portal made available to the Client at guardemar.com/portal.

**Start Date** — the date on which the subscription to a plan commences, as stated in the Service Order.

**Third-Party Contractor** — any independent professional or company (plumber, electrician, gardener, pool technician, cleaner, glazier, pest controller, painter, builder or other) engaged in connection with the Property.

**Fees** — the amounts payable by the Client under the Agreement.

---

## 3. Object of the Agreement — the Services are observation and reporting only

3.1. **Sole object.** The object of the Agreement is strictly limited to (i) the visual observation of the Property within the agreed scope, and (ii) the production and delivery of a Report describing the visible condition observed at the date and time of the visit. Nothing else is contracted, undertaken or implied.

3.2. **Obligation of means.** GUARDEMAR undertakes to perform the Services with the diligence, care and skill reasonably expected of a competent property-care provider. GUARDEMAR does **not** undertake, and cannot undertake, to achieve any particular result. In particular, GUARDEMAR does not guarantee that the Property will remain free from damage, deterioration, loss, theft, intrusion, water ingress, damp, mould, infestation, mechanical failure or any other adverse event. The Agreement creates an obligation of means (*obrigação de meios*) and not an obligation of result (*obrigação de resultado*).

3.3. **Inspections are visual and non-invasive.** An Inspection consists of visual observation of accessible areas within the agreed scope, at a single moment in time. GUARDEMAR does not dismantle, open, disassemble, test, measure, probe, lift flooring, remove panels or finishes, open walls, ceilings or ducts, access roofs, enter confined spaces, operate or service equipment beyond simple visual verification, or inspect anything that is locked, obstructed, concealed, unsafe or outside the agreed scope.

3.4. **Not a survey or technical certification.** The Services are not, and must not be relied upon as, a building survey, structural assessment, damp survey, electrical inspection or certification, gas inspection or certification, plumbing certification, pool safety certification, energy assessment, pest survey, engineering report, valuation, inventory for insurance purposes, legal advice, tax advice or insurance advice. GUARDEMAR does not hold itself out as qualified to perform regulated technical work and performs no such work.

3.5. **Not a security service.** GUARDEMAR is not a private security company and is not licensed as such under Portuguese law. The Services do not constitute surveillance, guarding, alarm monitoring, alarm response, patrolling or protection of persons or property. GUARDEMAR does not provide continuous presence, 24-hour cover, guaranteed emergency response, or any form of deterrence, prevention or intervention against burglary, vandalism, trespass or criminal activity. Any presence at the Property is limited to the scheduled or agreed visits.

3.6. **Not insurance and not custody.** The Services are not insurance and do not indemnify the Client against any loss. GUARDEMAR does not assume, share or underwrite any risk relating to the Property. GUARDEMAR does not take custody, possession, control or safekeeping of the Property or of anything within or upon it, which at all times remain in the exclusive possession, control, risk and responsibility of the Client.

3.7. **Scope is exhaustive.** Any task, area, system, item or service not expressly listed in the Service Order or Property Profile falls outside the Services. GUARDEMAR has no implied duty to perform, verify, monitor, test, maintain or advise on anything not so listed.

---

## 4. Exclusion of responsibility for the Property, its contents and its installations

4.1. **General principle.** GUARDEMAR observes and reports. It does not own, hold, guard, maintain, repair, service, operate or insure the Property or anything within or upon it. Accordingly, and to the fullest extent permitted by law, GUARDEMAR accepts **no responsibility and no liability whatsoever** for the condition, functioning, performance, deterioration, damage, malfunction, failure, disappearance, theft, loss or destruction of the Property, its contents, its installations, its exterior areas or any goods or property of the Client or of any third party, whether located inside or outside the Property, and whether or not such matters were, could have been, or ought to have been observed during a visit.

4.2. **Contents and movable property.** The exclusion in Clause 4.1 applies in particular, and without limitation, to: furniture; artwork, paintings, prints, sculptures, antiques and collections; jewellery, watches, precious metals and cash; **safes, strongboxes and their contents, which GUARDEMAR never opens, inspects, verifies or holds credentials for**; documents, deeds, passports and identification; electronic and IT equipment, computers, tablets, telephones, televisions, audio and audiovisual equipment, cameras and drones; domestic appliances and white goods; kitchen equipment and utensils; food, drink, wine, wine cellars and their contents, and anything held in refrigerators or freezers; medication; clothing, textiles, linen, curtains, rugs and carpets; books; musical instruments; tools; bicycles, sports and golf equipment; toys; vehicles, motorcycles, boats, jet skis, trailers, caravans and their keys, whether stored inside the Property, in a garage, or on any exterior area.

4.3. **Installations, systems and fixed elements.** The exclusion in Clause 4.1 applies in particular, and without limitation, to: plumbing and pipework of every kind, including pipework concealed within or beneath walls, floors, ceilings, ducts, terraces or the ground; water supply, mains, meters, stopcocks, tanks, cisterns, pressure vessels, pumps, water softeners, filtration and treatment equipment; boilers, water heaters, cylinders and solar thermal systems; drainage, waste pipes, gullies, septic tanks, cesspits and sewage connections; electrical installations of every kind, including wiring, consumer units, breakers, earthing, sockets, switches, lighting, generators, photovoltaic panels, inverters and battery storage; gas installations, bottles, tanks and appliances; air conditioning, heat pumps, heating, underfloor heating, ventilation, extraction, dehumidification, chimneys and fireplaces; lifts and mechanical installations; gates, gate automation, garage doors, shutters, blinds, awnings and pergolas; windows, glazing, doors, locks, hinges and ironmongery; roofs, terraces, gutters, downpipes, waterproofing, insulation and drainage layers; structure, foundations, walls, retaining walls, façades, render, paint, tiling, flooring, joinery, cabinetry, worktops and sanitaryware.

4.4. **Exterior areas.** The exclusion in Clause 4.1 applies in particular, and without limitation, to: gardens, lawns, plants, shrubs, hedges, trees and palms, including disease, drought, frost, storm damage, pests and death of vegetation; irrigation systems, controllers, valves, timers and pipework; wells, boreholes, water features and ponds; swimming pools, pool structures, liners, tiling, coping, covers, plant rooms, filtration, pumps, heating, dosing and water condition; decking, paving, driveways, steps, walls, fencing, gates and boundaries; outdoor furniture, parasols, barbecues, outdoor kitchens, exterior lighting, statues, planters and ornaments.

4.5. **Technology and connected systems.** The exclusion in Clause 4.1 applies in particular, and without limitation, to: alarm systems and their monitoring; cameras and CCTV; smart-home, access-control and automation systems; routers, internet and telecommunications; sensors, leak detectors, smoke and gas detectors; and any application, platform or service on which such systems depend.

4.6. **Living things.** GUARDEMAR does not care for, feed, water or supervise animals, pets, aquariums, livestock or plants, and accepts no responsibility for them.

4.7. **What is not visible.** GUARDEMAR accepts **no responsibility and no liability** for anything that was not visible, or not reasonably observable within the agreed scope, at the moment of a visit. This includes in particular, and without limitation: pipework in poor condition located within walls, floors, ceilings or underground; leaks, seepage and water ingress that have not yet produced a visible sign; electrical faults, defective wiring, degraded insulation and hidden overheating; structural weakness, movement, corrosion or decay concealed by finishes; damp, rot, mould or infestation developing behind or beneath surfaces; latent defects of construction, materials or previous works; faults that are intermittent, that manifest only under load or use, or that require testing, measurement or specialist equipment to detect; and the contents of anything closed, locked, sealed, packed or stored.

4.8. **Events occurring between or during visits.** GUARDEMAR accepts **no responsibility and no liability** for any damage, loss, deterioration or event occurring at the Property between visits, before the Services commenced, after they end, or at any time when access was unavailable. This exclusion applies equally to any damage or event that is in progress at the very moment of an Inspection but which is not visible or reasonably observable at that moment — including a leak, an electrical fault, an infestation or a structural movement developing out of sight — and to any condition whose visible manifestation appears only after the visit.

4.9. **Absence from a Report.** The fact that a matter is not mentioned or photographed in a Report is not a representation, confirmation or warranty that the matter does not exist, that the area or item is in good condition, or that it was individually examined. Photographs are illustrative and selective.

4.10. **Pre-existing condition and normal deterioration.** GUARDEMAR is not responsible for pre-existing defects, for the age or original construction of the Property, for works previously carried out, or for the gradual and natural deterioration of the Property, its finishes, its contents, its exterior areas or its equipment.

4.11. **Third parties with access.** GUARDEMAR is not responsible for the acts or omissions of any owner, occupant, tenant, guest, family member, cleaner, gardener, contractor, neighbour, condominium employee or other person having access to the Property, nor for any loss, damage or condition attributable to them. GUARDEMAR's records evidence its own attendance only.

4.12. **Client's acknowledgement.** The Client expressly acknowledges that the Fees are the consideration for observation and reporting alone, that they bear no relation to the value of the Property or of its contents, and that the allocation of risk in this Clause 4 is a determining condition without which GUARDEMAR would not enter into the Agreement.

---

## 5. Formation, term, renewal and withdrawal

5.1. The Agreement is formed when the Client accepts the Service Order in writing (including by email or electronic signature) or pays the first invoice.

5.2. **The Agreement has a term of twelve (12) months from the Start Date**, renewing automatically for successive periods of twelve (12) months unless terminated in accordance with Clause 5.3.

5.3. Either party may prevent renewal by giving written notice at least **thirty (30) days** before the end of the current term. Early termination by the Client during a Term does not release the Client from the Fees due up to the date of termination, nor from the early termination compensation provided for in Clause 15.20, save where termination results from a material breach by GUARDEMAR. Where the Client has selected Annual Billing under Clause 15.2(b), the amount refundable on early termination is determined by Clause 15.19-A. The billing frequency selected by the Client — Monthly Billing or Annual Billing — continues for each Renewal Term unless a different billing arrangement is agreed in writing before the relevant renewal date.

5.4. **Right of withdrawal (consumers, distance contracts).** Where the Client is a consumer and the Agreement was concluded at a distance or away from GUARDEMAR's business premises, the Client may withdraw within fourteen (14) calendar days of conclusion, without giving reasons, by unequivocal written notice to info@guardemar.com. If the Client has expressly requested that the Services begin during that period, the Client must pay an amount proportionate to the Services provided up to the moment of withdrawal.

5.5. **Immediate termination by GUARDEMAR.** GUARDEMAR may terminate the Agreement with immediate effect, without compensation and without prejudice to Fees due, if:
   a) any Fee is not paid when due, in accordance with Clauses 15.12 and 15.12-A;
   b) the Client fails to provide or maintain the Access Means as required by Clause 6;
   c) the Client fails to provide or maintain proof of insurance as required by Clause 13;
   d) the Client, an occupant or a third party at the Property behaves abusively, threateningly or unlawfully towards GUARDEMAR personnel;
   e) the Property presents a health, safety, structural, legal or environmental risk that GUARDEMAR considers unacceptable;
   f) the Client requests, instructs or permits anything unlawful, or the Property is used for unlawful purposes;
   g) the Client provided false, incomplete or misleading information about the Property, its condition, its occupancy or its ownership;
   h) the relationship of trust necessary for key holding has, in GUARDEMAR's reasonable judgement, broken down.

5.6. On termination for any reason, GUARDEMAR returns the Access Means in accordance with Clause 7.7 and all outstanding Fees become immediately due.

---

## 6. ACCESS TO THE PROPERTY — ESSENTIAL OBLIGATION OF THE CLIENT

6.1. **Access is the foundation of the Services.** The Client acknowledges and accepts that GUARDEMAR cannot perform any part of the Services without complete, lawful and unobstructed access to the Property. The obligations in this Clause 6 are essential obligations of the Client (*obrigações essenciais*) and their breach entitles GUARDEMAR to the remedies set out below.

6.2. **Delivery within five days.** The Client must deliver to GUARDEMAR a complete and functional set of Access Means **within five (5) calendar days of the Start Date**, at GUARDEMAR's operational address in Lagos or by another method expressly agreed in writing. Access Means include, as applicable to the Property:
   a) keys to every external door, gate, garage, annexe, storeroom, technical room and any internal door that must be opened during an Inspection;
   b) remote controls for gates, garage doors, barriers and shutters, supplied with working batteries;
   c) entrance codes, keypad codes, key-safe codes, smart-lock credentials and any code required by the condominium or urbanisation;
   d) alarm arming and disarming codes and user codes, together with the name and contact details of the alarm or monitoring company and **written authorisation registering GUARDEMAR and its personnel with that company as an authorised keyholder and contact**;
   e) condominium fobs, cards, barrier remotes and any authorisation required from the condominium administration or security post;
   f) access to meter cupboards, pool plant rooms, pool covers, irrigation controllers and utility installations;
   g) Wi-Fi credentials and login details for any smart-home, camera, heating, irrigation, leak-detection or access system with which GUARDEMAR is expected to interact;
   h) any other item, credential, permission or authorisation reasonably necessary for GUARDEMAR to enter and move safely within the Property.

6.3. **Functionality and updating.** The Client warrants that all Access Means delivered are complete, functional, correctly identified and current. The Client must notify GUARDEMAR in writing **before** any change to locks, codes, alarm configuration, gates, access systems or condominium arrangements, and must deliver replacement Access Means before the change takes effect. GUARDEMAR has no obligation to attend the Property, and no liability of any kind, where the Access Means in its possession have been rendered obsolete by an unnotified change.

6.4. **Consequences of failure to deliver within five days.** If the complete Access Means are not received within the period stated in Clause 6.2:
   a) the Services are, as a matter of fact, incapable of performance, and GUARDEMAR is released from all obligations under the Agreement for as long as that situation continues;
   b) the Fees continue to accrue from the Start Date and remain **fully due and payable**, without reduction, suspension, credit, refund or carry-forward of visits not performed;
   c) GUARDEMAR bears **no liability whatsoever** for any loss, damage, deterioration, theft, intrusion, escape of water, damp, mould, infestation, system failure, deterioration of the pool or garden, or any other event occurring at or affecting the Property during that period, whether or not such event would have been detected had access been available;
   d) GUARDEMAR may, at its discretion, suspend the Agreement, and may terminate it with immediate effect at any time after thirty (30) days from the Start Date, with all Fees due to the end of the then-current term remaining payable;
   e) GUARDEMAR may charge its standard call-out rate for any attendance wasted as a result.

6.5. **Access failure on the day of a visit.** Where GUARDEMAR attends the Property but access proves impossible or unsafe — including because locks or codes have been changed, the alarm cannot be disarmed, keys have been retained by a third party, a gate or door is blocked or malfunctioning, an occupant, tenant, guest or contractor refuses or obstructs entry, an animal is loose, works are in progress, or the Property is inaccessible for any other reason not attributable to GUARDEMAR — the visit is deemed to have been performed for the purposes of the Agreement, is fully chargeable, and gives rise to no credit, refund, replacement visit or liability.

6.6. **Client's authority.** The Client warrants that it is the owner of the Property or is duly authorised by the owner, and that it has full authority to grant GUARDEMAR access and to entrust it with key holding, including any consent required from co-owners, spouses, heirs, mortgagees, tenants, the condominium administration or any other interested party. The Client indemnifies GUARDEMAR in full against any claim, complaint, proceeding, fine, loss or cost arising from any deficiency in that authority.

6.7. **Right to refuse entry.** GUARDEMAR may decline to enter or remain at the Property where, in its reasonable judgement, entry would be unsafe, unlawful, contrary to an instruction of an authority, or exposes its personnel to risk. No liability arises from such a decision and the visit is chargeable.

6.8. **Electronic and third-party access devices.** Where access depends on a key safe, smart lock, keypad, application, connected device or third-party access system, the Client bears sole responsibility for its correct installation, maintenance, power supply, connectivity, updating and security. GUARDEMAR is not liable for any failure, malfunction, lockout, compromise or unauthorised use of such a device, nor for any consequence of the Client's disclosure of codes to third parties.

---

## 7. Key holding

7.1. Keys and access devices held by GUARDEMAR are catalogued under a code and are never labelled with the full address of the Property.

7.2. Access Means are stored in a secured location and are used exclusively for purposes authorised by the Client under the Agreement.

7.3. GUARDEMAR may permit access to Third-Party Contractors, delivery agents or other persons only where the Client has authorised it in writing (including by email or WhatsApp message from a contact recorded in the Property Profile). GUARDEMAR records the attendance it arranges.

7.4. GUARDEMAR does not duplicate keys or copy access credentials without the Client's written instruction. Where duplication is instructed, the cost is borne by the Client.

7.5. GUARDEMAR's liability in the event of loss of a key or access device held by it is limited, subject to Clause 18, to the reasonable direct cost of replacing that key or device and, where objectively necessary, the affected lock cylinder. It does not extend to the replacement of an entire locking system, the upgrading of security, or any consequential loss.

7.6. Key holding does not constitute a guarantee against unauthorised entry to the Property and does not place the Property in GUARDEMAR's custody.

7.7. On termination, GUARDEMAR returns the Access Means to the Client or to a person designated in writing by the Client, within thirty (30) days of the effective date of termination. The cost of return, including collection, postage, courier and insurance of the consignment, is borne by the Client, and GUARDEMAR may set that cost off against any amount it holds for the Client or add it to the final invoice. The return of the Access Means is not conditional on the settlement of outstanding Fees. If the Client fails to collect or to arrange collection within ninety (90) days of a written notice to do so, GUARDEMAR may securely destroy the keys and delete the codes, without liability.

---

## 8. Visits, scheduling and Reports

8.1. Visits are scheduled by GUARDEMAR within the frequency stated in the plan (for example, one visit per calendar month). GUARDEMAR does not commit to a specific date, time or interval between visits unless expressly agreed in writing.

8.2. GUARDEMAR may reschedule a visit for operational reasons, adverse weather, road conditions, illness, staff availability or any event beyond its reasonable control. Where a visit cannot be carried out within the relevant period, GUARDEMAR will make reasonable efforts to carry it out in the following period. Visits not carried out do not accumulate indefinitely and are not refundable in cash.

8.3. Reports record the visible condition observed within the agreed scope at the date and time stated. A Report is not a certificate, a survey, a warranty of condition, an inventory, an insurance document or a valuation, and must not be presented as such to any third party, insurer, purchaser, authority or court without GUARDEMAR's prior written agreement.

8.4. **Duty of the Client to act.** Where a Report identifies an issue, an observation or a recommendation, responsibility for deciding upon and instructing the appropriate action lies exclusively with the Client. GUARDEMAR is not liable for any deterioration, escalation, additional damage or loss resulting from the Client's failure to act, delay in acting, or decision not to act.

8.5. The Client must notify GUARDEMAR in writing of any query, disagreement or complaint regarding a Report **within thirty (30) days** of its issue. This does not affect any mandatory legal right of the Client, but late notification may prevent GUARDEMAR from investigating effectively.

8.6. **Baseline Condition Record.** Before or at the first visit, GUARDEMAR prepares a Baseline Condition Record documenting the visible condition of the Property at the commencement of the Services. The Client may comment on it within thirty (30) days of its delivery. In the absence of comment within that period, the Baseline Condition Record is taken, as between the parties, to represent the visible condition of the Property at the Start Date, and any condition it records is treated as pre-existing for the purposes of Clause 4.10. The Baseline Condition Record is limited to what was visible and is subject to Clauses 3 and 4 in their entirety; in particular it is not an inventory of contents and is not a survey.

8.7. **Photographic record.** GUARDEMAR documents its visits photographically according to a standard protocol of reference points, and each Report records the date and time of the visit. The parties agree that GUARDEMAR's photographic record, its Reports and its visit logs constitute the primary evidence of the visible condition of the Property on the dates concerned and of GUARDEMAR's attendance. Clause 4.9 continues to apply: the absence of a photograph of any area or item is not a representation as to its condition.

8.8. **Retention and access.** GUARDEMAR retains Reports, photographs and visit logs for the periods stated in the Privacy Policy and makes them available to the Client through the Client Area. The Client is responsible for downloading and preserving any Report or image it may wish to rely on subsequently, including for insurance purposes. GUARDEMAR is not obliged to retain material beyond its stated retention periods and is not liable for its unavailability thereafter.

---

## 9. Notification of detected issues

9.1. Where GUARDEMAR detects a visible problem at the Property, it will document it and notify the Client **as a matter of urgency** through the channels recorded in the Property Profile, namely email, telephone and the Client Area.

9.2. Notification is deemed validly given once GUARDEMAR has sent it to the email address on file, published it in the Client Area, or attempted contact on the telephone number on file. GUARDEMAR is not responsible for any consequence of a notification that fails to reach the Client, or reaches the Client late, because of an incorrect, obsolete, full, blocked or filtered contact channel, because the Client is travelling or unreachable, or because the Client does not consult the Client Area.

9.3. Following notification, GUARDEMAR awaits the Client's written instructions. GUARDEMAR has no authority and no obligation to act, instruct works, incur expenditure or take any other step in the absence of those instructions and of the approval and provisioning required by Clause 11.

9.4. GUARDEMAR does not provide, and does not undertake to provide, an emergency response service. It has no obligation to attend the Property outside a scheduled visit, whether following an alarm activation, a weather event, a communication from a neighbour, the condominium, the authorities or any third party, or otherwise, unless a specific attendance has been agreed and charged.

9.5. Post-weather checks, where included in the plan, are visual checks carried out when it is safe and operationally possible to do so. They are not a guaranteed same-day response and are subject to road access, weather conditions, official instructions and personnel availability.

---

## 10. Third-Party Contractors

10.1. GUARDEMAR assigns any repair, maintenance or building work exclusively to specialised technicians whom it considers appropriately qualified for the task.

10.1-A. **Documentary verification only.** Where GUARDEMAR proposes a Third-Party Contractor, it requests and files documentary evidence of that contractor's civil liability insurance and, where the activity requires it, of its licence or *alvará*. That verification is documentary and administrative only. It does not constitute an assessment of the contractor's technical competence, solvency or suitability, does not make GUARDEMAR responsible for the accuracy or currency of the documents supplied by the contractor, and gives rise to no warranty of any kind. The Client remains free, and is encouraged, to verify those credentials independently before instructing any contractor.

10.2. Where GUARDEMAR identifies, recommends, contacts, meets, admits or coordinates the attendance of a Third-Party Contractor, it acts **solely as coordinator of access and communication on the Client's behalf**. Any contract for works, repairs, maintenance or supply is concluded **directly between the Client and the Third-Party Contractor**. GUARDEMAR is not a party to it, does not resell those services, and gives no warranty in respect of them.

10.3. **GUARDEMAR accepts no responsibility and no liability for any damage caused to the Property, to its contents, to its installations, to its exterior areas or to any third party by a Third-Party Contractor, whether before, during or after the works or repair.** This exclusion extends to the contractor's technical advice, diagnosis, quotations, pricing, methods, materials, tools, subcontractors, personnel, licensing, insurance, workmanship, delay, non-attendance, abandonment of works, defective execution, theft, and any other act or omission.

10.4. Selecting, recommending or coordinating a contractor does not constitute an endorsement, guarantee or assumption of responsibility for the outcome of the works. The Client remains free to instruct contractors of its own choice and is encouraged to verify credentials, licences and insurance independently.

10.5. Attendance and completion times given by contractors are indicative. GUARDEMAR does not guarantee that a contractor will attend, complete work, or attend within any particular period.

10.6. **Defective works.** Where GUARDEMAR subsequently detects a visible problem resulting from works or a repair, it will document it in a Report, present the matter to the technician concerned and request rectification, or, where appropriate and instructed by the Client, coordinate another technician to carry out the remedial work. **The cost of such rectification is borne by the party legally responsible for it**, and its recovery is a matter between the Client and that party, to be pursued through the applicable legal channels. GUARDEMAR's role is limited to documenting, reporting and coordinating; it does not guarantee rectification, does not assume the contractor's liability, does not bear the cost of remedial works, and does not act as guarantor of any recovery. Remedial works are themselves subject to the approval and provisioning requirements of Clause 11.

---

## 11. Repairs and works — approval and advance provisioning of funds

11.1. GUARDEMAR carries out no repair, maintenance or building work itself. Its involvement is limited to reporting the visible problem, obtaining a quotation from a specialised technician where instructed, coordinating access and reporting on the visible outcome.

11.2. **No works are commissioned or commenced until both of the following have occurred:**
   a) the Client has **approved the quotation in writing** (email or Client Area), including its scope, price and applicable taxes; and
   b) the Client has **transferred the full amount of the approved quotation, inclusive of VAT at the applicable rate and of any other tax or charge, in cleared funds, into the bank account of Ownizo Unipessoal Lda** designated by GUARDEMAR.

11.3. **Without both of these steps being completed, no repair or work will proceed under any circumstances.** GUARDEMAR accepts no responsibility and no liability for any deterioration, escalation of damage, additional cost, loss of use, loss of rental income or any other consequence arising from delay in, or absence of, approval or provisioning by the Client. Partial provisioning does not authorise commencement.

11.4. Funds provisioned are applied exclusively to the approved works and to the corresponding invoices. Any unused balance is returned to the Client on completion, and any approved variation or supplementary cost must itself be approved and provisioned in advance before the additional work proceeds.

11.4-A. **Nature of the funds and of the payment.** In receiving and applying funds under this Clause 11, GUARDEMAR acts exclusively as the Client's agent for payment, under the written mandate contained in the Client's approval of the quotation. Such funds are received on the Client's account, are held separately from GUARDEMAR's own funds, do not constitute consideration for the Services, and do not form part of GUARDEMAR's turnover. GUARDEMAR does not purchase, resell, mark up or execute the works, and is not the contracting party in respect of them.

11.4-B. **Invoicing.** The Third-Party Contractor issues its invoice **to the Client**, in the Client's name and fiscal details, with GUARDEMAR identified, where necessary, solely as the party settling it on the Client's behalf. GUARDEMAR invoices the Client only for its own coordination or administration fee under Clause 11.5 and for any amount it has advanced. Nothing in this arrangement makes GUARDEMAR a contractor, builder, employer or guarantor in relation to the works.

11.4-C. **VAT on works.** The VAT rate applicable to any works is determined by the Third-Party Contractor under the Portuguese VAT Code, according to the nature of the works and the status and use of the Property. Reduced rates depend on conditions that a holiday home, a secondary residence or a property used for tourist accommodation will not normally satisfy, and the **standard rate accordingly applies** to works at such properties. The Client bears the VAT in full, and it must be included in the amount provisioned under Clause 11.2(b).

11.4-D. The Client is responsible for confirming, with its own accountant or tax adviser, the rate applicable to its Property and for supplying any declaration or documentation a contractor may require in order to apply a different rate. GUARDEMAR gives no advice and makes no representation as to the applicable rate, does not verify any declaration made by the Client to a contractor, and is not liable for any assessment, correction, interest or penalty imposed by the tax authority in consequence. Where a rate is subsequently corrected, the resulting difference is borne by the Client and, if already settled by GUARDEMAR, is reimbursed on demand.

11.5. GUARDEMAR may apply a coordination or administration fee in connection with works, notified to the Client in advance of approval. That fee is consideration for GUARDEMAR's own service, is invoiced by GUARDEMAR to the Client and is subject to VAT at the standard rate, separately from the works themselves.

11.6. Where a quotation cannot be obtained, where no technician is available, or where the Client does not approve or provision within a reasonable period, GUARDEMAR's only obligation is to inform the Client. The matter then rests entirely with the Client.

11.7. This Clause 11 does not apply to any measure taken under Clause 12.

---

## 12. Urgent protective measures

12.1. Where the Client cannot be contacted and there is an apparent risk of imminent and significant damage, GUARDEMAR **may**, entirely at its own discretion and without any obligation to do so, take simple protective measures (for example, closing a stopcock, isolating a circuit, closing a shutter, or contacting an emergency service or contractor).

12.2. Any such measure is taken in the Client's interest, at the Client's cost and at the Client's risk. The exercise or non-exercise of that discretion creates no duty for the future and gives rise to no liability of any kind.

12.3. GUARDEMAR has no authority to commit the Client to expenditure without prior authorisation, save for measures under this Clause up to a maximum of **€250** per event, which the Client undertakes to reimburse on demand.

---

## 13. Insurance — obligations of the Client

13.1. **The Client must hold, maintain in force throughout the term, and provide GUARDEMAR with documentary proof of:**
   a) a **multi-risk buildings and contents policy** (*seguro multirriscos*) covering the Property; and
   b) a **civil liability policy** (*seguro de responsabilidade civil*) appropriate to the Property.

13.2. Proof consists of a valid insurance certificate or *condições particulares* identifying the insurer, the policy number, the Property, the cover and the period of validity. It must be supplied **before the first visit** and, thereafter, on each renewal or on GUARDEMAR's request.

13.3. Failure to provide or maintain that proof entitles GUARDEMAR to suspend the Services immediately, with Fees continuing to accrue, and to terminate the Agreement under Clause 5.5. GUARDEMAR bears no liability of any kind in respect of any period during which the Client is not, or cannot demonstrate that it is, insured.

13.4. The Client is solely responsible for informing its insurer that the Property is unoccupied or intermittently occupied and for complying with every condition, warranty, exclusion and inspection requirement imposed by the policy, including requirements as to frequency of visits, draining of systems, isolation of water, minimum heating and alarm activation.

13.5. The Client acknowledges that GUARDEMAR's visits do not automatically satisfy any insurance requirement. It is for the Client to verify with its insurer whether the plan selected meets the policy conditions and to select a plan accordingly. GUARDEMAR gives no warranty that any plan satisfies any policy condition and accepts no liability where an insurer reduces, declines or repudiates a claim.

13.6. The Client shall use reasonable endeavours to ensure that its insurers waive any right of subrogation against GUARDEMAR in respect of losses covered by the Client's own policies.

13.7. GUARDEMAR holds such liability insurance as it considers appropriate to its activity from time to time; the cover in force is confirmed on request. The existence, scope or limits of that cover do not extend GUARDEMAR's liability beyond the limits set out in these Conditions, are not held for the benefit of the Client, and confer no right on the Client. The Client's protection in respect of the Property, its contents and its installations derives exclusively from the Client's own policies under Clause 13.1, and the Client may not rely on GUARDEMAR's insurance as a substitute for them.

13.8. GUARDEMAR acts under this Agreement exclusively as a property-care provider. Nothing in the Services constitutes insurance mediation, insurance advice or a recommendation in relation to any insurance contract.

---

## 14. Additional and extra services

14.1. Additional visits and the on-demand services listed on guardemar.com may be requested at the rates in force at the time.

14.2. The Client may also request services that do not form part of GUARDEMAR's standard portfolio. Any such service is provided only where GUARDEMAR expressly agrees in writing to provide it and where the parties have agreed the corresponding remuneration in advance. GUARDEMAR is under no obligation to accept such a request and may decline without giving reasons.

14.3. Extra services agreed under this Clause remain subject to these Conditions in their entirety, including Clauses 3, 4 and 18.

---

## 15. Fees, billing and payment

15.1. Fees are those stated in the Service Order. Prices published on the website are indicative starting prices and are subject to property-specific assessment. These Conditions establish the billing rules and the method of calculation; the applicable amounts are those set out in the Service Order in force.

15.2. **Billing options.** Unless otherwise stated in the Service Order, Plan Fees may be paid either:
   a) **Monthly Billing** — in monthly instalments, payable in advance by recurring card payment; or
   b) **Annual Billing** — in one annual payment, payable in advance by card.

15.3. **Monthly Billing is not a monthly contract.** Where Monthly Billing is selected, the Client enters into the same twelve (12) month Initial Term described in Clause 5.2. Monthly Billing is a payment arrangement only and does not create a monthly, rolling or cancel-anytime contract, and does not confer any right of termination that these Conditions do not otherwise confer.

15.4. **Annual Billing discount.** Where Annual Billing is selected, the annual Plan Fee is calculated by applying a **ten per cent (10%) discount** to the total of twelve monthly Plan Fees applicable to the selected Plan at the commencement or renewal of the relevant Term.

15.5. The applicable Plan Fee, billing frequency, annual discount where applicable, taxes and total amount payable are clearly stated in the Service Order before the Client enters into the Agreement.

15.6. **Recurring monthly payment authority.** By selecting Monthly Billing, the Client expressly authorises GUARDEMAR and its appointed payment service provider to charge the agreed monthly Plan Fee, together with any applicable taxes, to the payment method provided by the Client, on a recurring monthly basis throughout the Term.

15.7. **Annual payment authority.** By selecting Annual Billing, the Client expressly authorises GUARDEMAR and its appointed payment service provider to charge the full annual Plan Fee, after application of the applicable annual discount and together with any applicable taxes, to the payment method provided by the Client at the commencement of each Term.

15.8. **Continuity on renewal.** Unless the Agreement is terminated in accordance with these Conditions, the selected billing arrangement continues upon renewal. Where Annual Billing applies, the annual Fee for the renewed Term is calculated using the monthly Plan Fee then in force and the annual discount offered by GUARDEMAR at the time of renewal, as stated in the applicable renewal notice or Service Order.

15.9. **Payment methods.** The standard payment method is card, charged on a recurring basis in accordance with Clauses 15.6 and 15.7. GUARDEMAR may, where expressly agreed and recorded in the Service Order, accept payment by SEPA direct debit, for which the Client provides its bank details and signs the corresponding mandate in favour of Ownizo Unipessoal Lda, or by bank transfer, in which case the Client must send the corresponding payment confirmation to GUARDEMAR. Where an alternative method is agreed, all other provisions of this Clause 15 apply without modification.

15.10. **Maintaining a valid payment method.** The Client is responsible for maintaining a valid payment method and for ensuring that sufficient funds or credit are available for recurring charges. The failure, rejection, revocation or expiry of a payment method does not, by itself, terminate the Agreement or release the Client from any amount properly due under it.

15.11. **Failed payments.** If a recurring payment fails, GUARDEMAR or its payment service provider may make further reasonable attempts to collect the amount due and may request that the Client update or replace the payment method.

15.12. **Non-payment — escalation.** Without prejudice to Clauses 15.10 and 15.11, where any Fee is not paid when due — including through a failed, returned, rejected or revoked charge or direct debit, a declined or expired card, or a transfer not received in cleared funds — the following applies:
   a) GUARDEMAR notifies the Client and may re-attempt collection;
   b) from the **eighth (8th) day** after the due date, GUARDEMAR **suspends the Services** with immediate effect, without further notice and without liability of any kind. The Agreement remains in force and the Fees continue to accrue and remain payable throughout the suspension;
   c) an administrative charge of **€25** is payable for each failed collection cycle, corresponding to the cost of notification, re-attempted collection and account administration;
   d) any bank, card-scheme or payment-provider charge actually incurred by GUARDEMAR as a result of the failed payment, including chargeback and direct-debit return charges, is reimbursed by the Client at cost;
   e) reinstatement of the Services following suspension is conditional on settlement of all outstanding amounts, on the provision of a valid payment method, and on payment of a **reactivation charge of €75**, corresponding to the re-verification of access, alarm registration and Property data.

15.12-A. **Loss of the benefit of instalments.** Where the Plan Fee is payable in instalments under Monthly Billing and any instalment remains unpaid, GUARDEMAR may, after written demand giving the Client a period of not less than **eight (8) days** to pay, declare all remaining instalments for the current Term immediately due and payable, in accordance with Article 781 of the Portuguese Civil Code, and terminate the Agreement under Clause 5.5(a). The Client's liability in that event is determined by Clause 15.20.

15.12-B. **Default interest.** Interest accrues on all overdue amounts from the due date until payment in full, as follows:
   a) where the Client is a **consumer**, at the civil legal rate in force, currently four per cent (4%) per annum under Portaria n.º 291/2003;
   b) where the Client is **not a consumer**, at the supplementary commercial rate in force from time to time for commercial transactions under Decreto-Lei n.º 62/2013 and Article 102 of the Commercial Code, as published semi-annually, together with the minimum recovery amount of **€40** provided for in Article 7 of that Decreto-Lei and any further reasonable recovery costs.

The charges under Clauses 15.12(c) to (e) are cumulative with interest but are not cumulative with one another in respect of the same collection cycle.

15.13. Fees are exclusive of VAT and any other taxes legally applicable, unless expressly stated otherwise in the Service Order or at checkout. Applicable taxes are added at the rate required by law.

15.14. **On-demand services.** Additional visits, emergency call-outs, contractor access, delivery attendance, arrival preparation, extra services agreed under Clause 14 and other on-demand services are charged separately at the rates stated in the Service Order, in a quotation, or as otherwise agreed with the Client. They are invoiced separately in all cases, irrespective of the billing frequency selected.

15.15. The Client shall pay undisputed invoices within the period stated on the invoice or Service Order.

15.16. Fees are payable irrespective of whether the Client uses the Property, is present in Portugal, or benefits from the Services in any particular month, and irrespective of the number of visits actually possible where the impossibility is not attributable to GUARDEMAR.

15.17. **Revision of Fees.** GUARDEMAR may revise its Fees from time to time. Any revised Plan Fee applicable to a Renewal Term is communicated to the Client before that renewal takes effect, in accordance with these Conditions and applicable law.

15.18. The Client may not withhold or set off any amount against Fees.

15.19. **Refunds.** Any refund, credit or adjustment is governed by these Conditions, the applicable Service Order and mandatory law. Fees relating to a commenced monthly period are not refundable in whole or in part. Selection of Annual Billing does not create an entitlement to a refund merely because the Client ceases to use the Property, is absent, or no longer requires the Services during the relevant Term.

15.19-A. **Annual Billing — recalculation on early termination.** Where the Agreement terminates before the end of a Term for which the Client has paid under Annual Billing, and the termination is attributable to the Client or arises under Clause 5.5, the amount refundable is calculated as follows:

> **Refund = Annual Fee paid − (number of months elapsed or commenced × the standard monthly Plan Fee for the selected Plan) − €50 administrative charge**

The result is never less than zero, and no further amount is refundable. The Client acknowledges that the annual discount under Clause 15.4 is granted as consideration for the Client's commitment to the full Term, and that on early termination the Services actually received are properly valued at the standard monthly Plan Fee. This Clause does not apply to withdrawal under Clause 5.4 or where a refund is required by mandatory law.

15.20. **Early termination compensation.** Where the Agreement terminates before the end of a Term as a result of a breach by the Client or of any circumstance listed in Clause 5.5, or where the Client purports to terminate early otherwise than under Clause 5.3 or 5.4, the Client pays GUARDEMAR, by way of agreed compensation, **fifty per cent (50%) of the Plan Fees that would have fallen due for the remainder of that Term**, in addition to all Fees already due and unpaid up to the date of termination and to any charges under Clause 15.12.

15.20-A. The parties agree that this amount represents a reasonable pre-estimate of the loss suffered by GUARDEMAR, comprising the costs of client acquisition, first property assessment, onboarding, key registration and administration already incurred, together with the loss of contribution over the remainder of the Term, net of the costs GUARDEMAR avoids by not performing the outstanding visits. It is agreed as a penalty clause (*cláusula penal*) under Articles 810 and following of the Portuguese Civil Code and is not cumulative with any claim for the same loss.

15.20-B. Where Annual Billing applies and the Client has already paid the Term in full, Clause 15.19-A governs and Clause 15.20 does not apply in addition, so that the Client is never charged twice for the same period.

15.20-C. No compensation is payable under Clause 15.20 where the Client terminates as a result of a material breach by GUARDEMAR, where the Agreement terminates under Clause 20.2, or where the Client exercises a right of withdrawal or termination conferred by mandatory law.

---

## 16. Property assessment, Property Profile and Client information

16.1. Before or shortly after the Start Date, GUARDEMAR carries out a first property assessment and prepares a Property Profile recording access instructions, systems, contacts, existing contractors and agreed tasks.

16.2. The Client must provide complete, accurate and current information about the Property, including in particular:
   a) all known defects, damage, weaknesses, ongoing works, disputes and pending repairs;
   b) any hazard, including asbestos, unstable structures, defective electrical or gas installations, unfenced pools, wells, cesspits, unsafe stairs or balconies, and any animal present at the Property;
   c) the location and operation of the water stopcock, electrical consumer unit, gas shut-off and pool plant;
   d) any occupancy by tenants, guests, family, cleaners, gardeners or other third parties, including short-term rental use;
   e) the identity and contact details of any other person holding keys or access to the Property;
   f) all matters relevant to the Client's insurance, condominium rules and mortgage conditions.

16.3. GUARDEMAR relies entirely on the information supplied by the Client and has no duty to investigate, verify or audit it. GUARDEMAR is not liable for any consequence arising from information that is incorrect, incomplete or not updated.

16.4. The Client must notify GUARDEMAR in writing, without delay, of any change to the information above, to the ownership of the Property, or to its own contact details.

16.5. The Client must at all times maintain a valid email address and telephone contact at which it can be reached, and must designate at least one alternative contact person able to give instructions if the Client is unavailable.

---

## 17. Utilities and condition of the Property

17.1. The Client must keep the water, electricity and, where relevant, gas and internet supplies to the Property active, connected and paid throughout the term. GUARDEMAR is not liable for any consequence of disconnection, suspension, supply failure, power cut or interruption, including loss of refrigeration, failure of alarms, cameras, dehumidifiers, irrigation, pool filtration or heating.

17.2. The Client remains solely responsible for the maintenance, servicing, legal compliance, safety and insurance of the Property and all its installations, irrespective of any visit or Report.

17.3. Pool maintenance, gardening, cleaning and professional repairs are not included in any plan. Visual observations of a pool or garden do not constitute pool treatment, water testing, chemical dosing or horticultural care, and do not discharge the Client's legal obligations regarding pool safety.

17.4. Where the Property is let, occupied or used by third parties at any time, the Client remains responsible for their conduct and for any resulting damage, and must inform GUARDEMAR of such use in advance.

---

## 18. Liability

18.1. Nothing in these Conditions excludes or limits GUARDEMAR's liability where such exclusion or limitation would be unlawful, including liability for death or personal injury caused by its negligence, for wilful misconduct or gross negligence (*dolo ou culpa grave*), or under mandatory consumer protection law.

18.2. Subject to Clause 18.1, GUARDEMAR is liable only for direct damage caused by its own proven failure to perform the Services with the care required by Clause 3.2, and only within the agreed scope of the Services as defined in Clause 3.1.

18.3. Subject to Clause 18.1, GUARDEMAR is **not** liable for any of the matters excluded by Clause 4, nor for:
   a) any event occurring at the Property between visits, or at any time when access was unavailable;
   b) any defect, damage or condition that was concealed, latent, not visible or outside the agreed scope at the time of a visit, including one in progress at that moment;
   c) burglary, theft, vandalism, trespass, squatting, arson or any criminal act;
   d) storm, flood, fire, wildfire, lightning, earthquake, subsidence, drought, pest infestation or other natural event;
   e) failure of any utility, alarm, camera, smart device, connectivity or third-party system;
   f) the acts or omissions of Third-Party Contractors, occupants, tenants, guests, neighbours, the condominium or any third party;
   g) the Client's failure to act, delay in acting, or failure to approve or provision funds under Clause 11;
   h) any decision of an insurer, including reduction, refusal or repudiation of a claim;
   i) loss of rental income, loss of use, loss of profit, loss of opportunity, diminution in value, wasted expenditure, travel costs, alternative accommodation, distress, inconvenience, reputational damage or any indirect or consequential loss of any kind.

18.4. Subject to Clause 18.1, GUARDEMAR's aggregate liability under or in connection with the Agreement, whether contractual, delictual or otherwise, is limited, per event and in aggregate over any period of twelve (12) months, to the total Fees paid by the Client under the Agreement in the twelve (12) months preceding the event giving rise to the claim.

18.5. The Client must notify GUARDEMAR in writing of any claim as soon as reasonably practicable and, in any event, within thirty (30) days of becoming aware of the facts giving rise to it, so that GUARDEMAR can investigate. This obligation does not shorten any mandatory limitation period, but the Client bears the evidential consequences of a late notification.

18.6. The Fees have been set on the basis of the allocation of risk contained in Clauses 4 and 18. The Client accepts that a materially different allocation of risk would require materially different Fees.

---

## 19. Indemnity

The Client indemnifies and holds harmless GUARDEMAR, Ownizo Unipessoal Lda and their personnel against all claims, demands, proceedings, fines, penalties, damages, losses and reasonable costs (including legal costs) arising from or connected with:
   a) any inaccuracy, omission or failure to update the information supplied by the Client;
   b) any defect, hazard, animal, installation or condition at the Property causing injury, illness or damage to GUARDEMAR personnel or to any person or property;
   c) any deficiency in the Client's authority to grant access or to instruct key holding, or any claim by a co-owner, tenant, condominium, mortgagee or third party in that respect;
   d) any act or omission of a Third-Party Contractor, occupant, tenant, guest or other person having access to the Property;
   e) the absence or lapse of the insurance required by Clause 13;
   f) any breach by the Client of these Conditions or of applicable law.

---

## 20. Force majeure

20.1. Neither party is liable for any failure or delay in performance caused by an event beyond its reasonable control, including severe weather, flood, fire, wildfire, storm, earthquake, epidemic or pandemic, official restriction, road closure, civil unrest, strike, failure of utilities or telecommunications, cyber-attack, accident, serious illness or unavailability of essential personnel.

20.2. Where such an event prevents visits for more than sixty (60) consecutive days, either party may terminate the Agreement by written notice, without compensation.

---

## 21. Personnel and non-solicitation

21.1. GUARDEMAR may perform the Services through its own personnel or through subcontractors, remaining responsible for the performance of its own obligations.

21.2. During the term and for twelve (12) months thereafter, the Client shall not directly or indirectly solicit or engage, other than through GUARDEMAR, any employee or regular subcontractor of GUARDEMAR who has been involved in the provision of the Services, without GUARDEMAR's prior written consent.

---

## 22. Confidentiality and data protection

22.1. Each party keeps confidential the information of the other to which it has access under the Agreement. GUARDEMAR treats the Property, its access details, its condition and the Client's circumstances as confidential.

22.2. Personal data is processed in accordance with the GDPR and Portuguese law, as described in the Privacy Policy published at guardemar.com/privacy-policy. Photographs taken during Inspections are processed for the purpose of documenting the visible condition of the Property and are retained for the periods stated in that policy.

22.3. The Client must inform any occupant, tenant, cleaner, gardener or other person present at the Property that GUARDEMAR carries out documented visits and takes photographs, and is responsible for any consent required from such persons.

22.4. Where the Property is equipped with cameras, recording devices or connected systems, the Client is responsible for their lawful operation and for compliance with data protection and privacy law, including in respect of GUARDEMAR personnel.

22.5. GUARDEMAR may disclose information where required by law or by a competent authority.

---

## 23. Communications

23.1. Communications are validly made by email to the addresses recorded in the Service Order, through the Client Area, by telephone to the numbers on file, and operationally by WhatsApp to the numbers recorded in the Property Profile. Instructions given by WhatsApp are valid where they originate from a contact recorded in the Property Profile.

23.2. Notices of termination, suspension or complaint must be given by email to info@guardemar.com or in writing to the registered office.

23.3. GUARDEMAR does not operate a continuous response service. Communications are answered within normal working hours.

---

## 24. Amendments

24.1. GUARDEMAR may amend these Conditions for legal, regulatory or operational reasons, giving thirty (30) days' written notice. Where an amendment is materially unfavourable to the Client, the Client may terminate with effect from the date the amendment takes effect, by written notice given before that date. Continued use of the Services after that date constitutes acceptance.

24.2. Amendments to the scope, frequency or price agreed for a specific Property require the written agreement of both parties.

---

## 25. General

25.1. **Severability.** If any provision is held invalid or unenforceable, it is severed or reduced to the extent necessary, and the remaining provisions continue in full force.

25.2. **No waiver.** GUARDEMAR's failure or delay in enforcing any provision is not a waiver of it.

25.3. **Entire agreement.** The Agreement constitutes the entire agreement between the parties in relation to the Services and supersedes all prior discussions, proposals and representations, save for fraudulent misrepresentation.

25.4. **Assignment.** The Client may not assign the Agreement without GUARDEMAR's written consent. GUARDEMAR may assign or transfer the Agreement within its corporate group or in connection with a transfer of its business.

25.5. **Change of ownership.** If the Property is sold or transferred, the Client must notify GUARDEMAR in writing without delay. The Agreement does not transfer automatically to the new owner.

25.6. **Language.** These Conditions are issued in English. Any translation is provided for convenience; in the event of discrepancy, the English version prevails, save where mandatory law provides otherwise.

---

## 26. Applicable law and jurisdiction

26.1. The Agreement is governed by Portuguese law.

26.2. **Any dispute arising from or connected with the Agreement is resolved through the Portuguese courts.** The courts of the Comarca de Faro have exclusive jurisdiction, without prejudice to any mandatory rule granting a consumer the right to bring or defend proceedings in the courts of their domicile.

26.3. Before commencing proceedings, the parties undertake to raise the matter directly with each other in writing, so that a resolution may be sought.

26.4. As required by Portuguese law, GUARDEMAR informs consumers that the Electronic Complaints Book is available at **www.livroreclamacoes.pt**, and that the alternative dispute resolution entities competent for consumer disputes include **CIMAAL — Centro de Informação, Mediação e Arbitragem de Conflitos de Consumo do Algarve** (www.consumoalgarve.pt) and **CNIACC — Centro Nacional de Informação e Arbitragem de Conflitos de Consumo** (www.cniacc.pt). Further information is available at **www.consumidor.gov.pt**. GUARDEMAR does not adhere to arbitration in advance, save where such adherence is mandatory by law.

---

## Annex A — Access Handover Record

To be completed and signed on delivery of the Access Means, within five (5) calendar days of the Start Date.

| Item | Description / code reference | Quantity | Received |
|---|---|---|---|
| Front door key | | | |
| Other external door keys | | | |
| Gate / pedestrian gate key | | | |
| Garage / storeroom key | | | |
| Technical room / pool plant key | | | |
| Meter cupboard key | | | |
| Gate remote control | | | |
| Garage remote control | | | |
| Condominium fob / card | | | |
| Key-safe location and code | | | |
| Smart-lock credentials | | | |
| Alarm code (arm / disarm) | | | |
| Alarm company and keyholder registration | | | |
| Wi-Fi credentials | | | |
| Other | | | |

**Client declaration.** I confirm that the Access Means listed above are complete, functional and current; that I am the owner of the Property or duly authorised to grant access and key holding; that I have obtained any consent required from co-owners, tenants, mortgagees and the condominium; and that I will notify GUARDEMAR in writing before any change to locks, codes or access systems.

Client: ______________________  Date: __________  Signature: ______________________

Received by GUARDEMAR: ______________________  Date: __________  Signature: ______________________

---

## Annex B — Insurance Record

| | Multi-risk (buildings and contents) | Civil liability |
|---|---|---|
| Insurer | | |
| Policy number | | |
| Valid until | | |
| Certificate supplied on | | |

The Client undertakes to supply an updated certificate on each renewal and acknowledges that the Services may be suspended or terminated in the absence of valid proof.

---

## Annex C — Client acknowledgements

To be confirmed by the Client during the subscription process, before the Services commence, in accordance with Clauses 1.7 and 1.8. Each item is confirmed separately.

The Client expressly acknowledges having read, understood and accepted the following provisions:

- **Clause 3** — the object of the Agreement is limited to the visual observation of the Property and the production of a Report. The Services are an obligation of means and are neither a security service, a technical survey, custody of the Property, nor insurance.
- **Clause 4** — GUARDEMAR accepts no responsibility for the Property, its contents, its furniture, artwork, electronics, safes and their contents, food, clothing, plumbing, electrical and other installations, gardens, pools, exterior areas or any goods inside or outside the Property; nor for anything that is not visible, including pipework within walls and hidden electrical faults; nor for damage occurring between visits or in progress but not visible during a visit.
- **Clause 6** — delivery of the complete Access Means within five (5) calendar days of the Start Date is an essential obligation, and failure to comply leaves the Fees fully payable while releasing GUARDEMAR from all liability.
- **Clauses 10 and 11** — works are executed exclusively by specialised technicians contracted directly by the Client; GUARDEMAR is not responsible for damage caused by them before, during or after the works; and no work commences without written approval of the quotation and transfer of its full amount into the account of Ownizo Unipessoal Lda.
- **Clause 13** — the Client must hold and evidence multi-risk and civil liability insurance throughout the term, and may not rely on GUARDEMAR's own insurance as a substitute for its own.
- **Clauses 8.6 to 8.8** — the Baseline Condition Record establishes the visible condition of the Property at the Start Date if not commented upon within thirty days, and the Client is responsible for downloading and preserving any Report or image it may wish to rely on later.
- **Clause 1.9** — the Services do not commence until the acknowledgements, the Access Means, the proof of insurance and a valid payment method have all been provided.
- **Billing and contract term (Clauses 5.2 and 15.3)** — selecting Monthly Billing does not create a monthly contract. The Agreement has the Initial Term stated in Clause 5.2, and monthly billing is solely a method of paying the Plan Fee in instalments.
- **Recurring payment authority (Clauses 15.6 and 15.7)** — where Monthly Billing is selected, the Client authorises recurring monthly charges to the payment method provided. Where Annual Billing is selected, the Client authorises the applicable annual charge in advance for each Term.
- **Annual Billing discount (Clause 15.4)** — where Annual Billing is selected, the applicable annual discount and resulting annual Fee are stated in the Service Order before acceptance.
- **Non-payment (Clauses 15.12 and 15.12-A)** — the Services are suspended from the eighth day after the due date, administrative and reactivation charges apply, and all remaining instalments of the Term may be declared immediately due.
- **Early termination (Clauses 15.19-A and 15.20)** — early termination attributable to the Client gives rise to compensation of 50% of the Plan Fees remaining for the Term, or, under Annual Billing, to a refund recalculated at the standard monthly rate.
- **Clause 18** — limitation of GUARDEMAR's liability and the agreed allocation of risk.

Client: ______________________  Date: __________  Signature: ______________________

---

*GUARDEMAR is a commercial brand of Ownizo Unipessoal Lda · NIPC 517169029*
$guardemar_terms_v25$, '7bdf2ed911c1c6f312e20a985c8e40ddc09af5b7e401925a9c3ffd49d6bf76fd');

insert into public.fee_schedule_versions (effective_date, title, document_text, sha256)
values (date '2026-09-05', 'GUARDEMAR — Fee Schedule', $guardemar_fees_20260905$# GUARDEMAR — Fee Schedule

**Applicable from 5 September 2026.** Supersedes all previously published prices.

This schedule is referred to in the Service Order. It does not form part of the General Terms and Conditions of Service and may be revised in accordance with Clause 15.17 of those Conditions.

---

## Plan Fees

| Plan | Monthly Billing | Annual Billing (10% discount) | Annual saving |
|---|---|---|---|
| **CARE** | €79 / month | €853.20 / year | €94.80 |
| **CARE+** | €129 / month | €1,393.20 / year | €154.80 |
| **COMPLETE** | €189 / month | €2,041.20 / year | €226.80 |

All amounts are exclusive of VAT, which is added at the rate required by law.

Annual Billing is calculated by applying a 10% discount to the total of twelve monthly Plan Fees, in accordance with Clause 15.4 of the Conditions. The discount is granted as consideration for the commitment to the full twelve-month Term; on early termination the Services received are valued at the standard monthly Plan Fee, as set out in Clause 15.19-A.

Prices are indicative starting prices for a standard property. The Fee applicable to a specific Property is confirmed in the Service Order following the first property assessment, and may vary with the size, location, complexity and installations of the Property.

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
$guardemar_fees_20260905$, '0f41a94e894cb6a60af6bd87a433688107a6ae774bf83d420dfc1f0c179a483b');

do $guardemar_document_validation$
begin
  if not exists (
    select 1 from public.legal_terms_versions
    where version = '2.5'
      and effective_date = date '2026-09-05'
      and sha256 = encode(extensions.digest(convert_to(document_text, 'UTF8'), 'sha256'), 'hex')
      and sha256 = '7bdf2ed911c1c6f312e20a985c8e40ddc09af5b7e401925a9c3ffd49d6bf76fd'
  ) then raise exception 'Guardemar General Terms Version 2.5 hash validation failed'; end if;
  if not exists (
    select 1 from public.fee_schedule_versions
    where effective_date = date '2026-09-05'
      and sha256 = encode(extensions.digest(convert_to(document_text, 'UTF8'), 'sha256'), 'hex')
      and sha256 = '0f41a94e894cb6a60af6bd87a433688107a6ae774bf83d420dfc1f0c179a483b'
  ) then raise exception 'Guardemar Fee Schedule hash validation failed'; end if;
end;
$guardemar_document_validation$;

create table public.service_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  agreement_acceptance_id uuid,
  plan_code public.guardemar_plan_code not null,
  billing_interval public.guardemar_billing_interval not null,
  currency text not null default 'EUR',
  monthly_net_amount integer not null,
  annual_list_net_amount integer not null,
  annual_discount_percent numeric(5,2) not null default 10.00,
  annual_discount_net_amount integer not null,
  selected_net_amount integer not null,
  tax_percentage numeric(7,4) not null,
  tax_display_name text not null,
  tax_amount integer not null,
  gross_amount integer not null,
  tax_configuration text not null default 'stripe_tax_rate',
  stripe_tax_rate_id text not null,
  contract_start_date date,
  contract_end_date date,
  renews_at date,
  local_status public.guardemar_subscription_status not null default 'pending_acceptance',
  payment_status public.guardemar_payment_status not null default 'not_started',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  stripe_price_id text,
  stripe_subscription_status text,
  stripe_current_period_start timestamptz,
  stripe_current_period_end timestamptz,
  stripe_state_updated_at timestamptz,
  payment_state_updated_at timestamptz,
  checkout_idempotency_key text not null unique,
  acceptance_idempotency_key uuid not null unique,
  checkout_expires_at timestamptz,
  last_payment_failed_at timestamptz,
  activated_at timestamptz,
  ended_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_subscriptions_currency_check check (currency = 'EUR'),
  constraint service_subscriptions_amounts_check check (
    monthly_net_amount > 0 and annual_list_net_amount = monthly_net_amount * 12
    and annual_discount_net_amount >= 0 and selected_net_amount > 0
    and tax_percentage >= 0 and tax_amount >= 0
    and tax_amount = round(selected_net_amount * tax_percentage / 100.0)::integer
    and gross_amount = selected_net_amount + tax_amount
    and tax_configuration = 'stripe_tax_rate' and stripe_tax_rate_id ~ '^txr_'
  ),
  constraint service_subscriptions_property_client_unique unique (id, property_id, client_id),
  constraint service_subscriptions_stripe_subscription_key unique (stripe_subscription_id),
  constraint service_subscriptions_stripe_checkout_key unique (stripe_checkout_session_id)
);

create table public.service_agreement_acceptances (
  id uuid primary key default extensions.gen_random_uuid(),
  subscription_id uuid not null unique references public.service_subscriptions(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  terms_version text not null references public.legal_terms_versions(version) on delete restrict,
  terms_effective_date date not null,
  terms_sha256 text not null,
  fee_schedule_effective_date date not null references public.fee_schedule_versions(effective_date) on delete restrict,
  fee_schedule_sha256 text not null,
  accepted_at timestamptz not null,
  plan_code public.guardemar_plan_code not null,
  billing_interval public.guardemar_billing_interval not null,
  currency text not null,
  monthly_amount integer not null,
  annual_list_amount integer not null,
  annual_discount_percent numeric(5,2) not null,
  annual_discount_amount integer not null,
  selected_amount integer not null,
  stripe_price_id text not null,
  stripe_tax_rate_id text not null,
  tax_percentage numeric(7,4) not null,
  tax_display_name text not null,
  tax_amount integer not null,
  gross_amount integer not null,
  client_snapshot jsonb not null,
  property_snapshot jsonb not null,
  service_order_snapshot jsonb not null,
  acknowledgements jsonb not null,
  withdrawal_early_start_requested boolean not null default false,
  withdrawal_early_start_text text,
  user_agent text,
  request_metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now(),
  constraint service_agreement_acceptances_currency_check check (currency = 'EUR'),
  constraint service_agreement_acceptances_terms_check check (
    terms_version = '2.5' and terms_effective_date = date '2026-09-05'
    and terms_sha256 = '7bdf2ed911c1c6f312e20a985c8e40ddc09af5b7e401925a9c3ffd49d6bf76fd'
    and fee_schedule_effective_date = date '2026-09-05'
    and fee_schedule_sha256 = '0f41a94e894cb6a60af6bd87a433688107a6ae774bf83d420dfc1f0c179a483b'
    and stripe_tax_rate_id ~ '^txr_' and tax_percentage >= 0 and tax_amount >= 0
    and tax_amount = round(selected_amount * tax_percentage / 100.0)::integer
    and gross_amount = selected_amount + tax_amount
  ),
  constraint service_agreement_acceptances_acknowledgements_check check (
    jsonb_typeof(acknowledgements) = 'object'
  )
);

alter table public.service_subscriptions
  add constraint service_subscriptions_acceptance_fk
  foreign key (agreement_acceptance_id) references public.service_agreement_acceptances(id) on delete restrict;

create table public.subscription_payment_events (
  id uuid primary key default extensions.gen_random_uuid(),
  subscription_id uuid not null references public.service_subscriptions(id) on delete restrict,
  stripe_event_id text not null,
  stripe_invoice_id text,
  event_type text not null,
  payment_status public.guardemar_payment_status not null,
  amount_net integer,
  amount_tax integer,
  amount_gross integer,
  currency text,
  action_url text,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint subscription_payment_events_stripe_event_key unique (stripe_event_id, event_type)
);

create table public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  api_version text,
  livemode boolean not null,
  payload jsonb not null,
  processing_status text not null default 'processing',
  last_attempt_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  constraint stripe_webhook_events_status_check check (processing_status in ('processing', 'processed', 'failed'))
);

create index service_subscriptions_client_idx on public.service_subscriptions (client_id, created_at desc);
create index service_subscriptions_property_idx on public.service_subscriptions (property_id, created_at desc);
create index service_subscriptions_status_idx on public.service_subscriptions (local_status, payment_status);
create index service_subscriptions_stripe_customer_idx on public.service_subscriptions (stripe_customer_id);
create index service_subscriptions_next_billing_idx on public.service_subscriptions (stripe_current_period_end);
create unique index service_subscriptions_one_open_per_property_key
on public.service_subscriptions (property_id)
where local_status not in ('ended', 'cancelled');
create index service_acceptances_client_idx on public.service_agreement_acceptances (client_id, accepted_at desc);
create index service_acceptances_property_idx on public.service_agreement_acceptances (property_id, accepted_at desc);
create index subscription_payment_events_subscription_idx on public.subscription_payment_events (subscription_id, occurred_at desc);
create index stripe_webhook_events_created_idx on public.stripe_webhook_events (created_at desc);
create unique index audit_events_stripe_event_type_key
on public.audit_events ((metadata ->> 'stripeEventId'), event_type)
where metadata ? 'stripeEventId';
create unique index audit_events_checkout_session_type_key
on public.audit_events ((metadata ->> 'checkoutSessionId'), event_type)
where metadata ? 'checkoutSessionId';

create function private.prevent_immutable_legal_record_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% records are immutable; create a new legal record instead', tg_table_name using errcode = '55000';
end;
$$;

create trigger legal_terms_versions_immutable
before update or delete on public.legal_terms_versions
for each row execute function private.prevent_immutable_legal_record_change();

create trigger fee_schedule_versions_immutable
before update or delete on public.fee_schedule_versions
for each row execute function private.prevent_immutable_legal_record_change();

create trigger service_agreement_acceptances_immutable
before update or delete on public.service_agreement_acceptances
for each row execute function private.prevent_immutable_legal_record_change();

create trigger subscription_payment_events_immutable
before update or delete on public.subscription_payment_events
for each row execute function private.prevent_immutable_legal_record_change();

create function public.create_service_agreement_acceptance(
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
  if not found or fee_schedule_record.effective_date <> date '2026-09-05'
    or fee_schedule_record.sha256 <> '0f41a94e894cb6a60af6bd87a433688107a6ae774bf83d420dfc1f0c179a483b'
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
    when 'care' then monthly_amount := 7900;
    when 'care_plus' then monthly_amount := 12900;
    when 'complete' then monthly_amount := 18900;
  end case;
  annual_list_amount := monthly_amount * 12;
  annual_discount_amount := annual_list_amount / 10;
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
    'serviceFrequency', case requested_plan when 'care' then 'One scheduled inspection per month' when 'care_plus' then 'Two scheduled inspections per month' else 'Weekly scheduled inspections' end,
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

create function private.customer_has_subscription_access(subscription_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_subscriptions subscription
    join public.property_users access on access.property_id = subscription.property_id
    where subscription.id = subscription_uuid and access.user_id = (select auth.uid())
  );
$$;

alter table public.legal_terms_versions enable row level security;
alter table public.fee_schedule_versions enable row level security;
alter table public.service_subscriptions enable row level security;
alter table public.service_agreement_acceptances enable row level security;
alter table public.subscription_payment_events enable row level security;
alter table public.stripe_webhook_events enable row level security;

create policy legal_terms_versions_authenticated_select on public.legal_terms_versions
for select to authenticated using (true);

create policy fee_schedule_versions_authenticated_select on public.fee_schedule_versions
for select to authenticated using (true);

create policy service_subscriptions_authorised_select on public.service_subscriptions
for select to authenticated using (private.is_staff() or private.customer_has_property_access(property_id));

create policy service_agreement_acceptances_authorised_select on public.service_agreement_acceptances
for select to authenticated using (private.is_staff() or private.customer_has_property_access(property_id));

create policy subscription_payment_events_authorised_select on public.subscription_payment_events
for select to authenticated using (private.is_staff() or private.customer_has_subscription_access(subscription_id));

create policy stripe_webhook_events_admin_select on public.stripe_webhook_events
for select to authenticated using (private.is_admin());

revoke all on public.legal_terms_versions, public.fee_schedule_versions, public.service_subscriptions,
  public.service_agreement_acceptances, public.subscription_payment_events,
  public.stripe_webhook_events from public, anon, authenticated;

grant select on public.legal_terms_versions, public.fee_schedule_versions to authenticated;
grant select (
  id, client_id, property_id, plan_code, billing_interval, currency,
  monthly_net_amount, annual_list_net_amount, annual_discount_percent,
  annual_discount_net_amount, selected_net_amount, tax_percentage, tax_display_name,
  tax_amount, gross_amount, tax_configuration, contract_start_date, contract_end_date, renews_at,
  local_status, payment_status, stripe_current_period_start,
  stripe_current_period_end, last_payment_failed_at, activated_at, ended_at, created_at, updated_at
) on public.service_subscriptions to authenticated;
grant select (
  id, subscription_id, client_id, property_id, terms_version,
  terms_effective_date, terms_sha256, fee_schedule_effective_date, fee_schedule_sha256,
  accepted_at, plan_code, billing_interval, currency, monthly_amount, annual_list_amount,
  annual_discount_percent, annual_discount_amount, selected_amount, tax_percentage,
  tax_display_name, tax_amount, gross_amount,
  service_order_snapshot, acknowledgements, withdrawal_early_start_requested,
  withdrawal_early_start_text, created_at
) on public.service_agreement_acceptances to authenticated;
grant select (
  id, subscription_id, stripe_invoice_id, event_type, payment_status,
  amount_net, amount_tax, amount_gross, currency, action_url, occurred_at, created_at
) on public.subscription_payment_events to authenticated;
grant select on public.stripe_webhook_events to authenticated;

revoke all on function private.customer_has_subscription_access(uuid) from public, anon;
grant execute on function private.customer_has_subscription_access(uuid) to authenticated;

revoke all on function public.create_service_agreement_acceptance(uuid, uuid, uuid, public.guardemar_plan_code, public.guardemar_billing_interval, text, jsonb, date, text, text, text, numeric, text, integer, integer, date, jsonb, boolean, text, inet, jsonb) from public, anon, authenticated;
grant execute on function public.create_service_agreement_acceptance(uuid, uuid, uuid, public.guardemar_plan_code, public.guardemar_billing_interval, text, jsonb, date, text, text, text, numeric, text, integer, integer, date, jsonb, boolean, text, inet, jsonb) to service_role;

comment on table public.legal_terms_versions is 'Immutable, versioned legal documents seeded from legal/guardemar-general-terms-v2.5.md with its verified SHA-256.';
comment on table public.fee_schedule_versions is 'Immutable Fee Schedule versions seeded from the approved canonical document with its verified SHA-256.';
comment on table public.service_agreement_acceptances is 'Immutable contractual acceptance evidence. Corrections require a new subscription and acceptance record.';
comment on table public.stripe_webhook_events is 'Idempotency ledger for verified Stripe webhook events; payloads must never contain application secrets.';
