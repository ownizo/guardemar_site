# GUARDEMAR Website

## Overview

Production marketing and editorial website for GUARDEMAR, a private property care and home watch company serving the Western Algarve. The site is built with TanStack Start, React 19, TypeScript, Tailwind CSS 4 and Netlify.

## Architecture

- `src/routes/` contains file-based page routes.
- `src/components/` contains reusable site, form and editorial components.
- `src/config/site.ts` is the source of truth for business details, navigation, service areas, FAQs and plan pricing.
- `src/config/pages.ts` holds maintainable long-form service and legal page content.
- `content/posts/` contains Markdown articles processed by Content Collections.
- `content-collections.ts` defines article frontmatter and calculated reading time.
- `public/__forms.html` registers the assessment form with Netlify Forms.
- `src/routes/sitemap[.]xml.ts` generates the sitemap from static pages, areas and posts; `public/robots.txt` provides crawl controls.
- `src/start.ts` 301-redirects public URLs without a trailing slash to the canonical trailing-slash form.

## Conventions

- Use British English in all customer-facing copy.
- Keep plan prices and business details centralised; never duplicate them in page components.
- Show consumer prices including VAT (use `withVat`/`formatEuro` from `src/config/site.ts`), with the net figure alongside where useful.
- Never publish a street address for the operational base: Guardemar holds client keys.
- Internal links to public pages must use the trailing-slash form.
- Use the existing navy, ocean blue, sand and white design tokens from `src/styles.css`.
- Keep client-side JavaScript limited to interactions that need it.
- Do not invent testimonials, accreditations, customer counts or commercial terms.
- Distinguish visual inspection and coordination from regulated technical work.
- Every new long page should include a useful conversion opportunity and unique metadata.

## Content Changes

Add blog posts as Markdown with `date`, `title`, `summary`, `categories`, `slug` and `author`; optional `seoTitle` (keep under ~50 characters) and `updated` (ISO date of the last material revision). Use the real publication date. Add service areas to `areas` in `src/config/site.ts`; the sitemap picks them up automatically, but add new static pages to `staticPages` in the sitemap route. Article and area slugs must remain unique.

## Forms and Analytics

The assessment form posts URL-encoded data to `/__forms.html`. Keep all React field names mirrored in the static form skeleton. Analytics events pass through `src/lib/analytics.ts`; integrations can listen to the data layer or `guardemar:analytics` browser event without changing CTA components.

## Validation

The deployment pipeline performs build validation. When changing routes, review generated route compatibility, internal links, metadata, the sitemap and mobile styles together.
