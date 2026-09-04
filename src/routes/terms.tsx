import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
import { pageHead } from '@/lib/seo'
export const Route=createFileRoute('/terms')({head:()=>pageHead({title:'Terms & Conditions | Guardemar',description:'Website terms of use for Guardemar information, enquiries, quotations and property-care service presentation.',path:'/terms/'}),component:()=> <StandardPageView pageKey="terms" legal />})
