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
  DOCK_HEIGHT,
  DOCK_RATIO,
  FIELD_ATTRIBUTE,
  PEEK_MS,
  PRESET_COMPONENTS,
  SCROLL_ATTRIBUTE,
  STYLE_PROPS,
} from '../../shell/const.js'
import { useTranslate } from '../../shell/i18n.js'
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
  saveRule,
  storeCustom,
  updateBlock,
  useOptions,
  writeOptions,
} from '../../shell/options.js'
import { autoName, elementKey } from '../../dom/clone/rules.js'
import { buildStage } from '../../dom/stage.js'
import { native, h, react, reactDom, useEffect, useEscapeToClose, useRef, useState, useMemo } from '../../shell/runtime.js'
import { describeSelected, entryLabel, kindLabel } from './labels.js'
import { BLOCK_PAYLOAD, dropTarget, readDrag, writeDrag } from './drag.js'
import { libraryView } from './library.js'
import { blockInspector, elementInspector } from './inspector.js'
import { contentView } from './content.js'
import { componentEditor } from './components.js'
import { dockView } from './dock.js'

/** The conversation the surface covers, or null when there is none on screen. */
function findConversation() {
  const scroller = document.querySelector(`[${SCROLL_ATTRIBUTE}]`)
  if (!(scroller instanceof HTMLElement) || scroller.clientWidth < 1) return null
  return scroller
}

