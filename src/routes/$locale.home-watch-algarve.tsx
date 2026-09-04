import { createFileRoute, notFound } from '@tanstack/react-router'

import { FutureLocalePage, isFutureLocale } from '@/components/future-locale-page'
import { futureLanguageAlternates, pageHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/home-watch-algarve')({
  loader: ({ params }) => { if (!isFutureLocale(params.locale)) throw notFound(); return { locale: params.locale } },
  head: ({ loaderData }) => pageHead({ title: `Home Watch Algarve | ${loaderData?.locale.toUpperCase()}`, description: 'Reserved route for a future professional translation of the Guardemar home watch service.', path: `/${loaderData?.locale}/home-watch-algarve/`, noindex: true, alternates: futureLanguageAlternates('/home-watch-algarve/') }),
  component: () => <FutureLocalePage locale={Route.useLoaderData().locale} page="home-watch" />,
})
