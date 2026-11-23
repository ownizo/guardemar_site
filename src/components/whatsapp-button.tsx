import { MessageCircle } from 'lucide-react'

import { AnalyticsLink } from '@/components/site'
import { business } from '@/config/site'

// Floating WhatsApp contact on public pages. Opens a chat with Guardemar
// (app on mobile, WhatsApp Web on desktop) with a short message prefilled.
export function WhatsAppButton() {
  return (
    <AnalyticsLink href={business.whatsapp} event="whatsapp_click" className="whatsapp-float" aria-label="Message Guardemar on WhatsApp">
      <MessageCircle size={24} aria-hidden="true" />
      <span className="whatsapp-float-label">WhatsApp</span>
    </AnalyticsLink>
  )
}
