import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/second-home-care-algarve')({head:()=>pageHead({title:'Second Home Care Algarve, Portugal | Guardemar',description:'A trusted local presence for overseas owners of apartments, villas and second homes in the Western Algarve.',path:'/second-home-care-algarve/'}),component:()=> <StandardPageView pageKey="second-home-care-algarve" />})
