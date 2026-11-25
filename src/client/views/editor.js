/**
 * The edit surface, as a component.
 *
 * Two layers meet here. The frame, the toolbar and the menu are React; the picture between them is an
 * element tree built imperatively by `dom/stage.js` — the same clone a capture renders, laid out at
 * full length. That split is deliberate: the clone has to be a copy of the live application, so it is
 * cloned from the DOM and then handed to a container ref, while everything around it is ordinary UI.
 *
 * A click on the picture toggles the piece under the pointer. A click on an inserted field edits it in
 * place. The list behind the right button carries the same switches plus the two that have no separate
 * element (the divider and the meta line), so every option is reachable from the surface it affects.
 */

import { CHROME_PIECES } from '../dom/clone.js'
import { buildStage } from '../dom/stage.js'
import { FIELD_ATTRIBUTE, PIECE_ATTRIBUTE, SCROLL_ATTRIBUTE } from '../shell/const.js'
import { resetOptions, useOptions, writeOptions } from '../shell/options.js'
import { native, h, reactDom, useEffect, useRef, useState, useMemo } from '../shell/runtime.js'
import { useTranslate } from '../shell/i18n.js'

/** The name of one piece, for the tag a hidden part carries and for the menu row. */
export function pieceLabel(t, id) {
  if (id === 'nav') return t('settings.piece.nav')
  if (id === 'attachments') return t('settings.piece.attachments')
  if (id === 'process') return t('settings.piece.process')
  if (id === 'clock') return t('settings.piece.clock')
  if (id === 'toBottom') return t('settings.piece.toBottom')
  if (id === 'handles') return t('settings.piece.handles')
  if (id === 'paging') return t('settings.piece.paging')
  if (id === 'composer') return t('settings.piece.composer')
  if (id === 'head') return t('settings.piece.head')
  if (id === 'foot') return t('settings.piece.foot')
  if (id === 'meta') return t('settings.piece.meta')
  if (id === 'divider') return t('settings.piece.divider')
  return id
}

/** The switch a piece toggles; the inserted blocks and the two shared rules are not chrome. */
function optionOf(pieceId) {
  const found = CHROME_PIECES.find((piece) => piece.id === pieceId)
  return found === undefined ? null : found.option
}

/** The conversation the reader is looking at, or null when none is mounted. */
function findConversation() {
  if (typeof document === 'undefined') return null
  const scroller = document.querySelector(`[${SCROLL_ATTRIBUTE}]`)
  return scroller instanceof Element && scroller.clientWidth > 0 ? scroller : null
}

/**
 * Where the conversation sits on screen.
 *
 * The surface covers the conversation, not the window: a frameless window draws its own title bar and
 * its own window buttons over the page, and a surface that started at the top of the viewport would
 * put the bar under the buttons and let the title bar show through it.
 */
