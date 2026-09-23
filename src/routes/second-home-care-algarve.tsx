import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/second-home-care-algarve')({head:()=>pageHead({title:'Second-Home Management Algarve | Guardemar',description:'Second-home management for overseas owners in the Western Algarve.',path:'/second-home-care-algarve/',canonicalPath:'/property-management-algarve/',noindex:true}),component:()=> <StandardPageView pageKey="second-home-care-algarve" />})
