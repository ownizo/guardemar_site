import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/privacy-policy')({head:()=>pageHead({title:'Privacy Policy | Guardemar',description:'How Guardemar handles personal information for website enquiries and property-care services under the GDPR.',path:'/privacy-policy/'}),component:()=> <StandardPageView pageKey="privacy-policy" legal />})
