// content-collections.ts
import { defineCollection, defineConfig } from "@content-collections/core";
import { z } from "zod";
var posts = defineCollection({
  name: "posts",
  directory: "content/posts",
  include: "**/*.md",
  schema: z.object({ title: z.string(), summary: z.string(), categories: z.array(z.string()), slug: z.string(), image: z.string().optional(), date: z.string(), author: z.string().default("Guardemar"), content: z.string() }),
  transform: async (doc) => ({ ...doc, readingTime: Math.max(3, Math.ceil(doc.content.split(/\s+/).length / 210)) })
});
var content_collections_default = defineConfig({ collections: [posts] });
export {
  content_collections_default as default
};
