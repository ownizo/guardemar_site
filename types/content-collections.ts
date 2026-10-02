export type Post = {
  title: string
  summary: string
  categories: string[]
  slug: string
  image?: string
  date: string
  updated?: string
  seoTitle?: string
  author: string
  content: string
  readingTime: number
}

export declare const allPosts: Post[]
