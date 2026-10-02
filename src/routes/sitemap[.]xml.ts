import { createFileRoute } from '@tanstack/react-router'
import { allPosts } from 'content-collections'

import { areas } from '@/config/site'

const siteUrl = 'https://guardemar.com'

// Date the static service pages were last materially revised. Bump it when
// commercial pages change so search engines re-crawl them.
const pagesLastReviewed = '2026-10-02'

const staticPages = [
  '/',
  '/property-management-algarve/',
  '/home-watch-algarve/',
  '/key-holding-algarve/',
  '/plans/',
  '/services/',
  '/property-handover-algarve/',
  '/arrival-preparation-algarve/',
  '/storm-property-checks-algarve/',
  '/contractor-access-algarve/',
  '/how-it-works/',
  '/inspection-checklist/',
  '/areas/',
  '/for-agents/',
  '/about/',
  '/about/hugo-goncalves/',
  '/contact/',
  '/blog/',
  '/privacy-policy/',
  '/cookie-policy/',
  '/terms/',
]

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function buildSitemap() {
  const latestPost = allPosts.map((post) => post.updated ?? post.date).sort().at(-1) ?? pagesLastReviewed
  const entries = [
    ...staticPages.map((path) => ({ path, lastmod: path === '/blog/' ? latestPost : pagesLastReviewed })),
    ...Object.keys(areas).map((slug) => ({ path: `/areas/${slug}/`, lastmod: pagesLastReviewed })),
    ...allPosts.map((post) => ({ path: `/blog/${post.slug}/`, lastmod: post.updated ?? post.date })),
  ]
  const urls = entries.map(({ path, lastmod }) => `  <url><loc>${escapeXml(`${siteUrl}${path}`)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => new Response(buildSitemap(), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } }),
    },
  },
})
