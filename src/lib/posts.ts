import { allPosts } from 'content-collections'

// Articles kept online for existing links but excluded from the index,
// category pages, related articles and the sitemap (marked noindex).
export const listedPosts = allPosts.filter((post) => !post.noindex)
