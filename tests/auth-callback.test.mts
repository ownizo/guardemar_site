import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { parseAuthCallback } from '../src/lib/portal/auth-callback.ts'

const ORIGIN = 'https://guardemar.com/auth/callback'

test('a valid recovery token_hash callback is recognised', () => {
  const parsed = parseAuthCallback(`${ORIGIN}?token_hash=abc123&type=recovery`)
  assert.deepEqual(parsed, { kind: 'token_hash', tokenHash: 'abc123', type: 'recovery' })
})

test('a valid invite token_hash callback is recognised', () => {
  const parsed = parseAuthCallback(`${ORIGIN}?token_hash=xyz789&type=invite`)
  assert.deepEqual(parsed, { kind: 'token_hash', tokenHash: 'xyz789', type: 'invite' })
})

test('a token_hash callback with an unsupported type fails closed', () => {
  const parsed = parseAuthCallback(`${ORIGIN}?token_hash=abc123&type=magiclink`)
  assert.equal(parsed.kind, 'unknown')
})

test('a token_hash callback with no type at all fails closed', () => {
  const parsed = parseAuthCallback(`${ORIGIN}?token_hash=abc123`)
  assert.equal(parsed.kind, 'unknown')
})

test('a PKCE code callback (with flow id) is recognised', () => {
  const parsed = parseAuthCallback(`${ORIGIN}?code=some-auth-code&sb_flow_id=flow-1`)
  assert.deepEqual(parsed, { kind: 'code', code: 'some-auth-code', flowId: 'flow-1' })
})

test('a PKCE code callback without a flow id is still recognised', () => {
  const parsed = parseAuthCallback(`${ORIGIN}?code=some-auth-code`)
  assert.deepEqual(parsed, { kind: 'code', code: 'some-auth-code', flowId: null })
})

test('a legacy implicit-grant recovery callback (hash fragment) is recognised', () => {
  const parsed = parseAuthCallback(`${ORIGIN}#access_token=at123&refresh_token=rt456&type=recovery&expires_in=3600&token_type=bearer`)
  assert.deepEqual(parsed, { kind: 'implicit', accessToken: 'at123', refreshToken: 'rt456', type: 'recovery' })
})

test('a legacy implicit-grant invite callback (hash fragment) is recognised', () => {
  const parsed = parseAuthCallback(`${ORIGIN}#access_token=at123&refresh_token=rt456&type=invite`)
  assert.deepEqual(parsed, { kind: 'implicit', accessToken: 'at123', refreshToken: 'rt456', type: 'invite' })
})

test('an implicit callback with an unsupported or missing type fails closed', () => {
  assert.equal(parseAuthCallback(`${ORIGIN}#access_token=at123&refresh_token=rt456&type=magiclink`).kind, 'unknown')
  assert.equal(parseAuthCallback(`${ORIGIN}#access_token=at123&refresh_token=rt456`).kind, 'unknown')
})

test('an explicit Supabase error in the query string is reported, even alongside other params', () => {
  const parsed = parseAuthCallback(`${ORIGIN}?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&code=stale-code`)
  assert.deepEqual(parsed, { kind: 'error', code: 'access_denied', description: 'Email link is invalid or has expired' })
})

test('an explicit Supabase error in the hash fragment is reported', () => {
  const parsed = parseAuthCallback(`${ORIGIN}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`)
  assert.equal(parsed.kind, 'error')
})

test('a URL with no recognised callback parameters is reported as missing, not invalid', () => {
  assert.deepEqual(parseAuthCallback(ORIGIN), { kind: 'missing' })
  assert.deepEqual(parseAuthCallback(`${ORIGIN}?utm_source=newsletter`), { kind: 'missing' })
})

test('token_hash takes precedence over a simultaneously-present code', () => {
  const parsed = parseAuthCallback(`${ORIGIN}?token_hash=abc123&type=recovery&code=should-be-ignored`)
  assert.equal(parsed.kind, 'token_hash')
})

// --- Architecture invariants, verified against the actual source (matches this repo's
// existing style of asserting wiring/architecture properties via source inspection). ---

const supabaseClientPath = new URL('../src/lib/portal/supabase.ts', import.meta.url)
const callbackRoutePath = new URL('../src/routes/auth.callback.tsx', import.meta.url)
const authComponentPath = new URL('../src/components/portal/auth.tsx', import.meta.url)
const invitationFunctionPath = new URL('../netlify/functions/portal-invite.mts', import.meta.url)
const clientPortalAccessPath = new URL('../src/components/portal/client-portal-access.tsx', import.meta.url)
const diagnosticsPath = new URL('../src/lib/portal/auth-diagnostics.ts', import.meta.url)

test('the portal Supabase client no longer relies on automatic, silent URL detection', async () => {
  const source = await readFile(supabaseClientPath, 'utf8')
  assert.match(source, /detectSessionInUrl:\s*false/)
})

