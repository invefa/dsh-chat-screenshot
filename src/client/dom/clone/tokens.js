/**
 * What a text block can say about the shot it is part of.
 *
 * A template is plain text with `{token}` placeholders; the values are read from the page the capture
 * is taken from, so the same header describes every conversation instead of repeating one fixed
 * sentence. Unknown placeholders are left as written: the reader typed them, and silently swallowing
 * a typo would be worse than showing it.
 */

import { TEMPLATE_TOKENS } from '../../shell/const.js'

/** The first non-empty text found under one of the selectors, trimmed. */
function firstText(doc, selectors) {
  if (doc === null || doc === undefined) return ''
  for (const selector of selectors) {
    const element = doc.querySelector(selector)
    if (element === null) continue
    const text = (element.textContent ?? '').trim()
    if (text !== '') return text
  }
  return ''
}

/** The conversation's own title: the page title without the application suffix. */
function conversationTitle(doc) {
  if (doc === null || doc === undefined) return ''
  const raw = (doc.title ?? '').trim()
  if (raw === '') return ''
  return raw.replace(/\s+[—–-]\s+DeepSeek Harness\s*$/i, '').trim()
}

/** Zero-padded two-digit field. */
function pad(value) {
  return String(value).padStart(2, '0')
}

/** The application release, when the boot record carries one. */
function releaseVersion() {
  try {
    const release = globalThis.__DSH_BOOT__?.release
    return typeof release?.version === 'string' ? release.version : ''
  } catch {
    return ''
  }
}

/**
 * The values behind the placeholders.
 *
 * Everything is read from the live document rather than from host state: the plugin subscribes to no
 * host service, and the numbers a header needs — how many turns are in the picture, what the
 * conversation is called, which model answered — are all on screen already.
 */
export function tokenValues(doc, now = new Date()) {
  const turns = doc === null || doc === undefined ? 0 : doc.querySelectorAll('[data-chat-turn]').length
  const prompts =
    doc === null || doc === undefined ? 0 : doc.querySelectorAll('[data-chat-flow-kind="user"]').length
  const model = firstText(doc, ['[data-model-id]'])
  const sessionRaw =
    doc === null || doc === undefined
      ? ''
      : (doc.querySelector('[data-conversation-session]')?.getAttribute('data-conversation-session') ?? '')
  return {
    turns: turns === 0 ? '' : String(turns),
    prompts: prompts === 0 ? '' : String(prompts),
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    weekday: now.toLocaleDateString(undefined, { weekday: 'long' }),
    title: conversationTitle(doc),
    model,
    session: sessionRaw.replace(/^session-/, ''),
    app: 'DeepSeek Harness',
    version: releaseVersion(),
  }
}

/** Replace every `{token}` that has a value, and leave the rest exactly as written. */
export function renderTemplate(text, values) {
  if (typeof text !== 'string' || text === '') return ''
  return text.replace(/\{([a-z_]+)\}/g, (whole, name) => {
    if (!TEMPLATE_TOKENS.includes(name)) return whole
    const value = values === null || values === undefined ? undefined : values[name]
    return typeof value === 'string' && value !== '' ? value : whole
  })
}

/** Whether a string still carries a placeholder, which is what the editor shows instead of a value. */
export function hasToken(text) {
  if (typeof text !== 'string') return false
  return /\{[a-z_]+\}/.test(text)
}
