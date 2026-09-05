import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const path = process.argv[2] || 'legal/guardemar-general-terms-v2.5.md'
const expectedSha256 = '7bdf2ed911c1c6f312e20a985c8e40ddc09af5b7e401925a9c3ffd49d6bf76fd'
const document = await readFile(path)
const text = document.toString('utf8')
if (!text.includes('# GUARDEMAR — General Terms and Conditions of Service')) {
  console.error('The document title does not match the approved Guardemar Version 2.5 title.')
  process.exit(1)
}
if (!text.includes('**Version 2.5 — in force from 5 September 2026.**')) {
  console.error('The required effective-date line is missing or differs from the approved wording.')
  process.exit(1)
}
if (Buffer.from(text, 'utf8').compare(document) !== 0) {
  console.error('The document must be plain UTF-8 without undecodable bytes.')
  process.exit(1)
}

const sha256 = createHash('sha256').update(document).digest('hex')
if (sha256 !== expectedSha256) {
  console.error('The document differs from the approved canonical Version 2.5 file.')
  process.exit(1)
}
console.log('Version: 2.5')
console.log('Effective date: 2026-09-05')
console.log(`UTF-8 bytes: ${document.byteLength}`)
console.log(`SHA-256: ${sha256}`)
