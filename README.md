# GUARDEMAR — Private Property Care

Production website for GUARDEMAR, serving overseas owners of holiday homes and second homes across the Western Algarve, from Carvoeiro to Sagres.

## Technology

- TanStack Start, TanStack Router, React 19 and TypeScript
- Tailwind CSS 4 with the editorial design system in `src/styles.css`
- Content Collections for Markdown articles
- Netlify Forms for property assessment enquiries
- Netlify deployment adapter and redirect rules

## Local Development

Install dependencies with `pnpm install`, then run `pnpm dev`. For complete Netlify emulation use `netlify dev --port 8889`.

Netlify runs the production build configured in `netlify.toml` and publishes `dist/client`.

## Content Architecture

- `src/routes/` contains all public routes and route-level metadata.
- `src/components/` contains shared layout, conversion, report, author and editorial components.
- `src/config/site.ts` is the source of truth for business details, founder details, navigation, plans, FAQs and service areas.
- `src/config/pages.ts` contains reusable standard and legal page content.
- `src/config/services.ts` contains the deep standalone service-page content.
- `content/posts/` contains Markdown articles.
- `content-collections.ts` validates article frontmatter and calculates reading time.

## Business Data and Pricing

Edit `business` in `src/config/site.ts` for the address, phone, email, WhatsApp link, territory and LocalBusiness schema. Edit `founder` there for Hugo Gonçalves’s short biography and Person schema.

All monthly plan prices, plan labels and inclusions live in the `plans` array in `src/config/site.ts`. Do not duplicate prices in route components or editorial copy.

## Adding an Area

Add a unique slug to `areas` in `src/config/site.ts`. Include a genuinely local property profile, property types, absence pattern, environmental considerations and nearby coverage. The dynamic route at `src/routes/areas.$area.tsx` supplies the shared layout, Service schema, internal links and CTA.

Add the canonical area URL to `public/sitemap.xml` after checking that the slug is unique.

## Adding a Service Page

Add the full service scope to `src/config/services.ts`, including who it is for, inclusions, exclusions, why it matters and a realistic scenario. Create a small route file in `src/routes/` that supplies the title, description and canonical URL to `DeepServicePage`.

Regenerate `src/routeTree.gen.ts` through the TanStack Router generator used by the development tooling. Add the canonical URL to `public/sitemap.xml` and link it from the relevant service hub, area page or article.

## Adding a Blog Article

Create a Markdown file in `content/posts/` with `date`, `title`, `summary`, `categories`, `slug` and `author`. Use `Hugo Gonçalves` for founder-authored editorial content. Keep the introduction specific, use descriptive headings and add only useful links to relevant services, areas, plans or supporting articles.

Add the canonical article URL to `public/sitemap.xml`. Article pages automatically include reading time, related content, the reusable author profile and Article structured data.

## SEO Architecture

Each indexable route defines a unique title, human-written meta description and canonical URL. Shared root metadata sets language, indexability, Open Graph defaults and Twitter card defaults.

Structured data is deliberately limited to relevant types:

- LocalBusiness, Organization and WebSite in `src/config/site.ts`
- Person for Hugo Gonçalves
- Service on commercial and local service pages
- Article on editorial pages
- BreadcrumbList through the shared breadcrumb component
- FAQPage only where the visible FAQ component is rendered

The canonical host is `https://guardemar.com`. `netlify.toml` redirects the `www` host and retired commercial URLs directly to their preferred canonical destinations. Public pages use trailing slashes in canonical URLs and internal navigation.

`public/robots.txt` allows crawling and points to `public/sitemap.xml`. The sitemap is a deliberately reviewed static file copied to the site root during deployment. Update it whenever a public service, area, author or article URL is added or removed.

## Search Console Submission

After deployment, add the domain property in Google Search Console and submit `https://guardemar.com/sitemap.xml` in the Sitemaps section. Confirm that `/robots.txt` and `/sitemap.xml` return successfully before submission.

Inspect and request indexing for these priority URLs first:

1. `/`
2. `/property-care/`
3. `/home-watch-algarve/`
4. `/property-management-algarve/`
5. `/plans/`
6. `/inspection-checklist/`
7. `/areas/lagos/`
8. `/areas/praia-da-luz/`
9. `/blog/`
10. `/blog/looking-after-holiday-home-algarve/`

Use URL Inspection to confirm the selected canonical, mobile rendering and indexing status. Resubmit the sitemap after significant route changes rather than after minor copy edits.

## Forms

`src/components/assessment-form.tsx` posts URL-encoded submissions to `/__forms.html`. Every React field name must also exist in `public/__forms.html`, which registers the form with Netlify during deployment.

## Analytics Hooks

`src/lib/analytics.ts` defines events for assessment form start and submit, phone, email, WhatsApp, plan, service, area and blog CTA clicks. Events push to `window.dataLayer` when available and emit the `guardemar:analytics` browser event. No third-party analytics ID is installed by the codebase.

## Author Architecture

The reusable author component is exported from `src/components/site.tsx`. It links editorial content to `/about/hugo-goncalves/` without repeating the full biography beneath every article. The About page and author page use the central founder data and Person schema from `src/config/site.ts`.
