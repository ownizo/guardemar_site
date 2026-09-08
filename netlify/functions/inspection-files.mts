import type { Config, Context } from '@netlify/functions'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import PDFDocument from 'pdfkit'
import sharp from 'sharp'
import { z } from 'zod'

import { business } from '../../src/config/site.ts'
import { mediaForArea, type ClientInspectionReport, type InspectionArea, type InspectionMedia } from '../../src/lib/portal/types.ts'

const EXPECTED_SUPABASE_REF = 'ablktbpledjceddessyg'
const UUID = z.string().uuid()

type AuthorisedInspection = {
  report: ClientInspectionReport
  supabase: SupabaseClient
}

function jsonError(status: number, message: string) {
  return Response.json({ error: { code: status === 401 ? 'AUTHENTICATION_ERROR' : 'AUTHORIZATION_ERROR', message, stage: 'inspection_file' } }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function safePart(value: string, fallback: string) {
  const cleaned = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned.slice(0, 80) || fallback
}

function inspectionDate(report: ClientInspectionReport) {
  return new Date(report.scheduled_for).toISOString().slice(0, 10)
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value))
}

function displayTime(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' }).format(new Date(value)) : null
}

function statusLabel(value: string) {
  return value.replaceAll('_', ' ').toUpperCase()
}

function photoExtension(contentType: string | null, storagePath: string) {
  const byType: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' }
  return byType[contentType ?? ''] ?? storagePath.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'jpg'
}

async function authorise(req: Request, inspectionId: string): Promise<AuthorisedInspection | Response> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const url = Netlify.env.get('SUPABASE_URL')
  const publishableKey = Netlify.env.get('SUPABASE_PUBLISHABLE_KEY')
  if (!token || !url || !publishableKey) return jsonError(401, 'Your session has expired. Please sign in again.')
  if (new URL(url).hostname.split('.')[0] !== EXPECTED_SUPABASE_REF) return jsonError(503, 'Inspection files are temporarily unavailable.')

  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) return jsonError(401, 'Your session has expired. Please sign in again.')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle()
  if (!profile || profile.role !== 'customer') return jsonError(403, 'This customer report is not available to this account.')

  const { data, error } = await supabase.rpc('get_customer_inspection', { inspection_uuid: inspectionId })
  if (error || !data) return jsonError(404, 'This inspection report is unavailable or has expired.')
  return { report: data as ClientInspectionReport, supabase }
}

function findMedia(report: ClientInspectionReport, mediaId: string) {
  for (const area of report.areas) {
    const items = mediaForArea(area)
    const mediaIndex = items.findIndex((item) => item.id === mediaId)
    if (mediaIndex >= 0) return { area, media: items[mediaIndex], mediaIndex }
  }
  return null
}

async function downloadStorage(supabase: SupabaseClient, bucket: 'inspection-photos' | 'staff-photos', path: string) {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) throw new Error('Private photograph could not be loaded.')
  return { buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type || null }
}

async function renderImage(buffer: Buffer, size: 'thumbnail' | 'display' | 'pdf') {
  const settings = size === 'thumbnail'
    ? { width: 520, height: 390, quality: 72 }
    : size === 'display'
      ? { width: 1800, height: 1350, quality: 84 }
      : { width: 1200, height: 900, quality: 78 }
  return sharp(buffer).rotate().resize({ width: settings.width, height: settings.height, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: settings.quality, mozjpeg: true }).toBuffer()
}

async function collectPdf(document: PDFKit.PDFDocument) {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    document.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    document.on('end', () => resolve(Buffer.concat(chunks)))
    document.on('error', reject)
    document.end()
  })
}

function ensureSpace(document: PDFKit.PDFDocument, height: number) {
  if (document.y + height > document.page.height - 92) document.addPage()
}

function writeLabelValue(document: PDFKit.PDFDocument, label: string, value: string) {
  document.fillColor('#60717c').font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), { continued: true })
  document.fillColor('#172f44').font('Helvetica').fontSize(9).text(`  ${value}`)
}

