import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/home-watch')({head:()=>pageHead({title:'Home Watch Algarve | Documented Property Inspections',description:'Structured home watch inspections with photographic digital reports for vacant and second homes across the Western Algarve.',path:'/home-watch-algarve/'}),component:()=> <StandardPageView pageKey="home-watch" />})
