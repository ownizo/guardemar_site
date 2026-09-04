import { useEffect, useState } from 'react'

import { getPortalSupabase } from '@/lib/portal/supabase'

export function PrivateImage({ bucket, path, alt }: { bucket: 'inspection-photos' | 'staff-photos'; path: string; alt: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let active = true
    void getPortalSupabase().then((supabase) => supabase.storage.from(bucket).createSignedUrl(path, 900)).then(({ data }) => { if (active) setSrc(data?.signedUrl ?? '') })
    return () => { active = false }
  }, [bucket, path])
  return src ? <img src={src} alt={alt} loading="lazy" /> : <div className="photo-placeholder" aria-label="Loading private photograph" />
}
