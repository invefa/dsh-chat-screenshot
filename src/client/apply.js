/**
 * Registration: the locale tables, the stylesheet, and the two capture entries.
 *
 * Both entries ask for nothing but slots and locale. The capture reads the page's own DOM and writes
 * the clipboard or a file, so this bundle adds no host route, no settings section and no stored
 * state; unloading it removes the stylesheet and the dictionaries it registered.
 */

import { h } from './shell/runtime.js'
import { installLocale, translate } from './shell/i18n.js'
import { installStyle } from './shell/style.js'
import { captureConversation } from './dom/capture.js'
import { captureTurn } from './dom/turn.js'
import { ScreenshotButton, TurnScreenshotButton } from './views/buttons.js'
/** Services this bundle cannot work without. */
export const inject = ['slots', 'locale']

/** The entry sits at the right end of the composer tool row. */
export const WHOLE_SLOT = 'conversation.input.right'
export const TURN_SLOT = 'conversation.chat.assistant-actions'

/**
 * @param ctx - client root context
 */
export function apply(ctx) {
  ctx.effect(() => installLocale(ctx), 'chat-screenshot: dictionaries')
  ctx.effect(() => installStyle(), 'chat-screenshot: stylesheet')

  ctx.slots.inject(WHOLE_SLOT, () =>
    ctx.slots.register(
      {
        name: WHOLE_SLOT,
        id: 'chat-screenshot',
        order: -10,
      },
      ScreenshotButton,
    ),
  )

  ctx.slots.inject(TURN_SLOT, () =>
    ctx.slots.register(
      {
        name: TURN_SLOT,
        id: 'chat-screenshot-turn',
        order: 0,
      },
      TurnScreenshotButton,
    ),
  )

  // Diagnosis handle: the capture runs from a click, so the only way to try one path in isolation
  // (a single turn, in a sandbox page, without a rendered action row) is to call it. Removed on
  // unload, because a stale global lies about a plugin that is no longer loaded.
  ctx.effect(() => {
    window.__chatScreenshot = {
      captureConversation,
      captureTurn,
      translate,
    }
    return () => {
      delete window.__chatScreenshot
    }
  }, 'chat-screenshot: diagnostics')
}

/** Pure helpers, exported for the offline checks only. */
export const __pure = { h }
