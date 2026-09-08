import { useEffect, useState } from 'react'

import { getPortalSupabase } from '@/lib/portal/supabase'

// Video is never proxied through a Netlify Function (no processing pipeline
// exists for it, and buffering a whole video in a serverless function risks
// its memory/time limits) -- the browser's <video> element points directly
// at a short-lived signed Supabase Storage URL, requested with the viewer's
// own authenticated session, exactly like PrivateImage already does for
// images. Storage RLS (inspection_storage_staff_select /
// inspection_storage_customer_select) is what actually authorises access;
// the URL itself is unguessable and expires in 30 minutes.
const SIGNED_URL_TTL_SECONDS = 1800

export function PrivateVideo({ path, posterPath, caption }: { path: string; posterPath?: string | null; caption?: string | null }) {
  const [src, setSrc] = useState('')
  const [poster, setPoster] = useState('')
  useEffect(() => {
    let active = true
    void getPortalSupabase().then(async (supabase) => {
      const bucket = supabase.storage.from('inspection-photos')
      const [video, posterResult] = await Promise.all([
        bucket.createSignedUrl(path, SIGNED_URL_TTL_SECONDS),
        posterPath ? bucket.createSignedUrl(posterPath, SIGNED_URL_TTL_SECONDS) : Promise.resolve({ data: null }),
      ])
      if (!active) return
      setSrc(video.data?.signedUrl ?? '')
      setPoster(posterResult.data?.signedUrl ?? '')
    })
    return () => { active = false }
  }, [path, posterPath])

  if (!src) return <div className="photo-placeholder" aria-label="Loading private video" />
  return (
    <video controls preload="metadata" poster={poster || undefined} aria-label={caption || 'Inspection video'}>
      <source src={src} />
    </video>
  )
}

export async function downloadSignedMedia(bucket: 'inspection-photos', path: string, filename: string) {
  const supabase = await getPortalSupabase()
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: filename })
  if (!data?.signedUrl) return
  const link = document.createElement('a')
  link.href = data.signedUrl
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
}
