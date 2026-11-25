/**
 * The two entries. Both are the same control with different scope, so the button body lives once:
 * `CaptureButton` draws it, and the two exported components only decide what a click captures.
 */

import { h, useCallback } from '../shell/runtime.js'
import { useCaptureStatus, deliver } from '../shell/status.js'
import { captureConversation, conversationRoot } from '../dom/capture.js'
import { captureTurn } from '../dom/turn.js'
import { hasOlderPages, loadFullHistory } from '../dom/paging.js'
import { CameraIcon, CheckIcon } from './icons.js'

/**
 * One button with its spinner, its success check and its toast.
 * @param props.busy - whether a capture is running.
 * @param props.status - the message to show, or null.
 * @param props.done - whether the success check is flashing.
 * @param props.label - the accessible name of the entry.
 * @param props.hint - the tooltip, which says what one click captures.
 * @param props.onClick - starts the capture.
 * @param props.anchorRef - receives the wrapper element the capture anchors to.
 */
export function CaptureButton({ busy, status, done, label, hint, onClick, anchorRef }) {
  return h(
    'div',
    { className: 'cs-root', ref: anchorRef },
    h(
      'button',
      {
        type: 'button',
        className: 'cs-btn',
        disabled: busy,
        title: hint,
        'aria-label': label,
        'aria-busy': busy ? 'true' : undefined,
        onMouseDown: (event) => event.preventDefault(),
        onClick: (event) => {
          event.preventDefault()
          onClick()
        },
      },
      busy
        ? h('span', { className: 'cs-spinner' })
        : done
          ? h(CheckIcon)
          : h(CameraIcon),
    ),
    status !== null &&
      h('div', { className: 'cs-toast', role: 'status', 'aria-live': 'polite' }, status),
  )
}

/**
 * Whole conversation: drains the history first, then captures everything that is loaded. When the
 * history cannot be drained the picture is still produced, and the message says it covers the
 * loaded turns only.
 */
export function ScreenshotButton({ sessionId }) {
  const { t, busy, status, done, markDone, anchorRef, run } = useCaptureStatus()

  const produce = useCallback(
    async (anchor, say) => {
      const root = conversationRoot(anchor)
      if (root === null) throw new Error('conversation not found')
      if (root.scrollHeight <= 1) throw new Error('empty')

      let historyComplete = true
      // A disabled control and the "start of conversation" label both mean the history is already
      // complete, so the entry never announces a wait it is not going to have.
      if (hasOlderPages(root)) {
        say(t('state.loadingHistory'), true)
        historyComplete = await loadFullHistory(root)
      }

      say(t('state.rendering'), true)
      const shot = await captureConversation(anchor)
      const copied = await deliver(shot, {
        announce: say,
        t,
        sessionId,
        partial: !historyComplete,
        success: (taken) => t('state.copied', { width: taken.width, height: taken.height }),
      })
      if (copied) markDone()
    },
    [markDone, sessionId, t],
  )

  return h(CaptureButton, {
    busy,
    status,
    done,
    label: t('action.whole'),
    hint: t('action.wholeHint'),
    anchorRef,
    onClick: () => run(produce),
  })
}

/**
 * One turn: lives in each finalized reply's action row and captures exactly that turn, from the
 * user message that opens it through everything the model produced before the next user message.
 */
export function TurnScreenshotButton({ sessionId }) {
  const { t, busy, status, done, markDone, anchorRef, run } = useCaptureStatus()

  const produce = useCallback(
    async (anchor, say) => {
      const turnEl = anchor.closest('[data-turn-tail]')
      if (turnEl === null) throw new Error('turn not found')
      // Keep the action row (and this toast) on screen even when the row is hover-revealed and the
      // pointer wanders off mid-capture.
      const reveal = turnEl.getAttribute('data-actions-reveal')
      if (reveal === 'hover') turnEl.setAttribute('data-actions-reveal', 'always')
      try {
        say(t('state.rendering'), true)
        const shot = await captureTurn(turnEl)
        const copied = await deliver(shot, {
          announce: say,
          t,
          sessionId,
          success: (taken) => t('state.turnCopied', { width: taken.width, height: taken.height }),
        })
        if (copied) markDone()
      } finally {
        if (reveal === 'hover') turnEl.setAttribute('data-actions-reveal', reveal)
      }
    },
    [markDone, sessionId, t],
  )

  return h(CaptureButton, {
    busy,
    status,
    done,
    label: t('action.turn'),
    hint: t('action.turnHint'),
    anchorRef,
    onClick: () => run(produce),
  })
}