function paneRect() {
  const scroller = findConversation()
  if (scroller === null) return null
  const rect = scroller.getBoundingClientRect()
  if (rect.width < 1 || rect.height < 1) return null
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

/**
 * The overlay.
 *
 * `revision` is the only thing that rebuilds the clone: a switch changes the drawn picture, so the
 * copy is made again, while typing into a field leaves the copy alone — the typed text is already in
 * it, and rebuilding on every keystroke would take the caret with it.
 */
export function CaptureEditor({ onClose }) {
  const t = useTranslate()
  const options = useOptions()
  const optionsRef = useRef(options)
  optionsRef.current = options
  const hostRef = useRef(null)
  const stageRef = useRef(null)
  const [revision, setRevision] = useState(0)
  const [pane, setPane] = useState(paneRect)
  const [missing, setMissing] = useState(false)
  const [menu, setMenu] = useState(null)

  const labels = useMemo(
    () => ({
      title: t('settings.edit.title'),
      subtitle: t('settings.edit.subtitle'),
      footer: t('settings.edit.footer'),
    }),
    [t],
  )

  useEffect(() => {
    const anchor = findConversation()
    if (anchor === null) {
      setMissing(true)
      return undefined
    }
    setMissing(false)
    const stage = buildStage(anchor, optionsRef.current, {
      title: String(labels.title),
      subtitle: String(labels.subtitle),
      footer: String(labels.footer),
    })
    stageRef.current = stage
    if (hostRef.current !== null) {
      hostRef.current.replaceChildren(stage.element)
      // Only now does the copy have boxes: a detached tree measures as zero and the frame would
      // collapse to nothing, so the band is cut after mounting.
      stage.frame()
    }
    return () => {
      stage.destroy()
      stageRef.current = null
    }
  }, [revision, labels])

  // Every piece carries the same affordance: a click flips its switch, a right click opens the list.
  // Both are bound once per built copy, on the copy's own root, so nothing reaches the application.
  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return undefined
    const root = stage.element

    const toggle = (pieceId) => {
      const option = optionOf(pieceId)
      if (option === null) return
      writeOptions({ [option]: optionsRef.current[option] !== true })
      setRevision((value) => value + 1)
    }

    const onClick = (event) => {
      const field = event.target instanceof Element ? event.target.closest(`[${FIELD_ATTRIBUTE}]`) : null
      if (field !== null) return
      event.preventDefault()
      event.stopPropagation()
      const piece = event.target instanceof Element ? event.target.closest(`[${PIECE_ATTRIBUTE}]`) : null
      if (piece !== null) toggle(piece.getAttribute(PIECE_ATTRIBUTE))
    }

    const onContextMenu = (event) => {
      event.preventDefault()
      event.stopPropagation()
      const piece = event.target instanceof Element ? event.target.closest(`[${PIECE_ATTRIBUTE}]`) : null
      setMenu({ x: event.clientX, y: event.clientY, piece: piece === null ? null : piece.getAttribute(PIECE_ATTRIBUTE) })
    }

    const onInput = (event) => {
      const field = event.target instanceof Element ? event.target.closest(`[${FIELD_ATTRIBUTE}]`) : null
      if (field === null) return
      const name = field.getAttribute(FIELD_ATTRIBUTE)
      const text = field.textContent ?? ''
      if (text === '') field.setAttribute('data-empty', 'true')
      else field.removeAttribute('data-empty')
      writeOptions({ [name]: text })
    }

    const onKeyDown = (event) => {
      const field = event.target instanceof Element ? event.target.closest(`[${FIELD_ATTRIBUTE}]`) : null
      if (field !== null && event.key === 'Enter') {
        event.preventDefault()
        field.blur()
      }
    }

    root.addEventListener('click', onClick)
    root.addEventListener('contextmenu', onContextMenu)
    root.addEventListener('input', onInput)
    root.addEventListener('keydown', onKeyDown)
    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('contextmenu', onContextMenu)
      root.removeEventListener('input', onInput)
      root.removeEventListener('keydown', onKeyDown)
    }
  }, [revision])

  // The tag a piece carries says how it stands, so a reader who only hovers still learns what a click
  // would do. Rebuilt with the copy, because the copy is what the tag is attached to.
  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return
    const current = optionsRef.current
    for (const node of stage.clone.querySelectorAll(`[${PIECE_ATTRIBUTE}]`)) {
      const id = node.getAttribute(PIECE_ATTRIBUTE)
      const option = optionOf(id)
      const hidden = option !== null && current[option] === true
      node.setAttribute('title', `${pieceLabel(t, id)} · ${hidden ? t('settings.editor.hide') : t('settings.editor.show')}`)
    }
  }, [revision, t])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // The copy is built from the conversation's width at that moment, and the surface sits where the
  // conversation sat. A resize, a zoom or a sidebar that opens or closes moves both, so the surface is
  // placed again and the copy is rebuilt at the new size.
  useEffect(() => {
    let timer = null
    const onResize = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        setPane(paneRect())
        setRevision((value) => value + 1)
      }, 220)
    }
    window.addEventListener('resize', onResize)
    const scroller = findConversation()
    const observer = scroller === null || typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize)
    if (observer !== null) observer.observe(scroller)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('resize', onResize)
      if (observer !== null) observer.disconnect()
    }
  }, [])

  if (native === undefined) return null
  const { Button, Menu } = native

  const items = []
  for (const piece of CHROME_PIECES) {
    items.push({ id: piece.id, label: pieceLabel(t, piece.id) })
  }
  items.push({ type: 'separator' })
  items.push({ id: 'divider', label: pieceLabel(t, 'divider') })
  items.push({ id: 'meta', label: pieceLabel(t, 'meta') })
  items.push({ type: 'separator' })
  items.push({ id: 'reset', label: t('settings.reset'), danger: true })

  const selectedIds = []
  for (const piece of CHROME_PIECES) {
    if (options[piece.option] === true) selectedIds.push(piece.id)
  }
  if (options.divider) selectedIds.push('divider')
  if (options.showMeta) selectedIds.push('meta')

  const onSelect = (id) => {
    setMenu(null)
    if (id === 'reset') {
      resetOptions()
      setRevision((value) => value + 1)
      return
    }
    if (id === 'divider') {
      writeOptions({ divider: optionsRef.current.divider !== true })
      setRevision((value) => value + 1)
      return
    }
    if (id === 'meta') {
      writeOptions({ showMeta: optionsRef.current.showMeta !== true })
      setRevision((value) => value + 1)
      return
    }
    const option = optionOf(id)
    if (option === null) return
    writeOptions({ [option]: optionsRef.current[option] !== true })
    setRevision((value) => value + 1)
  }

  return h(
    'div',
    {
      className: 'cs-ed-wrap',
      style:
        pane === null
          ? undefined
          : { left: `${pane.left}px`, top: `${pane.top}px`, width: `${pane.width}px`, height: `${pane.height}px` },
    },
    h(
      'div',
      { className: 'cs-ed-bar' },
      h(
        'div',
        { className: 'cs-ed-lead' },
        h('div', { className: 'cs-ed-title' }, t('settings.title')),
        h('div', { className: 'cs-ed-hint' }, missing ? t('settings.editor.noConversation') : t('settings.editor.hint')),
      ),
      h(
        'div',
        { className: 'cs-ed-actions' },
        h(Button, { variant: 'ghost', size: 'sm', onClick: () => { resetOptions(); setRevision((value) => value + 1) } }, t('settings.reset')),
        h(Button, { variant: 'primary', size: 'sm', onClick: onClose }, t('settings.editor.done')),
      ),
    ),
    h('div', { className: 'cs-ed-host', ref: hostRef }),
    menu === null
      ? null
      : h(Menu, {
          open: true,
          anchorPoint: { x: menu.x, y: menu.y },
          items,
          selectedIds,
          onSelect,
          onClose: () => setMenu(null),
          portal: true,
          align: 'start',
          side: 'bottom',
        }),
  )
}

/** The mounted root, so opening twice cannot stack two surfaces. */
let mounted = null

/** Whether the edit surface is open. */
export function editorOpen() {
  return mounted !== null
}

/**
 * Open the edit surface over the conversation, or do nothing when it is already open or the host
 * offers no React root to mount it in.
 */
export function openEditor() {
  if (mounted !== null || reactDom === undefined) return
  const host = document.createElement('div')
  host.className = 'cs-ed-root'
  document.body.appendChild(host)
  const root = reactDom.createRoot(host)
  const close = () => {
    root.unmount()
    host.remove()
    mounted = null
  }
  mounted = { host, root, close }
  root.render(h(CaptureEditor, { onClose: close }))
}

/** Close the edit surface if it is open. */
export function closeEditor() {
  if (mounted === null) return
  mounted.close()
}
