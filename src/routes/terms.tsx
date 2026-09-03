import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
export const Route=createFileRoute('/terms')({head:()=>({meta:[{title:'Website Terms | Guardemar'}],links:[{rel:'canonical',href:'https://guardemar.com/terms/'}]}),component:()=> <StandardPageView pageKey="terms" legal />})
