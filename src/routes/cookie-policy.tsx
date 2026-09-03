import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
export const Route=createFileRoute('/cookie-policy')({head:()=>({meta:[{title:'Cookie Policy | Guardemar'}],links:[{rel:'canonical',href:'https://guardemar.com/cookie-policy/'}]}),component:()=> <StandardPageView pageKey="cookie-policy" legal />})
