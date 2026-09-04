import { createFileRoute, notFound } from '@tanstack/react-router'

import { FutureLocalePage, isFutureLocale } from '@/components/future-locale-page'
import { futureLanguageAlternates, pageHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/')({
  loader: ({ params }) => { if (!isFutureLocale(params.locale)) throw notFound(); return { locale: params.locale } },
  head: ({ loaderData }) => pageHead({ title: `GUARDEMAR | Private Property Care | ${loaderData?.locale.toUpperCase()}`, description: 'Reserved route for a future professional translation of the Guardemar homepage.', path: `/${loaderData?.locale}/`, noindex: true, alternates: futureLanguageAlternates('/') }),
  component: () => <FutureLocalePage locale={Route.useLoaderData().locale} page="home" />,
})
