import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/holiday-home-care')({head:()=>pageHead({title:'Holiday Home Management | Guardemar',description:'Management for privately used holiday homes in the Western Algarve. Not a rental service.',path:'/holiday-home-care/',canonicalPath:'/property-management-algarve/',noindex:true}),component:()=> <StandardPageView pageKey="holiday-home-care" />})
