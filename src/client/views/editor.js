/**
 * The edit surface: the picture, editable where it is drawn.
 *
 * The overlay stands in the conversation's own place. It shows the very clone a capture renders — the
 * same rules, the same blocks, the same tokens — laid out at full length in a scrolling frame, so what
 * the reader arranges is what the camera will produce.
 *
 * Two things are selectable, and each has its own half of the tray:
 *
 * - An element of the copy. Click to select, double-click to hide or restore, right-click for the
 *   switches that have no element of their own. The inspector names it, mints a selector for it and
 *   edits its style and attributes.
 * - A block of the picture's own content. It is dragged in from the library, dragged around inside its
 *   zone, edited in the inspector and deleted when it is no longer wanted.
 *
 * The copy is rebuilt on `revision` alone: a rule or a block changes the drawn picture, so the copy is
 * made again, while typing into a block leaves the copy alone — rebuilding on every keystroke would
 * take the caret with it.
 */

import {
  BLOCK_ATTRIBUTE,
  FIELD_ATTRIBUTE,
  MAX_CUSTOM,
  PEEK_MS,
  RULE_PRESETS,
  SCROLL_ATTRIBUTE,
  STYLE_PROPS,
  TEMPLATE_TOKENS,
  TEXT_SIZES,
  ZONE_ATTRIBUTE,
} from '../shell/const.js'
import { useTranslate } from '../shell/i18n.js'
import {
  addBlock,
  blockFor,
  dropCustom,
  dropRule,
  moveBlock,
  readOptions,
  removeBlock,
  resetOptions,
  ruleFor,
  saveCustom,
  saveRule,
  updateBlock,
  useOptions,
  writeOptions,
} from '../shell/options.js'
import { autoName, describeElement, elementKey } from '../dom/rules.js'
import { buildStage } from '../dom/stage.js'
import { native, h, react, reactDom, useEffect, useRef, useState, useMemo } from '../shell/runtime.js'
import { describeSelected, entryLabel, kindLabel, pieceLabel } from './editor-labels.js'
import { BLOCK_PAYLOAD, dropTarget, readDrag, writeDrag } from './editor-drag.js'
import { libraryView } from './editor-library.js'
import { blockInspector, elementInspector } from './editor-inspector.js'

/** The names the built-in pieces answer to, so a hidden one still reads as something. */
function findConversation() {
  const scroller = document.querySelector(`[${SCROLL_ATTRIBUTE}]`)
  if (!(scroller instanceof HTMLElement) || scroller.clientWidth < 1) return null
  return scroller
}

/** The rectangle the conversation occupies, so the surface sits exactly over it. */
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
 * A crash inside the surface must not leave a blank screen over the conversation: the boundary keeps
 * the overlay, prints what broke, and the reader can close it and carry on.
 */
class SurfaceBoundary extends react.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error === null) return this.props.children
    const message = String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)
    return h('div', { className: 'cs-ed-crash' }, message)
  }
}

