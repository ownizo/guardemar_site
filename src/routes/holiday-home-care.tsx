import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/holiday-home-care')({head:()=>pageHead({title:'Holiday Home Care Algarve | Guardemar',description:'Practical care and scheduled inspections for privately owned holiday homes across the Western Algarve.',path:'/holiday-home-care/'}),component:()=> <StandardPageView pageKey="holiday-home-care" />})
