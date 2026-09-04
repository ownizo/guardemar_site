import { createFileRoute, notFound } from '@tanstack/react-router'

import { FutureLocalePage, isFutureLocale } from '@/components/future-locale-page'
import { futureLanguageAlternates, pageHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/plans')({
  loader: ({ params }) => { if (!isFutureLocale(params.locale)) throw notFound(); return { locale: params.locale } },
  head: ({ loaderData }) => pageHead({ title: `Property Care Plans | ${loaderData?.locale.toUpperCase()}`, description: 'Reserved route for a future professional translation of the Guardemar care plans.', path: `/${loaderData?.locale}/plans/`, noindex: true, alternates: futureLanguageAlternates('/plans/') }),
  component: () => <FutureLocalePage locale={Route.useLoaderData().locale} page="plans" />,
})
