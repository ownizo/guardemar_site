import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/cookie-policy')({head:()=>pageHead({title:'Cookie Policy | Guardemar',description:'How Guardemar uses browser storage and manages consent for optional website technologies.',path:'/cookie-policy/'}),component:()=> <StandardPageView pageKey="cookie-policy" legal />})
