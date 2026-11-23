import { createFileRoute } from '@tanstack/react-router'
import { listedPosts as allPosts } from '@/lib/posts'

import { areas, business, formatEuro, legalEntity, plans, vatNote } from '@/config/site'

const siteUrl = 'https://guardemar.com'

// Plain-text guide for AI assistants and LLM crawlers (llmstxt.org format).
// Generated from the same config and posts as the site, so it never drifts.
const keyPages: Array<[string, string, string]> = [
  ['/property-management-algarve/', 'Second-home management in the Algarve', 'Overview of the service for privately used holiday homes.'],
  ['/home-watch-algarve/', 'Home watch and second-home inspections', 'Scheduled visual inspections with dated photo reports.'],
  ['/key-holding-algarve/', 'Key holding', 'Secure key custody and authorised access for owners abroad.'],
  ['/contractor-access-algarve/', 'Contractor access', 'Meeting and giving access to plumbers, electricians, gardeners, pool and cleaning providers.'],
  ['/arrival-preparation-algarve/', 'Arrival preparation', 'Getting the house checked and ready before the owner travels.'],
  ['/storm-property-checks-algarve/', 'Storm property checks', 'Visual checks after significant weather, subject to safe access.'],
  ['/property-handover-algarve/', 'Property handover', 'Documented handover inspections.'],
  ['/plans/', 'Plans and prices', 'Monthly plans, prices including VAT.'],
  ['/services/', 'Optional services', 'Add-on services such as emergency call-out, vehicle care and deep clean coordination.'],
  ['/how-it-works/', 'How it works', 'From assessment to regular reporting.'],
  ['/inspection-checklist/', 'Inspection checklist', 'What a Guardemar inspection covers.'],
  ['/areas/', 'Service areas', 'Western Algarve, from Carvoeiro to Sagres.'],
  ['/about/hugo-goncalves/', 'About Hugo Gonçalves', 'Founder and principal.'],
  ['/contact/', 'Request a property assessment', 'Contact and assessment form.'],
]

export function buildLlmsTxt() {
  const lines: Array<string> = []
  lines.push('# GUARDEMAR')
  lines.push('')
  lines.push(`> GUARDEMAR is a private estate care and home watch company for villas, estates and second homes in private use in the Western Algarve, Portugal, from Carvoeiro to Sagres. It works discreetly with a limited number of properties and provides fixed-schedule documented visits with dated photo reports, key holding, contractor access and coordination, arrival preparation and storm checks for owners who live abroad.`)
  lines.push('')
  lines.push('Important facts:')
  lines.push('')
  lines.push(`- Operated by ${legalEntity.legalName} (NIPC ${legalEntity.taxId}), trading as GUARDEMAR. Operational base: Lagos, Algarve.`)
  lines.push('- GUARDEMAR carries out visual observation, authorised access and coordination. It does not carry out plumbing, electrical, building, pool or garden work itself; qualified contractors do, and remain responsible for their work.')
  lines.push('- It is not a security company, does not monitor alarms and is not a 24-hour emergency service. It is not an insurer and does not give legal, tax or insurance advice.')
  lines.push(`- Contact: ${business.email}, ${business.phone} (WhatsApp available).`)
  lines.push(`- Plans: ${plans.map((plan) => `${plan.name} ${formatEuro(plan.grossPrice)}/month (${plan.visits.toLowerCase()})`).join(', ')}; GUARDEMAR PRIVATE ESTATE by proposal. ${vatNote} 12-month service agreements, billed monthly or annually in advance (annual billing saves 10%).`)
  lines.push('')
  lines.push('## Key pages')
  lines.push('')
  for (const [path, title, description] of keyPages) lines.push(`- [${title}](${siteUrl}${path}): ${description}`)
  lines.push('')
  lines.push('## Service areas')
  lines.push('')
  for (const [slug, area] of Object.entries(areas)) lines.push(`- [${area.name}](${siteUrl}/areas/${slug}/): ${area.profile}`)
  lines.push('')
  lines.push('## Guides for second-home owners')
  lines.push('')
  const posts = [...allPosts].sort((a, b) => a.title.localeCompare(b.title))
  for (const post of posts) lines.push(`- [${post.title}](${siteUrl}/blog/${post.slug}/): ${post.summary}`)
  lines.push('')
  return `${lines.join('\n')}`
}

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () => new Response(buildLlmsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } }),
    },
  },
})
