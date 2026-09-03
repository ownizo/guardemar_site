# GUARDEMAR — Private Property Care

The production website for GUARDEMAR, serving overseas owners of holiday homes and second homes across the Western Algarve, from Carvoeiro to Sagres.

## Technology

- TanStack Start and TanStack Router
- React 19 and TypeScript
- Tailwind CSS 4 with a custom editorial design system
- Content Collections for Markdown articles
- Netlify Forms for secure enquiry capture and honeypot spam protection
- Netlify deployment adapter

## Local Development

Install dependencies with `pnpm install`, then run `pnpm dev`. The template dev command uses port 3000. For complete Netlify emulation, use `netlify dev --port 8889`.

Create a production output with `pnpm build`. Netlify publishes `dist/client` according to `netlify.toml`.

## Project Structure

- `src/routes/` — homepage, services, plans, areas, blog and legal routes
- `src/components/` — shared layout, CTAs, reporting preview, form and article cards
- `src/config/site.ts` — business details, contact details, service areas, plans and FAQs
- `src/config/pages.ts` — service-page and legal-page copy
- `content/posts/` — initial editorial library
- `public/` — form registration, sitemap, robots and favicon

## Updating Business Details and Prices

Edit `src/config/site.ts`. The `business` object controls the address, phone, email, WhatsApp link, territory and LocalBusiness schema. The `plans` array controls all monthly plan prices, inclusions and labels.

## Adding an Area

Add a unique entry to the `areas` object in `src/config/site.ts` with a local profile, property risks and nearby coverage. The dynamic area route creates the landing page. Add the resulting URL to `public/sitemap.xml`.

## Adding an Article

Create a Markdown file in `content/posts/` using the existing frontmatter format. Write a unique slug, summary and category list, add useful internal links, and add its final URL to `public/sitemap.xml`. Reading time is calculated automatically.

## SEO Architecture

Routes define unique titles, descriptions and canonical URLs. Shared components generate LocalBusiness, Organization, WebSite, Service, FAQPage, Article and Breadcrumb structured data. `public/sitemap.xml`, `public/robots.txt`, semantic headings and crawlable internal links complete the baseline.

## Form Handling

`src/components/assessment-form.tsx` submits the property assessment form to Netlify Forms. `public/__forms.html` is the build-time registration skeleton and must contain every submitted field. Form submissions appear in the Netlify project’s Forms area; notification recipients can be configured in the Netlify UI.

## Analytics Hooks

`src/lib/analytics.ts` defines the supported marketing events: form start and submit, phone, email, WhatsApp, plan, area and article CTA clicks. Events push to `window.dataLayer` when available and emit `guardemar:analytics`. No tracking vendor scripts load until real IDs and consent controls are configured.
