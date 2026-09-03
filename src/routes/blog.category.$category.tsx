import { createFileRoute } from '@tanstack/react-router'
import { allPosts } from 'content-collections'
import BlogPosts from '@/components/blog-posts'
import { Breadcrumbs, PageHero } from '@/components/site'
export const Route=createFileRoute('/blog/category/$category')({loader:({params})=>({category:params.category,posts:allPosts.filter(post=>post.categories.map(c=>c.toLowerCase().replaceAll(' ','-')).includes(params.category))}),head:({loaderData})=>({meta:[{title:`${loaderData?.category} Property Care Guides | Guardemar`}]}),component:CategoryPage})
function CategoryPage(){const {category,posts}=Route.useLoaderData();const title=category.replaceAll('-',' ').replace(/\b\w/g,l=>l.toUpperCase());return <><Breadcrumbs items={[{label:'Home',to:'/'},{label:'Insights',to:'/blog/'},{label:title}]}/><PageHero eyebrow="Insight category" title={title} text="Practical guidance for overseas property owners in the Algarve."/><section className="section shell"><BlogPosts posts={posts}/></section></>}
