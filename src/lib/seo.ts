const siteUrl = 'https://guardemar.com'
const defaultImage = `${siteUrl}/guardemar-og.png`

type PageHeadOptions = {
  title: string
  description: string
  path: string
  image?: string
  type?: 'website' | 'article'
  noindex?: boolean
  alternates?: Array<{ hrefLang: string; path: string }>
}

export function pageHead({ title, description, path, image = defaultImage, type = 'website', noindex = false, alternates = [] }: PageHeadOptions) {
  const url = `${siteUrl}${path}`
  const imageUrl = image.startsWith('http') ? image : `${siteUrl}${image}`

  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { name: 'robots', content: noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:type', content: type },
      { property: 'og:image', content: imageUrl },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'GUARDEMAR private property care in the Western Algarve' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: imageUrl },
    ],
    links: [
      { rel: 'canonical', href: url },
      ...alternates.map(({ hrefLang, path: alternatePath }) => ({ rel: 'alternate', hrefLang, href: `${siteUrl}${alternatePath}` })),
    ],
  }
}

export const futureLanguageAlternates = (path: string) => [
  { hrefLang: 'en-GB', path },
  { hrefLang: 'de', path: `/de${path}` },
  { hrefLang: 'nl', path: `/nl${path}` },
  { hrefLang: 'fr', path: `/fr${path}` },
  { hrefLang: 'x-default', path },
]
