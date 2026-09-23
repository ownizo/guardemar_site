import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/property-care')({head:()=>pageHead({title:'Second-Home Management | Guardemar',description:'Guardemar manages privately used second homes in the Western Algarve. This address now points at that service.',path:'/property-care/',canonicalPath:'/property-management-algarve/',noindex:true}),component:()=> <StandardPageView pageKey="property-care" />})
