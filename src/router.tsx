import { createRouter } from '@tanstack/react-router'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Keep URLs exactly as linked. The default ('never') made the server
    // 307-redirect every canonical "/page/" URL to "/page"; public pages are
    // normalised to the trailing-slash form in src/start.ts instead.
    trailingSlash: 'preserve',
  })

  return router
}
