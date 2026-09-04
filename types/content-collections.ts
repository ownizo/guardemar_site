export type Post = {
  title: string
  summary: string
  categories: string[]
  slug: string
  image?: string
  date: string
  author: string
  content: string
  readingTime: number
}

export declare const allPosts: Post[]