function durationLabel(seconds: number | null | undefined) {
  if (!seconds) return null
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

// Video is never embedded playable into the PDF -- a clean evidence tile
// records that it exists (poster frame if one was captured, caption,
// duration) and points the reader to the client portal, which is where
// portal authentication actually gates access to the video itself.
async function renderVideoTile(document: PDFKit.PDFDocument, supabase: SupabaseClient, contentWidth: number, media: InspectionMedia, caption: string) {
  const tileHeight = 130
  ensureSpace(document, tileHeight + 30)
  const top = document.y
  document.roundedRect(48, top, contentWidth, tileHeight, 4).fillAndStroke('#101c27', '#101c27')
  if (media.poster_storage_path) {
    try {
      const source = await downloadStorage(supabase, 'inspection-photos', media.poster_storage_path)
      const poster = await renderImage(source.buffer, 'pdf')
      document.image(poster, 48, top, { fit: [140, tileHeight], align: 'center', valign: 'center' })
    } catch {
      // fall through to the plain tile below
    }
  }
  document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9).text('VIDEO EVIDENCE', 200, top + 18, { width: contentWidth - 160 })
  const duration = durationLabel(media.duration_seconds)
  if (duration) document.fillColor('#c3d2da').font('Helvetica').fontSize(8).text(`Duration ${duration}`, 200, top + 36, { width: contentWidth - 160 })
  document.fillColor('#d6e2e8').font('Helvetica').fontSize(8).text('Video available in the Guardemar client portal.', 200, top + (duration ? 54 : 40), { width: contentWidth - 160 })
  if (media.caption) document.fillColor('#9fb2bc').font('Helvetica-Oblique').fontSize(7.5).text(media.caption, 200, top + (duration ? 72 : 58), { width: contentWidth - 160 })
  document.y = top + tileHeight + 5
  document.fillColor('#60717c').font('Helvetica').fontSize(7).text(caption, { align: 'center' })
  document.moveDown(.8)
}