/** A block's content without the place it holds in the picture, which is what a component stores. */
function blockShape(block) {
  const { id, zone, ...shape } = block
  return shape
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
  const [rowMenu, setRowMenu] = useState(null)
  useEscapeToClose(menu !== null, () => setMenu(null))
  useEscapeToClose(rowMenu !== null, () => setRowMenu(null))
  const [tab, setTab] = useState('content')
  const [dockHeight, setDockHeight] = useState(DOCK_HEIGHT)
  const [dockFolded, setDockFolded] = useState(false)
  const [dockDragging, setDockDragging] = useState(false)
  const [addZone, setAddZone] = useState('bottom')
  const [drag, setDrag] = useState(null)
  const [draftProp, setDraftProp] = useState(STYLE_PROPS[0])
  const [draftValue, setDraftValue] = useState('')
  const [draftAttr, setDraftAttr] = useState('')
  const [draftAttrValue, setDraftAttrValue] = useState('')
  const [draftComponent, setDraftComponent] = useState(null)

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
      setTab('content')
      return id
    }

    const choose = (node) => {
      const selector = elementKey(node, clone)
      setSelection({ type: 'element', selector, tag: node.tagName.toLowerCase(), text: autoName(node) })
      setTab('element')
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

  // What is selected is outlined where it sits: an element by its selector, a block by its id, so the
  // tray always says which thing it is talking about. A hidden element has no box, so it cannot be
  // outlined — its chip locates it instead.
  useEffect(() => {
    const stage = stageRef.current
    if (stage === null || selection === null) return undefined
    let marked = null
    try {
      marked =
        selection.type === 'block'
          ? stage.clone.querySelector(`[${BLOCK_ATTRIBUTE}="${selection.id}"]`)
          : stage.clone.querySelector(selection.selector)
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
      // Escape belongs to the innermost thing that is open: a host menu or dialog closes itself
      // first, and anything a field was typed into gives up its focus. Only a bare Escape leaves.
      if (document.querySelector('[role="menu"], [role="dialog"]') !== null) return
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
  const restore = (entry, quiet = false) => {
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
    if (!quiet) bump()
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

  /**
   * Place a component at the end of the zone the shelf points at, for a click instead of a drag.
   *
   * The shelf stays open: adding content is a run of small decisions and the picture is already showing
   * the result, so leaving the shelf after every click would hide the one place the next click comes
   * from. The new block is selected, which outlines it in the picture and focuses the content tab's
   * inspector the moment the reader goes there.
   */
  const placeComponent = (entry) => {
    const created = addBlock(addZone, { ...entry.block, zone: addZone })
    if (created === null) return
    setSelection({ type: 'block', id: created.id })
    bump()
  }

  /** Open one component of the shelf in the designer; a shipped one opens as a copy. */
  const editComponent = (entry) => {
    const builtin = entry.builtin === true
    const label = kindLabel(t, entry.block.kind)
    setDraftComponent({
      id: builtin ? null : entry.id,
      name: builtin ? `${label} ${t('settings.editor.component.copySuffix')}` : entry.name,
      block: { ...entry.block },
      builtin,
    })
    setTab('library')
    setPick(false)
  }

  /** Save the selected block as a component: the same designer, with that block as the draft. */
  const saveAsComponent = () => {
    if (blockSelection === null) return
    setDraftComponent({
      id: null,
      name: `${kindLabel(t, blockSelection.kind)} ${t('settings.editor.component.copySuffix')}`,
      block: blockShape(blockSelection),
      builtin: false,
    })
    setTab('library')
    setPick(false)
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

  /** Put every hidden entry back in one go, with one rebuild instead of one per entry. */
  const restoreAll = () => {
    for (const entry of hiddenEntries) restore(entry, true)
    bump()
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
          onSaveAsComponent: saveAsComponent,
          onRemove: () => {
            removeBlock(blockSelection.id)
            setSelection(null)
            bump()
          },
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
    Button,
    Menu,
    options,
    selection: blockSelection,
    editingId: draftComponent === null ? null : draftComponent.id,
    zone: addZone,
    onPlace: placeComponent,
    onEdit: editComponent,
    onDelete: (id) => {
      dropCustom(id)
      setDraftComponent((current) => (current !== null && current.id === id ? null : current))
      bump()
    },
    onZone: (next) => setAddZone(next),
    onToken: addToken,
    onNew: () => {
      setDraftComponent({ id: null, name: '', block: { kind: 'text', text: '', size: 'body', align: 'left' }, builtin: false })
      setTab('library')
      setPick(false)
    },
    onDrag: (payload) => {
      writeDrag(payload)
      setDrag(null)
    },
  })

  const composer = h(componentEditor, {
    t,
    Menu,
    Button,
    draft: draftComponent,
    onChange: (patch) => setDraftComponent((current) => ({ ...current, ...patch })),
    onSave: () => {
      const stored = storeCustom(draftComponent.id, draftComponent.name, draftComponent.block)
      if (stored === null) return
      setDraftComponent(null)
      bump()
    },
    onDelete: () => {
      if (draftComponent.id !== null) dropCustom(draftComponent.id)
      setDraftComponent(null)
      bump()
    },
    onCancel: () => setDraftComponent(null),
  })

  const tabs = [
    { id: 'content', label: t('settings.editor.tab.content'), count: options.blocks.length },
    { id: 'element', label: t('settings.editor.tab.element'), count: hiddenEntries.length },
    { id: 'library', label: t('settings.editor.tab.library'), count: PRESET_COMPONENTS.length + options.custom.length },
  ]

  const hiddenSection = h(
    'div',
    { className: 'cs-ed-hidden' },
    h(
      'div',
      { className: 'cs-ed-panel-head' },
      h('span', { className: 'cs-ed-label' }, t('settings.editor.hidden')),
      hiddenEntries.length === 0
        ? null
        : h('button', { type: 'button', className: 'cs-ed-mini', onClick: () => restoreAll() }, t('settings.editor.hiddenRestoreAll')),
    ),
    hiddenEntries.length === 0
      ? h('div', { className: 'cs-ed-hintline' }, t('settings.editor.hiddenEmpty'))
      : h(
          'div',
          { className: 'cs-ed-chips' },
          ...hiddenEntries.map((entry) =>
            h(
              'button',
              {
                key: entry.kind + ':' + entry.id,
                type: 'button',
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
  )

  const contentBody = h(
    'div',
    { className: 'cs-ed-split' },
    h(
      'div',
      { className: 'cs-ed-split-main' },
      h(contentView, {
        t,
        options,
        selection,
        onSelect: (id) => setSelection({ type: 'block', id }),
        onAddZone: (zone) => {
          setAddZone(zone)
          setTab('library')
          setPick(false)
        },
        onRowMenu: (next) => setRowMenu(next),
      }),
    ),
    h(
      'div',
      { className: 'cs-ed-split-side' },
      blockSelection !== null
        ? h('div', { className: 'cs-ed-panel' }, h('div', { className: 'cs-ed-panel-head' }, kindLabel(t, blockSelection.kind)), inspector)
        : h('div', { className: 'cs-ed-empty-note' }, t('settings.editor.content.pickBlock')),
    ),
  )

  const elementBody = h(
    'div',
    { className: 'cs-ed-split' },
    h('div', { className: 'cs-ed-split-side is-narrow' }, hiddenSection),
    h(
      'div',
      { className: 'cs-ed-split-main' },
      elementSelection !== null
        ? h('div', { className: 'cs-ed-panel' }, h('div', { className: 'cs-ed-panel-head' }, elementSelection.tag), inspector)
        : h('div', { className: 'cs-ed-empty-note' }, t('settings.editor.side.none')),
    ),
  )

  const libraryBody = h(
    'div',
    { className: 'cs-ed-libwrap' },
    h('div', { className: 'cs-ed-split' }, h('div', { className: 'cs-ed-split-main' }, library), h('div', { className: 'cs-ed-split-side' }, draftComponent === null ? h('div', { className: 'cs-ed-empty-note' }, t('settings.editor.component.empty')) : composer)),
  )

  const body = tab === 'library' ? libraryBody : tab === 'element' ? elementBody : contentBody

  const rowMenuItems =
    rowMenu === null
      ? []
      : [
          { id: 'rowTop', label: t('settings.editor.block.toTop') },
          { id: 'rowBottom', label: t('settings.editor.block.toBottom') },
          { type: 'separator' },
          { id: 'rowDelete', label: t('settings.editor.block.delete'), danger: true },
        ]

  const onRowMenu = (id) => {
    const current = rowMenu
    setRowMenu(null)
    if (current === null) return
    if (id === 'rowDelete') {
      removeBlock(current.id)
      setSelection(null)
      bump()
      return
    }
    if (id === 'rowTop') {
      moveBlock(current.id, 'top', 99)
      bump()
      return
    }
    if (id === 'rowBottom') {
      moveBlock(current.id, 'bottom', 99)
      bump()
    }
  }

  const onResizeStart = (event) => {
    if (typeof event.button === 'number' && event.button !== 0) return
    event.preventDefault()
    const startY = event.clientY
    const startHeight = dockFolded ? DOCK_MIN : dockHeight
    const limit = Math.max(DOCK_MIN, Math.round((pane === null ? 600 : pane.height) * DOCK_RATIO))
    setDockDragging(true)
    setDockFolded(false)
    const move = (moveEvent) => {
      const next = startHeight + (startY - moveEvent.clientY)
      setDockHeight(Math.max(DOCK_MIN, Math.min(limit, next)))
    }
    const stop = () => {
      setDockDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
    // A drag that leaves the window never delivers pointerup, so the strip would follow the pointer
    // forever; a cancelled pointer and a lost focus both end it in place.
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
  }

  const toggleDock = () => setDockFolded((value) => value !== true)

  return h(
    'div',
    {
      className: pick ? 'cs-ed-wrap is-pick' : 'cs-ed-wrap',
      style:
        pane === null
          ? undefined
          : { left: pane.left + 'px', top: pane.top + 'px', width: pane.width + 'px', height: pane.height + 'px' },
    },
    missing ? h('div', { className: 'cs-ed-empty' }, t('settings.editor.noConversation')) : null,
    h('div', { className: 'cs-ed-canvas' }, h('div', { className: 'cs-ed-host', ref: hostRef, onDragOver: onDragOver, onDragLeave: onDragLeave, onDrop: onDrop })),
    drag === null ? null : h('div', { className: 'cs-ed-drop', style: { top: drag.y + 'px' } }),
    h(dockView, {
      t,
      Button,
      tabs,
      current: tab,
      onTab: (id) => {
        setTab(id)
        setRowMenu(null)
      },
      pick,
      onPick: () => {
        const next = pick !== true
        setPick(next)
        if (next) setSelection(null)
      },
      onReset: () => {
        resetOptions()
        setSelection(null)
        bump()
      },
      onDone: onClose,
      collapsed: dockFolded,
      onToggle: toggleDock,
      body,
      height: dockHeight,
      dragging: dockDragging,
      onResizeStart,
    }),
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
    h(Menu, {
      open: rowMenu !== null,
      anchorPoint: rowMenu === null ? undefined : { x: rowMenu.x, y: rowMenu.y },
      align: 'start',
      portal: true,
      items: rowMenuItems,
      selectedIds: [],
      onSelect: onRowMenu,
      onClose: () => setRowMenu(null),
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

/** The mounted surface, so a second open is a no-op and a close can reach it. */
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



