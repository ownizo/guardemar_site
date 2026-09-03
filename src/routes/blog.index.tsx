import { createFileRoute } from '@tanstack/react-router'
import { allPosts } from 'content-collections'
import BlogPosts from '@/components/blog-posts'
import { AssessmentCta, Breadcrumbs, PageHero } from '@/components/site'

export const Route=createFileRoute('/blog/')({head:()=>({meta:[{title:'Property Care Insights | Guardemar'},{name:'description',content:'Practical guides for overseas owners of holiday homes, villas and second homes in the Algarve.'}],links:[{rel:'canonical',href:'https://guardemar.com/blog/'}]}),component:BlogPage})
function BlogPage(){return <><Breadcrumbs items={[{label:'Home',to:'/'},{label:'Insights'}]}/><PageHero eyebrow="Insights for overseas owners" title="Practical knowledge for looking after a home in Portugal." text="Clear, useful guidance on vacant-home risks, inspections, humidity, arrivals, storms and coordinating care from another country." aside="Written to help owners make informed decisions — without alarmism or thin search-engine copy."/><section className="section shell"><BlogPosts posts={allPosts}/></section><AssessmentCta/></>}