test('the callback route only ever declares a link invalid after an explicit rejection, never merely from a missing session', async () => {
  const source = await readFile(callbackRoutePath, 'utf8')
  // Every one of Supabase's own verification calls is present and its error branch is
  // the thing that leads to setInvalid(true) — never a bare getSession() check.
  assert.match(source, /verifyOtp\(\{ token_hash: parsed\.tokenHash, type: parsed\.type \}\)/)
  assert.match(source, /exchangeCodeForSession\(parsed\.code\)/)
  assert.match(source, /setSession\(\{ access_token: parsed\.accessToken, refresh_token: parsed\.refreshToken \}\)/)
  assert.doesNotMatch(source, /getSession\(\)/)
  // A successful exchange is the only path that reaches the portal password screen.
  assert.match(source, /navigate\(\{ to: '\/reset-password', search: \{ flow: type \}, replace: true \}\)/)
})

test('the callback route never logs a raw token, code or token_hash — only Error/Supabase error objects', async () => {
  const source = await readFile(callbackRoutePath, 'utf8')
  const logLines = source.split('\n').filter((line) => line.includes('logAuthDiagnostic('))
  assert.ok(logLines.length >= 5, 'expected multiple diagnostic call sites')
  for (const line of logLines) {
    // parsed.tokenHash/accessToken/refreshToken are always secret. parsed.code is secret
    // only for a PKCE `code` callback (parsed.kind === 'code') — the *other* meaning,
    // Supabase's own `?error=` identifier on an error-kind callback, is safe text and is
    // exactly what the CALLBACK_EXPIRED line below legitimately logs.
    assert.doesNotMatch(line, /parsed\.(tokenHash|accessToken|refreshToken)/)
    if (!line.includes('CALLBACK_EXPIRED')) assert.doesNotMatch(line, /parsed\.code\b(?!:)/)
  }
})

test('the diagnostics logger only ever surfaces a message string, never the raw error object', async () => {
  const source = await readFile(diagnosticsPath, 'utf8')
  assert.match(source, /error instanceof Error \? error\.message/)
  assert.doesNotMatch(source, /console\.error\([^)]*,\s*error\)/)
  assert.doesNotMatch(source, /\.\.\.error/)
})

test('every callback failure stage has a distinct diagnostic code', async () => {
  const source = await readFile(diagnosticsPath, 'utf8')
  for (const code of [
    'CALLBACK_MISSING', 'UNKNOWN_CALLBACK_TYPE', 'PKCE_EXCHANGE_FAILED', 'OTP_VERIFY_FAILED',
    'CALLBACK_EXPIRED', 'PASSWORD_UPDATE_FAILED', 'PROFILE_INITIALISATION_FAILED', 'ROLE_ACCESS_FAILED',
  ]) assert.match(source, new RegExp(`'${code}'`))
})

test('the password screen no longer parses Supabase callbacks itself — it only checks for an already-established session', async () => {
  const source = await readFile(authComponentPath, 'utf8')
  assert.doesNotMatch(source, /access_token|token_hash|exchangeCodeForSession|verifyOtp|readAuthCallback/)
  assert.match(source, /auth\.getSession\(\)/)
})

test('invitation completion stays authenticated and initialises the portal profile; recovery terminates the session', async () => {
  const source = await readFile(authComponentPath, 'utf8')
  const inviteBranch = source.slice(source.indexOf("if (flow === 'invite')"), source.indexOf('await supabase.auth.signOut'))
  assert.match(inviteBranch, /session\/initialise/)
  assert.match(inviteBranch, /canAccessPrivateArea\(profile\.role, 'portal'\)/)
  assert.doesNotMatch(inviteBranch, /signOut/)
  assert.match(source, /await supabase\.auth\.signOut\(\{ scope: 'local' \}\)/)
})

test('a password/confirm-password mismatch is blocked before any Supabase call', async () => {
  const source = await readFile(authComponentPath, 'utf8')
  const start = source.indexOf('async function submit(event: FormEvent) {\n    event.preventDefault()\n    setError')
  assert.notEqual(start, -1, 'expected to find the reset-password submit handler')
  const submitBody = source.slice(start, source.indexOf('setBusy(true)\n    try {', start))
  assert.match(submitBody, /password !== confirmPassword/)
})

test('invitations and password recovery redirect to the same GUARDEMAR callback route', async () => {
  const invite = await readFile(invitationFunctionPath, 'utf8')
  const authComponent = await readFile(authComponentPath, 'utf8')
  assert.match(invite, /INVITATION_REDIRECT_URL = 'https:\/\/guardemar\.com\/auth\/callback'/)
  assert.match(authComponent, /redirectTo: `\$\{origin\}\/auth\/callback`/)
})

test('an invitation failure that means the email already has an account is distinguished from a configuration failure', async () => {
  const source = await readFile(invitationFunctionPath, 'utf8')
  assert.match(source, /code === 'email_exists' \|\| code === 'user_already_exists'/)
  assert.match(source, /'auth_invite_email_exists'/)
  assert.match(source, /status === 401 \|\| status === 403/)
  assert.match(source, /'auth_invite_configuration'/)
})

test('staff can resolve an "email already has an account" invitation failure with a single, always-correct action', async () => {
  const source = await readFile(clientPortalAccessPath, 'utf8')
  assert.match(source, /auth_invite_email_exists/)
  assert.match(source, /resetPasswordForEmail\(emailExistsFor, \{ redirectTo: `\$\{window\.location\.origin\}\/auth\/callback` \}\)/)
})
