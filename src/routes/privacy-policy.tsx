import { createFileRoute } from '@tanstack/react-router'; import { StandardPageView } from '@/components/standard-page'
export const Route=createFileRoute('/privacy-policy')({head:()=>({meta:[{title:'Privacy Policy | Guardemar'}],links:[{rel:'canonical',href:'https://guardemar.com/privacy-policy/'}]}),component:()=> <StandardPageView pageKey="privacy-policy" legal />})
