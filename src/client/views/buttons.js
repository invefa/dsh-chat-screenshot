/**
 * The two entries. Both are the same control with different scope, so the button body lives once:
 * `CaptureButton` draws it, and the two exported components only decide what a click captures.
 */

import { h, useState, useCallback } from '../shell/runtime.js'
import { useCaptureStatus, deliver } from '../shell/status.js'
import { captureConversation, conversationRoot } from '../dom/capture.js'
import { captureTurn, captureTurns, turnList } from '../dom/turn.js'
import { hasOlderPages, loadFullHistory } from '../dom/paging.js'
import { CameraIcon, CheckIcon } from './icons.js'
import { CaptureMenu, TurnPicker } from './menu.js'

/**
 * One button with its spinner, its success check and its toast.
 * @param props.busy - whether a capture is running.
 * @param props.status - the message to show, or null.
 * @param props.done - whether the success check is flashing.
 * @param props.label - the accessible name of the entry.
 * @param props.hint - the tooltip, which says what one click captures.
 * @param props.onClick - starts the capture.
 * @param props.onContextMenu - opens the scope menu, or undefined when the host cannot draw one.
 * @param props.anchorRef - receives the wrapper element the capture anchors to.
 * @param props.children - surfaces the entry raises, rendered beside the toast.
 */
export function CaptureButton({ busy, status, done, label, hint, onClick, onContextMenu, anchorRef, children }) {
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
        'aria-haspopup': onContextMenu === undefined ? undefined : 'menu',
        onMouseDown: (event) => event.preventDefault(),
        onContextMenu,
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
    children,
  )
}

/**
 * Whole conversation, or — through the right-click menu — one turn or a few of them. A plain click
 * keeps its old meaning: drain the history, then capture everything that is loaded. When the history
 * cannot be drained the picture is still produced, and the message says it covers the loaded turns
 * only.
 */
export function ScreenshotButton({ sessionId }) {
  const { t, busy, status, done, markDone, anchorRef, run } = useCaptureStatus()
  const [menuOpen, setMenuOpen] = useState(false)
  const [turns, setTurns] = useState([])
  const [picked, setPicked] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const capture = useCallback(
    async (anchor, say, scope) => {
      const root = conversationRoot(anchor)
      if (root === null) throw new Error('conversation not found')
      if (root.scrollHeight <= 1) throw new Error('empty')

      let historyComplete = true
      // Draining the history is only meaningful for the whole transcript: a turn band lives in the
      // turns already loaded, and pulling older pages in would not add a row to the chooser.
      if (scope.kind === 'whole' && hasOlderPages(root)) {
        say(t('state.loadingHistory'), true)
        historyComplete = await loadFullHistory(root)
      }

      say(t('state.rendering'), true)
      const shot =
        scope.kind === 'whole' ? await captureConversation(anchor) : await captureTurns(root, scope.indices)
      const copied = await deliver(shot, {
        announce: say,
        t,
        sessionId,
        partial: scope.kind === 'whole' && !historyComplete,
        success: (taken) =>
          scope.kind === 'whole'
            ? t('state.copied', { width: taken.width, height: taken.height })
            : t('state.turnsCopied', {
                turns: scope.indices.length,
                width: taken.width,
                height: taken.height,
              }),
      })
      if (copied) markDone()
    },
    [markDone, sessionId, t],
  )

  const captureNow = useCallback(
    (scope) => {
      run((anchor, say) => capture(anchor, say, scope))
    },
    [capture, run],
  )

  const openMenu = (event) => {
    const root = conversationRoot(event.currentTarget)
    if (root === null) return
    event.preventDefault()
    setTurns(turnList(root))
    setPicked([])
    setMenuOpen(true)
  }

  const select = (id) => {
    setMenuOpen(false)
    if (id === 'whole') {
      captureNow({ kind: 'whole' })
      return
    }
    if (id === 'last') {
      // The last entry is the turn that is open right now, if the model is still answering.
      const last = turns.length - 1
      if (last >= 0) captureNow({ kind: 'turns', indices: [last] })
      return
    }
    setPickerOpen(true)
  }

  const toggle = (index, on) => {
    setPicked((current) => {
      const next = on ? [...current, index] : current.filter((value) => value !== index)
      return next.sort((a, b) => a - b)
    })
  }

  const items = [
    { id: 'whole', label: t('menu.whole') },
    { id: 'last', label: t('menu.last'), disabled: turns.length === 0 },
    { id: 'pick', label: t('menu.pick'), disabled: turns.length === 0 },
  ]

  return h(
    CaptureButton,
    {
      busy,
      status,
      done,
      label: t('action.whole'),
      hint: t('action.wholeHint'),
      anchorRef,
      onClick: () => captureNow({ kind: 'whole' }),
      onContextMenu: openMenu,
    },
    h(CaptureMenu, {
      open: menuOpen,
      anchorRef,
      items,
      onSelect: select,
      onClose: () => setMenuOpen(false),
    }),
    h(TurnPicker, {
      open: pickerOpen,
      turns,
      picked,
      t,
      onToggle: toggle,
      onCancel: () => setPickerOpen(false),
      onConfirm: () => {
        setPickerOpen(false)
        if (picked.length > 0) captureNow({ kind: 'turns', indices: picked })
      },
    }),
  )
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