async function createPdf(req: Request, authorised: AuthorisedInspection) {
  const { report, supabase } = authorised
  const document = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: {
    Title: `${business.name} Property Inspection Report — ${report.property.display_name}`,
    Author: business.name,
    Subject: `Published property inspection ${report.id}`,
  } })
  const pdfPromise = collectPdf(document)
  const pageWidth = document.page.width
  const contentWidth = pageWidth - 96

  document.rect(0, 0, pageWidth, 205).fill('#06275a')
  try {
    const logoResponse = await fetch(new URL('/guardemar-logo.svg', req.url))
    if (logoResponse.ok) {
      const logo = await sharp(Buffer.from(await logoResponse.arrayBuffer())).png().resize({ width: 185 }).toBuffer()
      document.image(logo, 48, 34, { width: 185 })
    } else throw new Error('Logo unavailable')
  } catch {
    document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(business.name, 48, 38)
  }
  document.fillColor('#d6e2e8').font('Helvetica-Bold').fontSize(8).text(business.descriptor.toUpperCase(), 48, 78, { characterSpacing: 1.5 })
  document.fillColor('#ffffff').font('Helvetica').fontSize(27).text('Property Inspection Report', 48, 112)
  document.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text(report.property.display_name, 48, 153)
  document.fillColor('#d6e2e8').font('Helvetica').fontSize(9).text(displayDate(report.scheduled_for), 48, 177)
  document.y = 228

  const location = [report.property.address_line_1, report.property.address_line_2, report.property.postal_code, report.property.locality, report.property.municipality, report.property.country].filter(Boolean).join(', ')
  writeLabelValue(document, 'Property location', location || report.property.locality)
  writeLabelValue(document, 'Inspection date', displayDate(report.scheduled_for))
  const startTime = displayTime(report.started_at)
  const completedTime = displayTime(report.completed_at)
  if (startTime || completedTime) writeLabelValue(document, 'Inspection time', [startTime && `Started ${startTime}`, completedTime && `completed ${completedTime}`].filter(Boolean).join(' · '))
  if (report.inspector) writeLabelValue(document, 'Inspector', `${report.inspector.display_name} · ${report.inspector.role_title}`)

  document.moveDown(.8)
  document.roundedRect(48, document.y, contentWidth, 43, 4).fill('#edf4f6')
  document.fillColor('#536875').font('Helvetica-Bold').fontSize(8).text('OVERALL INSPECTION STATUS', 62, document.y + 11)
  document.fillColor(report.overall_condition === 'urgent' ? '#9b2638' : report.overall_condition === 'attention' ? '#9a5b1e' : '#24634c').font('Helvetica-Bold').fontSize(14).text(statusLabel(report.overall_condition), 315, document.y - 3, { align: 'right', width: 215 })
  document.y += 58

  if (report.client_summary) {
    document.fillColor('#0b4f78').font('Helvetica-Bold').fontSize(8).text('FINAL GUARDEMAR SUMMARY', { characterSpacing: 1 })
    document.moveDown(.45).fillColor('#172f44').font('Helvetica').fontSize(10).text(report.client_summary, { lineGap: 3 })
    document.moveDown(1)
  }

  for (const [areaIndex, area] of report.areas.entries()) {
    ensureSpace(document, 100)
    document.moveTo(48, document.y).lineTo(pageWidth - 48, document.y).strokeColor('#cad5da').stroke()
    document.moveDown(.9)
    document.fillColor('#0b4f78').font('Helvetica-Bold').fontSize(7).text(area.area_type.toUpperCase(), { characterSpacing: 1 })
    document.fillColor('#06275a').font('Helvetica-Bold').fontSize(17).text(area.custom_label, { continued: true })
    document.fillColor(area.status === 'urgent' ? '#9b2638' : area.status === 'attention' ? '#9a5b1e' : '#24634c').font('Helvetica-Bold').fontSize(9).text(statusLabel(area.status), { align: 'right' })
    document.moveDown(.4)

    for (const item of area.items) {
      ensureSpace(document, 46)
      const itemTop = document.y
      document.fillColor('#172f44').font('Helvetica-Bold').fontSize(9).text(item.label, 48, itemTop, { width: 330 })
      document.fillColor(item.status === 'urgent' ? '#9b2638' : item.status === 'attention' ? '#9a5b1e' : '#24634c').font('Helvetica-Bold').fontSize(8).text(statusLabel(item.status), 408, itemTop, { align: 'right', width: 138 })
      document.y = Math.max(document.y, itemTop + 15)
      if (item.observation) document.fillColor('#475b68').font('Helvetica').fontSize(8).text(`Observation: ${item.observation}`, { lineGap: 2 })
      if (item.recommendation) document.fillColor('#475b68').font('Helvetica').fontSize(8).text(`Recommendation: ${item.recommendation}`, { lineGap: 2 })
      document.moveDown(.55)
    }

    if (area.observation || area.recommendation) {
      ensureSpace(document, 60)
      document.rect(48, document.y, 3, 48).fill('#0b6f95')
      if (area.observation) document.fillColor('#172f44').font('Helvetica-Bold').fontSize(8).text('Observation', 61, document.y).font('Helvetica').text(area.observation, { width: 475, lineGap: 2 })
      if (area.recommendation) document.moveDown(.4).fillColor('#172f44').font('Helvetica-Bold').fontSize(8).text('Recommendation', 61).font('Helvetica').text(area.recommendation, { width: 475, lineGap: 2 })
      document.moveDown(.8)
    }

    for (const [mediaIndex, media] of mediaForArea(area).entries()) {
      const item = area.items.find((candidate) => candidate.id === media.inspection_item_id)
      const caption = [`${areaIndex + 1}.${mediaIndex + 1}`, item?.label, media.caption].filter(Boolean).join(' · ')
      if (media.media_type === 'video') {
        await renderVideoTile(document, supabase, contentWidth, media, caption)
        continue
      }
      try {
        const source = await downloadStorage(supabase, 'inspection-photos', media.storage_path)
        const image = await renderImage(source.buffer, 'pdf')
        ensureSpace(document, 250)
        document.image(image, 48, document.y, { fit: [contentWidth, 220], align: 'center', valign: 'center' })
        document.y += 225
        document.fillColor('#60717c').font('Helvetica').fontSize(7).text(caption, { align: 'center' })
        document.moveDown(.8)
      } catch (error) {
        console.error('PDF photograph omitted', { inspectionId: report.id, mediaId: media.id, message: error instanceof Error ? error.message : 'Unknown error' })
      }
    }
    document.moveDown(.8)
  }

  const pageRange = document.bufferedPageRange()
  for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex += 1) {
    document.switchToPage(pageIndex)
    const footerY = document.page.height - 62
    document.moveTo(48, footerY - 8).lineTo(document.page.width - 48, footerY - 8).strokeColor('#cad5da').stroke()
    document.fillColor('#405766').font('Helvetica-Bold').fontSize(7).text(`${business.name} · ${business.descriptor} · ${business.tagline}`, 48, footerY, { width: 320 })
    document.fillColor('#60717c').font('Helvetica').fontSize(6.5).text('This report records a visual property-care inspection carried out by Guardemar. It is not a structural survey, engineering inspection or technical certification.', 48, footerY + 12, { width: 390 })
    document.fillColor('#60717c').font('Helvetica').fontSize(6.5).text(`guardemar.com · ${business.email} · ${business.phone}\nReport ${report.id} · Page ${pageIndex + 1} of ${pageRange.count}`, 420, footerY, { align: 'right', width: 126 })
  }

  const buffer = await pdfPromise
  const filename = `Guardemar_${safePart(report.property.display_name, 'Property')}_${inspectionDate(report)}_Inspection.pdf`
  return new Response(buffer, { headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } })
}