/** The edit surface, behind a boundary so one bad render still says what broke. */
export function CaptureEditor(props) {
  return h(SurfaceBoundary, null, h(CaptureSurface, props))
}
/** The two zones, in the order the tray lists them. */
function CaptureSurface({ onClose }) {
  const t = useTranslate()
  const options = useOptions()
  const hostRef = useRef(null)
  const stageRef = useRef(null)
  const timersRef = useRef([])
  const hitRef = useRef(null)
  const pickRef = useRef(false)
  const selectionRef = useRef(null)
  const fileRef = useRef(null)
  const [revision, setRevision] = useState(0)
  const [pane, setPane] = useState(paneRect)
  const [missing, setMissing] = useState(false)
  const [entries, setEntries] = useState([])
  const [selection, setSelection] = useState(null)
  const [pick, setPick] = useState(false)
  const [menu, setMenu] = useState(null)
  const [drag, setDrag] = useState(null)
  const [draftProp, setDraftProp] = useState(STYLE_PROPS[0])
  const [draftValue, setDraftValue] = useState('')
  const [draftAttr, setDraftAttr] = useState('')
  const [draftAttrValue, setDraftAttrValue] = useState('')
  const [customName, setCustomName] = useState('')

  pickRef.current = pick
  selectionRef.current = selection

  const labels = useMemo(
    () => ({
      text: t('settings.editor.block.textHint'),
      image: t('settings.editor.block.imageHint'),
      zone: t('settings.editor.block.zoneHint'),
    }),
    [t],
  )

  const bump = () => setRevision((value) => value + 1)

  useEffect(() => {
    const anchor = findConversation()
    if (anchor === null) {
      setMissing(true)
      return undefined
    }
    setMissing(false)
    const stage = buildStage(anchor, readOptions(), {
      text: String(labels.text),
      image: String(labels.image),
      zone: String(labels.zone),
    })
    stageRef.current = stage
    setEntries(stage.entries)
    if (hostRef.current !== null) {
      const host = hostRef.current
      host.replaceChildren(stage.element)
      // Only now does the copy have boxes: a detached tree measures as zero and the frame would
      // collapse to nothing, so the band is cut after mounting.
      stage.frame()
      // The tray sits under the picture rather than beside it, so the copy keeps the width it will be
      // captured at; the frame is narrowed only when the window is narrower than the picture.
      const frame = stage.frameElement
      frame.style.zoom = ''
      const width = frame.getBoundingClientRect().width
      if (width > 0 && host.clientWidth > 0) {
        const scale = Math.min(1, host.clientWidth / width)
        frame.style.zoom = scale < 0.995 ? String(Math.max(0.35, scale)) : ''
      }
    }
    return () => {
      stage.destroy()
      stageRef.current = null
    }
  }, [revision, labels])

  // The copy is a clone, so nothing here can reach the application: a link or a button in it would
  // still navigate, which is why clicks are intercepted rather than forwarded.
  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return undefined
    const root = stage.element
    const clone = stage.clone

    const elementOf = (event) => (event.target instanceof Element ? event.target : null)
    const isField = (node) => node.closest(`[${FIELD_ATTRIBUTE}]`) !== null
    const blockOf = (node) => {
      const shell = node.closest(`[${BLOCK_ATTRIBUTE}]`)
      return shell === null ? null : shell.getAttribute(BLOCK_ATTRIBUTE)
    }

    const chooseBlock = (id) => {
      setSelection({ type: 'block', id })
      setCustomName('')
      return id
    }

    const choose = (node) => {
      const selector = elementKey(node, clone)
      setSelection({ type: 'element', selector, tag: node.tagName.toLowerCase(), text: autoName(node) })
      return selector
    }

    const onClick = (event) => {
      const node = elementOf(event)
      if (node === null) return
      if (isField(node)) {
        const id = blockOf(node)
        if (id !== null) chooseBlock(id)
        return
      }
      event.stopPropagation()
      event.preventDefault()
      const id = blockOf(node)
      if (id !== null) {
        chooseBlock(id)
        return
      }
      choose(node)
    }

    const onDoubleClick = (event) => {
      const node = elementOf(event)
      if (node === null || isField(node)) return
      // A block is content the reader placed, not chrome: hiding it would be a way of deleting it that
      // leaves it behind, so a double click there is left to the text field itself.
      if (blockOf(node) !== null) return
      event.preventDefault()
      event.stopPropagation()
      const selector = choose(node)
      const current = ruleFor(readOptions(), selector)
      saveRule(selector, {
        name: current === null ? autoName(node) : current.name,
        hide: current === null ? true : current.hide !== true,
      })
      bump()
    }

    const onContextMenu = (event) => {
      const node = elementOf(event)
      if (node === null) return
      event.preventDefault()
      event.stopPropagation()
      const id = blockOf(node)
      if (id !== null) {
        chooseBlock(id)
        setMenu({ x: event.clientX, y: event.clientY, block: null, selector: null, blockId: id })
        return
      }
      setMenu({ x: event.clientX, y: event.clientY, selector: choose(node), block: null, blockId: null })
    }

    const onMove = (event) => {
      if (!pickRef.current) return
      const node = elementOf(event)
      if (hitRef.current !== null && hitRef.current !== node) {
        hitRef.current.classList.remove('cs-ed-hit')
        hitRef.current = null
      }
      if (node === null || isField(node)) return
      node.classList.add('cs-ed-hit')
      hitRef.current = node
    }

    const onInput = (event) => {
      const node = elementOf(event)
      if (node === null) return
      const field = node.closest(`[${FIELD_ATTRIBUTE}]`)
      if (field === null) return
      const id = field.getAttribute(FIELD_ATTRIBUTE)
      const text = field.textContent ?? ''
      if (text === '') field.setAttribute('data-empty', 'true')
      else field.removeAttribute('data-empty')
      updateBlock(id, { text })
    }

    const onKeyDown = (event) => {
      const node = elementOf(event)
      if (node === null) return
      const field = node.closest(`[${FIELD_ATTRIBUTE}]`)
      if (field === null) return
      if (event.key === 'Escape') {
        event.preventDefault()
        field.blur()
      }
    }

    // A block is dragged by its shell: the payload names the block, and the tray starts the same
    // gesture from a library entry.
    const onDragStart = (event) => {
      const node = elementOf(event)
      if (node === null) return
      const id = blockOf(node)
      if (id === null) return
      writeDrag({ id, block: null })
      if (event.dataTransfer !== null && event.dataTransfer !== undefined) {
        event.dataTransfer.effectAllowed = 'move'
        try {
          event.dataTransfer.setData(BLOCK_PAYLOAD, JSON.stringify({ id }))
        } catch {
          // A browser that refuses a custom type still delivers the dragstart/drop pair.
        }
      }
    }

    root.addEventListener('click', onClick)
    root.addEventListener('dblclick', onDoubleClick)
    root.addEventListener('contextmenu', onContextMenu)
    root.addEventListener('mousemove', onMove)
    root.addEventListener('input', onInput)
    root.addEventListener('keydown', onKeyDown)
    root.addEventListener('dragstart', onDragStart)
    for (const shell of clone.querySelectorAll(`[${BLOCK_ATTRIBUTE}]`)) {
      shell.setAttribute('draggable', 'true')
    }
    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('dblclick', onDoubleClick)
      root.removeEventListener('contextmenu', onContextMenu)
      root.removeEventListener('mousemove', onMove)
      root.removeEventListener('input', onInput)
      root.removeEventListener('keydown', onKeyDown)
      root.removeEventListener('dragstart', onDragStart)
      if (hitRef.current !== null) hitRef.current.classList.remove('cs-ed-hit')
      hitRef.current = null
    }
  }, [revision])

  // The picked element is outlined where it sits, so the inspector always says which element it is
  // talking about. A hidden element has no box, so it cannot be outlined — its chip locates it instead.
  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return undefined
    if (selection === null || selection.type === 'block') return undefined
    let marked = null
    try {
      marked = stage.clone.querySelector(selection.selector)
    } catch {
      marked = null
    }
    if (marked === null) return undefined
    marked.classList.add('cs-ed-sel')
    return () => marked.classList.remove('cs-ed-sel')
  }, [selection, revision])

  useEffect(
    () => () => {
      for (const timer of timersRef.current) window.clearTimeout(timer)
      timersRef.current = []
    },
    [],
  )

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      const active = document.activeElement
      if (active instanceof HTMLElement && active.closest('.cs-ed-wrap') !== null) {
        if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') {
          active.blur()
          return
        }
        if (active.getAttribute('contenteditable') !== null) {
          active.blur()
          return
        }
      }
      onClose()
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
        bump()
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
  const { Button, Menu, Switch } = native

  const elementSelection = selection !== null && selection.type === 'element' ? selection : null
  const blockSelection = selection !== null && selection.type === 'block' ? blockFor(options, selection.id) : null
  const rule = elementSelection === null ? null : ruleFor(options, elementSelection.selector)

  /** Show one hidden entry again for a moment, in the place it came from. */
  const peek = (entry) => {
    for (const node of entry.elements ?? []) {
      const previous = node.style.getPropertyValue('display')
      node.style.setProperty('display', '')
      node.classList.add('cs-ed-peek')
      node.scrollIntoView({ block: 'center', inline: 'nearest' })
      const timer = window.setTimeout(() => {
        node.classList.remove('cs-ed-peek')
        node.style.setProperty('display', previous)
      }, PEEK_MS)
      timersRef.current.push(timer)
    }
  }

  /** Put one hidden entry back into the picture, and forget a rule that only existed to hide. */
  const restore = (entry) => {
    if (entry.kind === 'piece') {
      writeOptions({ [entry.option]: false })
    } else {
      const current = ruleFor(readOptions(), entry.selector)
      const silent =
        current !== null &&
        Object.keys(current.style).length === 0 &&
        Object.keys(current.attrs).length === 0
      if (silent) dropRule(entry.selector)
      else saveRule(entry.selector, { hide: false })
    }
    bump()
  }

  const patchRule = (patch) => {
    if (elementSelection === null) return
    const current = ruleFor(readOptions(), elementSelection.selector)
    saveRule(elementSelection.selector, { name: current === null ? elementSelection.text : current.name, ...patch })
    bump()
  }

  const setStyle = (prop, value) => {
    if (elementSelection === null) return
    const current = ruleFor(readOptions(), elementSelection.selector)
    const style = { ...(current === null ? {} : current.style) }
    const text = value.trim()
    if (text === '') delete style[prop]
    else style[prop] = text
    saveRule(elementSelection.selector, { style })
    bump()
  }

  const setAttr = (name, value) => {
    if (elementSelection === null) return
    const current = ruleFor(readOptions(), elementSelection.selector)
    const attrs = { ...(current === null ? {} : current.attrs) }
    if (value === '') delete attrs[name]
    else attrs[name] = value
    saveRule(elementSelection.selector, { attrs })
    bump()
  }

  /** Drop a block, from the palette or from another place in the picture. */
  const dropBlock = (target) => {
    if (target === null) return
    const payload = readDrag()
    writeDrag(null)
    setDrag(null)
    if (payload === null) return
    if (payload.id !== null && payload.id !== undefined) {
      moveBlock(payload.id, target.zone, target.index)
    } else if (payload.block !== null && payload.block !== undefined) {
      const created = addBlock(target.zone, { ...payload.block, zone: target.zone }, target.index)
      if (created !== null) setSelection({ type: 'block', id: created.id })
    }
    bump()
  }

  /** Append one block of a kind to the bottom zone, for a click instead of a drag. */
  const appendBlock = (kind, shape) => {
    const created = addBlock('bottom', { ...(shape ?? {}), kind, zone: 'bottom' })
    if (created !== null) {
      setSelection({ type: 'block', id: created.id })
      bump()
    }
  }

  /** Add one token to the text of the selected block. */
  const addToken = (name) => {
    if (blockSelection === null || blockSelection.kind !== 'text') return
    const text = blockSelection.text === '' ? `{${name}}` : `${blockSelection.text} {${name}}`
    updateBlock(blockSelection.id, { text })
    bump()
  }

  /** Read one image file into the block, as a data URL the renderer can paint without a request. */
  const pickImage = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined || blockSelection === null) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (src === '') return
      updateBlock(blockSelection.id, { src })
      bump()
    }
    reader.readAsDataURL(file)
  }

  const menuItems = []
  if (menu !== null && menu.blockId !== null) {
    menuItems.push({ id: 'blockDelete', label: t('settings.editor.block.delete'), danger: true })
    menuItems.push({ type: 'separator' })
    menuItems.push({ id: 'blockTop', label: t('settings.editor.block.toTop') })
    menuItems.push({ id: 'blockBottom', label: t('settings.editor.block.toBottom') })
    menuItems.push({ type: 'separator' })
    menuItems.push({ id: 'reset', label: t('settings.reset'), danger: true })
  } else if (menu !== null) {
    const current = ruleFor(options, menu.selector)
    const hidden = current !== null && current.hide === true
    menuItems.push({ id: 'toggle', label: hidden ? t('settings.editor.restore') : t('settings.editor.hide') })
    if (current !== null) menuItems.push({ id: 'remove', label: t('settings.editor.removeRule'), danger: true })
    menuItems.push({ type: 'separator' })
    menuItems.push({ id: 'reset', label: t('settings.reset'), danger: true })
  }

  const onMenu = (id) => {
    const current = menu
    setMenu(null)
    if (current === null) return
    if (id === 'reset') {
      resetOptions()
      setSelection(null)
      bump()
      return
    }
    if (id === 'blockDelete') {
      removeBlock(current.blockId)
      setSelection(null)
      bump()
      return
    }
    if (id === 'blockTop' || id === 'blockBottom') {
      moveBlock(current.blockId, id === 'blockTop' ? 'top' : 'bottom', 99)
      bump()
      return
    }
    if (current.selector === null) return
    if (id === 'remove') {
      dropRule(current.selector)
      setSelection(null)
      bump()
      return
    }
    const existing = ruleFor(readOptions(), current.selector)
    saveRule(current.selector, { hide: existing === null ? true : existing.hide !== true })
    bump()
  }

  const hiddenEntries = []
  for (const entry of entries) {
    if (entry.kind === 'piece') {
      if (options[entry.option] === true) hiddenEntries.push(entry)
    } else if (ruleFor(options, entry.selector)?.hide === true) {
      hiddenEntries.push(entry)
    }
  }

  const styleKeys = rule === null ? [] : Object.keys(rule.style)
  const attrKeys = rule === null ? [] : Object.keys(rule.attrs)
  const detail =
    elementSelection === null || stageRef.current === null
      ? null
      : describeSelected(stageRef.current.clone, elementSelection.selector)

  const inspector =
    blockSelection !== null
      ? h(blockInspector, {
          t,
          block: blockSelection,
          Button,
          Menu,
          fileRef,
          onPickImage: pickImage,
          customName,
          setCustomName,
          onCustomName: (value) => setCustomName(value),
          onSaveCustom: () => {
            const name = customName.trim() === '' ? kindLabel(t, blockSelection.kind) : customName
            saveCustom(String(name), blockSelection)
            setCustomName('')
          },
          onRemove: () => {
            removeBlock(blockSelection.id)
            setSelection(null)
            bump()
          },
          onToken: addToken,
          onPatch: (patch) => {
            updateBlock(blockSelection.id, patch)
            bump()
          },
        })
      : elementSelection !== null
        ? h(elementInspector, {
            t,
            selection: elementSelection,
            rule,
            detail,
            styleKeys,
            attrKeys,
            Switch,
            Button,
            draftProp,
            draftValue,
            draftAttr,
            draftAttrValue,
            setDraftProp,
            setDraftValue,
            setDraftAttr,
            setDraftAttrValue,
            onHide: () => patchRule({ hide: rule === null ? true : rule.hide !== true }),
            onRename: (value) => {
              if (elementSelection === null) return
              saveRule(elementSelection.selector, {
                name: value.trim() === '' ? elementSelection.text : value,
              })
              bump()
            },
            onPreset: (preset) => patchRule({ style: { ...(rule === null ? {} : rule.style), ...preset.style } }),
            onStyle: setStyle,
            onAttr: setAttr,
            onRemoveRule: () => {
              dropRule(elementSelection.selector)
              setSelection(null)
              bump()
            },
          })
        : h('div', { className: 'cs-ed-empty' }, t('settings.editor.side.none'))

  const library = h(libraryView, {
    t,
    options,
    blockSelection,
    onAdd: (kind, shape) => appendBlock(kind, shape),
    onDropCustom: (id) => {
      dropCustom(id)
      bump()
    },
    onToken: addToken,
    onDrag: (payload) => {
      writeDrag(payload)
      setDrag(null)
    },
  })

  return h(
    'div',
    { className: 'cs-ed-wrap', style: pane === null ? undefined : { left: `${pane.left}px`, top: `${pane.top}px`, width: `${pane.width}px`, height: `${pane.height}px` } },
    h(
      'div',
      { className: 'cs-ed-bar' },
      h(
        'div',
        { className: 'cs-ed-lead' },
        h('div', { className: 'cs-ed-title' }, t('settings.title')),
        h('div', { className: 'cs-ed-hint' }, t('settings.editor.hint')),
      ),
      h(
        'div',
        { className: 'cs-ed-actions' },
        h(
          Button,
          {
            variant: pick ? 'primary' : 'outline',
            size: 'sm',
            onClick: () => {
              const next = pick !== true
              setPick(next)
              if (next) setSelection(null)
            },
          },
          t('settings.editor.pick'),
        ),
        h(
          Button,
          {
            variant: 'ghost',
            size: 'sm',
            onClick: () => {
              resetOptions()
              setSelection(null)
              bump()
            },
          },
          t('settings.reset'),
        ),
        h(Button, { variant: 'primary', size: 'sm', onClick: onClose }, t('settings.editor.done')),
      ),
    ),
    missing ? h('div', { className: 'cs-ed-empty' }, t('settings.editor.noConversation')) : null,
    h('div', { className: 'cs-ed-host', ref: hostRef, onDragOver: onDragOver, onDragLeave: onDragLeave, onDrop: onDrop }),
    drag === null ? null : h('div', { className: 'cs-ed-drop', style: { top: `${drag.y}px` } }),
    h(
      'div',
      { className: 'cs-ed-tray' },
      h(
        'div',
        { className: 'cs-ed-hidden' },
        h('span', { className: 'cs-ed-label' }, t('settings.editor.hidden')),
        hiddenEntries.length === 0
          ? h('span', { className: 'cs-ed-hintline' }, t('settings.editor.hiddenEmpty'))
          : h(
              'span',
              { className: 'cs-ed-chips' },
              ...hiddenEntries.map((entry) =>
                h(
                  'span',
                  {
                    key: `${entry.kind}:${entry.id}`,
                    className: 'cs-ed-chip',
                    title: t('settings.editor.hiddenHint'),
                    onClick: () => peek(entry),
                    onDoubleClick: () => restore(entry),
                  },
                  h('span', { className: 'cs-ed-chip-part' }, entryLabel(t, entry)),
                  entry.kind === 'rule' && (entry.elements ?? []).length > 1
                    ? h('span', { className: 'cs-ed-chip-count' }, String(entry.elements.length))
                    : null,
                ),
              ),
            ),
      ),
      h('div', { className: 'cs-ed-cols' }, h('div', { className: 'cs-ed-pane' }, inspector), h('div', { className: 'cs-ed-pane' }, library)),
    ),
    h(Menu, {
      open: menu !== null,
      anchorPoint: menu === null ? undefined : { x: menu.x, y: menu.y },
      align: 'start',
      portal: true,
      items: menuItems,
      selectedIds: [],
      onSelect: onMenu,
      onClose: () => setMenu(null),
    }),
  )

  function onDragOver(event) {
    const stage = stageRef.current
    if (stage === null || hostRef.current === null) return
    const payload = readDrag()
    if (payload === null) return
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer !== null && event.dataTransfer !== undefined) {
      event.dataTransfer.dropEffect = payload.id === null ? 'copy' : 'move'
    }
    const target = dropTarget(stage.clone, hostRef.current, event.clientY)
    if (target === null) return
    setDrag(target)
  }

  function onDragLeave(event) {
    if (hostRef.current === null) return
    const next = event.relatedTarget
    if (next instanceof Node && hostRef.current.contains(next)) return
    setDrag(null)
  }

  function onDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    const stage = stageRef.current
    if (stage === null || hostRef.current === null) return
    const target = dropTarget(stage.clone, hostRef.current, event.clientY)
    dropBlock(target)
  }
}

/** The inspector for one element of the copy: what it is, its name, and what to do with it. */
let mounted = null

/** Whether the surface is already open. */
export function editorOpen() {
  return mounted !== null
}

/** Open the surface on the current conversation. */
export function openEditor() {
  if (mounted !== null || reactDom === undefined) return
  const host = document.body.appendChild(document.createElement('div'))
  host.className = 'cs-ed-root'
  const root = reactDom.createRoot(host)
  const close = () => {
    root.unmount()
    host.remove()
    mounted = null
  }
  mounted = { host, close }
  root.render(h(CaptureEditor, { onClose: close }))
}

/** Close the surface if it is open. */
export function closeEditor() {
  if (mounted !== null) mounted.close()
}



