import { createMiddleware, createStart } from '@tanstack/react-start'

import { canonicalTrailingSlashPath } from './lib/trailing-slash.ts'

const trailingSlashRedirect = createMiddleware({ type: 'request' }).server(({ request, next }) => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    const url = new URL(request.url)
    const target = canonicalTrailingSlashPath(url.pathname)
    if (target) return new Response(null, { status: 301, headers: { Location: `${target}${url.search}` } })
  }
  return next()
})

export const startInstance = createStart(() => ({ requestMiddleware: [trailingSlashRedirect] }))