async function createMediaResponse(authorised: AuthorisedInspection, mediaId: string, action: 'thumbnail' | 'display' | 'download') {
  const match = findMedia(authorised.report, mediaId)
  if (!match) return jsonError(404, 'Photograph not found.')
  if (match.media.media_type === 'video') {
    // The frontend never requests this route for a video (it uses a direct
    // signed Supabase Storage URL instead -- see PrivateVideo/downloadSignedMedia);
    // this only guards a stale or hand-crafted request.
    return jsonError(404, 'Video is served directly from the client portal, not this route.')
  }
  const source = await downloadStorage(authorised.supabase, 'inspection-photos', match.media.storage_path)
  const item = match.area.items.find((candidate) => candidate.id === match.media.inspection_item_id)
  const extension = action === 'download' ? photoExtension(source.contentType, match.media.storage_path) : 'jpg'
  const buffer = action === 'download' ? source.buffer : await renderImage(source.buffer, action)
  const filename = `Guardemar_${safePart(authorised.report.property.display_name, 'Property')}_${inspectionDate(authorised.report)}_${safePart(match.area.custom_label, 'Area')}_${String(match.mediaIndex + 1).padStart(2, '0')}.${extension}`
  return new Response(buffer, { headers: {
    'Content-Type': action === 'download' ? source.contentType || 'application/octet-stream' : 'image/jpeg',
    'Content-Disposition': `${action === 'download' ? 'attachment' : 'inline'}; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Guardemar-Photo-Context': safePart(item?.label ?? match.area.custom_label, 'Inspection-photo'),
  } })
}

async function createInspectorPhotoResponse(authorised: AuthorisedInspection) {
  const path = authorised.report.inspector?.profile_photo_path
  if (!path) return jsonError(404, 'Inspector photograph not found.')
  const source = await downloadStorage(authorised.supabase, 'staff-photos', path)
  const buffer = await sharp(source.buffer).rotate().resize({ width: 320, height: 320, fit: 'cover', position: 'attention', withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  return new Response(buffer, { headers: {
    'Content-Type': 'image/jpeg',
    'Content-Disposition': 'inline; filename="Guardemar-inspector.jpg"',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } })
}

// Photographs only. Videos are deliberately excluded from server-side ZIP
// generation: a Netlify Function has limited execution time and buffers its
// whole response in memory, and a 60-second inspection video can be tens of
// megabytes -- fine one at a time via its own signed URL (see
// PrivateVideo/downloadSignedMedia), unsafe to download+re-buffer several of
// at once inside a serverless function. The customer portal instead
// downloads each video individually, direct from Supabase Storage, when the
// visitor clicks "Download all media" and there are videos present.
async function createZip(authorised: AuthorisedInspection) {
  const zip = new JSZip()
  let sequence = 0
  for (const [areaIndex, area] of authorised.report.areas.entries()) {
    const images = mediaForArea(area).filter((item) => item.media_type !== 'video')
    for (const [imageIndex, media] of images.entries()) {
      const source = await downloadStorage(authorised.supabase, 'inspection-photos', media.storage_path)
      const extension = photoExtension(source.contentType, media.storage_path)
      sequence += 1
      zip.file(`${String(sequence).padStart(2, '0')}_${safePart(area.custom_label, `Area-${areaIndex + 1}`)}_${String(imageIndex + 1).padStart(2, '0')}.${extension}`, source.buffer)
    }
  }
  if (sequence === 0) return jsonError(404, 'This inspection has no client photographs to download.')
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 4 } })
  const filename = `Guardemar_${safePart(authorised.report.property.display_name, 'Property')}_${inspectionDate(authorised.report)}_Photos.zip`
  return new Response(buffer, { headers: {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } })
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'GET') return jsonError(405, 'Method not allowed.')
  const pathname = new URL(req.url).pathname.replace(/^\/api\/portal\/inspection-files\/?/, '')
  const segments = pathname.split('/').filter(Boolean)

  try {
    const inspectionId = UUID.parse(segments[0])
    const authorised = await authorise(req, inspectionId)
    if (authorised instanceof Response) return authorised
    if (segments[1] === 'pdf' && segments.length === 2) return await createPdf(req, authorised)
    if (segments[1] === 'media' && segments[2] === 'photos-zip' && segments.length === 3) return await createZip(authorised)
    if (segments[1] === 'inspector' && segments[2] === 'display' && segments.length === 3) return await createInspectorPhotoResponse(authorised)
    if (segments[1] === 'media' && segments[2] && ['thumbnail', 'display', 'download'].includes(segments[3])) {
      return await createMediaResponse(authorised, UUID.parse(segments[2]), segments[3] as 'thumbnail' | 'display' | 'download')
    }
    return jsonError(404, 'Inspection file not found.')
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError(404, 'Inspection file not found.')
    console.error('Inspection file request failed', { requestId: context.requestId, path: new URL(req.url).pathname, message: error instanceof Error ? error.message : 'Unknown error' })
    return jsonError(500, 'The inspection file could not be prepared. Please try again.')
  }
}

export const config: Config = {
  path: '/api/portal/inspection-files/*',
}
