/**
 * The edit surface, as a component.
 *
 * Two layers meet here. The frame, the inspector and the lists are React; the picture between them is
 * an element tree built imperatively by `dom/stage.js` — the same clone a capture renders, laid out at
 * full length. That split is deliberate: the clone has to be a copy of the live application, so it is
 * cloned from the DOM and handed to a container ref, while everything around it is ordinary UI.
 *
 * The surface is a small inspector rather than a form. Any element in the copy can be picked, named,
 * hidden or restyled, because a transcript is a web page and the parts worth dropping are not knowable
 * in advance: a host release adds rows, and another plugin paints its own. What the reader changed is
 * kept as a rule — a selector plus declarations — and the capture runs the same rules over the same
 * kind of copy, so the picture is what the surface showed.
 *
 * Hiding never deletes the element: it keeps its place in the copy with no box. That is what lets the
 * list at the bottom point at the hole and put the element back.
 */

import { buildStage } from '../dom/stage.js'
import { autoName, describeElement, elementKey } from '../dom/rules.js'
import { CHROME_PIECES } from '../dom/clone.js'
import {
  FIELD_ATTRIBUTE,
  FOOT_ATTRIBUTE,
  HEAD_ATTRIBUTE,
  PEEK_MS,
  RULE_PRESETS,
  SCROLL_ATTRIBUTE,
  STYLE_PROPS,
} from '../shell/const.js'
import {
  dropRule,
  readOptions,
  resetOptions,
  ruleFor,
  saveRule,
  useOptions,
  writeOptions,
} from '../shell/options.js'
import { native, h, reactDom, useEffect, useRef, useState, useMemo } from '../shell/runtime.js'
import { useTranslate } from '../shell/i18n.js'

/** The name of one built-in piece, for a chip and for the menu row. */
export function pieceLabel(t, id) {
  if (id === 'nav') return t('settings.piece.nav')
  if (id === 'attachments') return t('settings.piece.attachments')
  if (id === 'process') return t('settings.piece.process')
  if (id === 'clock') return t('settings.piece.clock')
  if (id === 'toBottom') return t('settings.piece.toBottom')
  if (id === 'handles') return t('settings.piece.handles')
  if (id === 'paging') return t('settings.piece.paging')
  if (id === 'composer') return t('settings.piece.composer')
  if (id === 'divider') return t('settings.piece.divider')
  if (id === 'meta') return t('settings.piece.meta')
  return id
}

/** The name of one style bundle. */
function presetLabel(t, id) {
  if (id === 'dim') return t('settings.editor.preset.dim')
  if (id === 'mark') return t('settings.editor.preset.mark')
  if (id === 'tight') return t('settings.editor.preset.tight')
  if (id === 'plain') return t('settings.editor.preset.plain')
  if (id === 'mono') return t('settings.editor.preset.mono')
  if (id === 'small') return t('settings.editor.preset.small')
  return id
}

/** One line in the hidden list: a built-in piece or a rule the reader wrote. */
function entryLabel(t, entry, options) {
  if (entry.kind === 'piece') return pieceLabel(t, entry.id)
  const rule = ruleFor(options, entry.selector)
  const name = rule === null ? entry.name : rule.name
  return name === '' ? entry.selector : name
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

/** Blur on Enter, so a field commits and the keyboard goes back to the picture. */
function commitOnEnter(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    event.currentTarget.blur()
  }
}

/**
 * The overlay.
 *
 * `revision` is the only thing that rebuilds the copy: a rule change changes the drawn picture, so the
 * copy is made again, while typing into an inserted field leaves the copy alone — the typed text is
 * already in it, and rebuilding on every keystroke would take the caret with it. The inspector keeps
 * its own drafts for the same reason.
 */
export function CaptureEditor({ onClose }) {
  const t = useTranslate()
  const options = useOptions()
  const hostRef = useRef(null)
  const stageRef = useRef(null)
  const timersRef = useRef([])
  const hitRef = useRef(null)
  const pickRef = useRef(false)
  const selectionRef = useRef(null)
  const [revision, setRevision] = useState(0)
  const [pane, setPane] = useState(paneRect)
  const [missing, setMissing] = useState(false)
  const [entries, setEntries] = useState([])
  const [selection, setSelection] = useState(null)
  const [pick, setPick] = useState(false)
  const [menu, setMenu] = useState(null)
  const [draftProp, setDraftProp] = useState(STYLE_PROPS[0])
  const [draftValue, setDraftValue] = useState('')
  const [draftAttr, setDraftAttr] = useState('')
  const [draftAttrValue, setDraftAttrValue] = useState('')

  pickRef.current = pick
  selectionRef.current = selection

  const labels = useMemo(
    () => ({
      title: t('settings.edit.title'),
      subtitle: t('settings.edit.subtitle'),
      footer: t('settings.edit.footer'),
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
      title: String(labels.title),
      subtitle: String(labels.subtitle),
      footer: String(labels.footer),
    })
    stageRef.current = stage
    setEntries(stage.entries)
    if (hostRef.current !== null) {
      const host = hostRef.current
      host.replaceChildren(stage.element)
      // Only now does the copy have boxes: a detached tree measures as zero and the frame would
      // collapse to nothing, so the band is cut after mounting.
      stage.frame()
      // The copy is as wide as the picture; the inspector side panel takes width away from the host.
      // Shrinking with `zoom` keeps the copy's own layout intact, so what is shown is still the picture.
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

    const choose = (node) => {
      const selector = elementKey(node, clone)
      setSelection({ selector, tag: node.tagName.toLowerCase(), text: autoName(node) })
      return selector
    }

    const onClick = (event) => {
      const node = elementOf(event)
      if (node === null) return
      event.stopPropagation()
      if (isField(node)) return
      event.preventDefault()
      choose(node)
    }

    const onDoubleClick = (event) => {
      const node = elementOf(event)
      if (node === null || isField(node)) return
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
      if (node === null || isField(node)) return
      event.preventDefault()
      event.stopPropagation()
      // A right click on the header or the footer also reaches the two shared switches: the divider
      // above the transcript and the metadata line under it have no element of their own.
      const block =
        node.closest(`[${HEAD_ATTRIBUTE}]`) !== null
          ? 'head'
          : node.closest(`[${FOOT_ATTRIBUTE}]`) !== null
            ? 'foot'
            : null
      setMenu({ x: event.clientX, y: event.clientY, selector: choose(node), block })
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
      const name = field.getAttribute(FIELD_ATTRIBUTE)
      const text = field.textContent ?? ''
      if (text === '') field.setAttribute('data-empty', 'true')
      else field.removeAttribute('data-empty')
      writeOptions({ [name]: text })
    }

    const onKeyDown = (event) => {
      const node = elementOf(event)
      if (node === null) return
      const field = node.closest(`[${FIELD_ATTRIBUTE}]`)
      if (field !== null && event.key === 'Enter') {
        event.preventDefault()
        field.blur()
      }
    }

    root.addEventListener('click', onClick)
    root.addEventListener('dblclick', onDoubleClick)
    root.addEventListener('contextmenu', onContextMenu)
    root.addEventListener('mousemove', onMove)
    root.addEventListener('input', onInput)
    root.addEventListener('keydown', onKeyDown)
    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('dblclick', onDoubleClick)
      root.removeEventListener('contextmenu', onContextMenu)
      root.removeEventListener('mousemove', onMove)
      root.removeEventListener('input', onInput)
      root.removeEventListener('keydown', onKeyDown)
      if (hitRef.current !== null) hitRef.current.classList.remove('cs-ed-hit')
      hitRef.current = null
    }
  }, [revision])

  // The picked element is outlined where it sits, so the inspector always says which element it is
  // talking about. A hidden element has no box, so it cannot be outlined — its chip locates it instead.
  useEffect(() => {
    const stage = stageRef.current
    if (stage === null) return undefined
    let marked = null
    if (selection !== null) {
      try {
        marked = stage.clone.querySelector(selection.selector)
      } catch {
        marked = null
      }
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
        if (active.tagName === 'INPUT') {
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

  const rule = selection === null ? null : ruleFor(options, selection.selector)

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

  /** Put one hidden entry back into the picture. */
  const restore = (entry) => {
    if (entry.kind === 'piece') writeOptions({ [entry.option]: false })
    else saveRule(entry.selector, { hide: false })
    bump()
  }

  const patchRule = (patch) => {
    if (selection === null) return
    const current = ruleFor(readOptions(), selection.selector)
    saveRule(selection.selector, { name: current === null ? selection.text : current.name, ...patch })
    bump()
  }

  const setStyle = (prop, value) => {
    if (selection === null) return
    const current = ruleFor(readOptions(), selection.selector)
    const style = { ...(current === null ? {} : current.style) }
    const text = value.trim()
    if (text === '') delete style[prop]
    else style[prop] = text
    saveRule(selection.selector, { style })
    bump()
  }

  const setAttr = (name, value) => {
    if (selection === null) return
    const current = ruleFor(readOptions(), selection.selector)
    const attrs = { ...(current === null ? {} : current.attrs) }
    if (value === '') delete attrs[name]
    else attrs[name] = value
    saveRule(selection.selector, { attrs })
    bump()
  }

  const menuItems = []
  if (menu !== null) {
    const current = ruleFor(options, menu.selector)
    const hidden = current !== null && current.hide === true
    menuItems.push({ id: 'toggle', label: hidden ? t('settings.editor.restore') : t('settings.editor.hide') })
    if (current !== null) menuItems.push({ id: 'remove', label: t('settings.editor.removeRule'), danger: true })
    if (menu.block === 'head' || menu.block === 'foot') {
      menuItems.push({ type: 'separator' })
      menuItems.push({
        id: menu.block === 'head' ? 'divider' : 'meta',
        label: menu.block === 'head' ? pieceLabel(t, 'divider') : pieceLabel(t, 'meta'),
      })
    }
    menuItems.push({ type: 'separator' })
    menuItems.push({ id: 'reset', label: t('settings.reset'), danger: true })
  }

  const onMenu = (id) => {
    const selector = menu === null ? null : menu.selector
    setMenu(null)
    if (selector === null) return
    if (id === 'reset') {
      resetOptions()
      bump()
      return
    }
    if (id === 'divider') {
      writeOptions({ divider: readOptions().divider !== true })
      bump()
      return
    }
    if (id === 'meta') {
      writeOptions({ showMeta: readOptions().showMeta !== true })
      bump()
      return
    }
    if (id === 'remove') {
      dropRule(selector)
      setSelection(null)
      bump()
      return
    }
    const current = ruleFor(readOptions(), selector)
    saveRule(selector, { hide: current === null ? true : current.hide !== true })
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
  const detail = selection === null || stageRef.current === null ? null : describeSelected(stageRef.current.clone, selection.selector)

  const side =
    selection === null
      ? h('div', { className: 'cs-ed-side-empty' }, t('settings.editor.side.none'))
      : h(
          'div',
          { className: 'cs-ed-side' },
          h(
            'div',
            { className: 'cs-ed-side-head' },
            h('span', { className: 'cs-ed-side-tag' }, selection.tag),
            h('span', { className: 'cs-ed-side-text' }, selection.text),
          ),
          h('div', { className: 'cs-ed-mono' }, selection.selector),
          h(
            'div',
            { className: 'cs-ed-row' },
            h('span', { className: 'cs-ed-label' }, t('settings.editor.side.hide')),
            h(Switch, {
              checked: rule !== null && rule.hide === true,
              onChange: () => patchRule({ hide: rule === null ? true : rule.hide !== true }),
            }),
          ),
          h(
            'div',
            { className: 'cs-ed-field-row' },
            h('div', { className: 'cs-ed-label' }, t('settings.editor.side.name')),
            h('input', {
              className: 'cs-ed-input',
              defaultValue: rule === null ? selection.text : rule.name,
              key: `name-${selection.selector}-${rule === null ? '' : rule.name}`,
              onKeyDown: commitOnEnter,
              onBlur: (event) => patchRule({ name: event.target.value }),
            }),
          ),
          h('div', { className: 'cs-ed-label' }, t('settings.editor.side.presets')),
          h(
            'div',
            { className: 'cs-ed-presets' },
            ...RULE_PRESETS.map((preset) =>
              h(
                'button',
                {
                  type: 'button',
                  className: 'cs-ed-mini',
                  key: preset.id,
                  onClick: () => {
                    const current = ruleFor(readOptions(), selection.selector)
                    saveRule(selection.selector, {
                      style: { ...(current === null ? {} : current.style), ...preset.style },
                    })
                    bump()
                  },
                },
                presetLabel(t, preset.id),
              ),
            ),
          ),
          h('div', { className: 'cs-ed-label' }, t('settings.editor.side.style')),
          ...styleKeys.map((prop) =>
            h(
              'div',
              { className: 'cs-ed-row', key: `style-${prop}` },
              h('span', { className: 'cs-ed-prop', title: prop }, prop),
              h('input', {
                className: 'cs-ed-input',
                defaultValue: rule.style[prop],
                onKeyDown: commitOnEnter,
                onBlur: (event) => setStyle(prop, event.target.value),
              }),
              h(
                'button',
                { type: 'button', className: 'cs-ed-mini', onClick: () => setStyle(prop, ''), title: t('settings.editor.side.remove') },
                '×',
              ),
            ),
          ),
          h(
            'div',
            { className: 'cs-ed-row' },
            h(
              'select',
              {
                className: 'cs-ed-input',
                value: draftProp,
                onChange: (event) => setDraftProp(event.target.value),
              },
              ...STYLE_PROPS.map((prop) => h('option', { key: prop, value: prop }, prop)),
            ),
            h('input', {
              className: 'cs-ed-input',
              placeholder: t('settings.editor.side.value'),
              value: draftValue,
              onChange: (event) => setDraftValue(event.target.value),
              onKeyDown: (event) => {
                if (event.key !== 'Enter') return
                setStyle(draftProp, draftValue)
                setDraftValue('')
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: 'cs-ed-mini',
                onClick: () => {
                  setStyle(draftProp, draftValue)
                  setDraftValue('')
                },
              },
              t('settings.editor.side.add'),
            ),
          ),
          h('div', { className: 'cs-ed-label' }, t('settings.editor.side.attrs')),
          ...attrKeys.map((name) =>
            h(
              'div',
              { className: 'cs-ed-row', key: `attr-${name}` },
              h('span', { className: 'cs-ed-prop', title: name }, name),
              h('input', {
                className: 'cs-ed-input',
                defaultValue: rule.attrs[name] ?? '',
                onKeyDown: commitOnEnter,
                onBlur: (event) => setAttr(name, event.target.value),
              }),
              h(
                'button',
                { type: 'button', className: 'cs-ed-mini', onClick: () => setAttr(name, ''), title: t('settings.editor.side.remove') },
                '×',
              ),
            ),
          ),
          h(
            'div',
            { className: 'cs-ed-row' },
            h('input', {
              className: 'cs-ed-input',
              placeholder: 'data-x',
              value: draftAttr,
              onChange: (event) => setDraftAttr(event.target.value),
            }),
            h('input', {
              className: 'cs-ed-input',
              placeholder: t('settings.editor.side.value'),
              value: draftAttrValue,
              onChange: (event) => setDraftAttrValue(event.target.value),
              onKeyDown: (event) => {
                if (event.key !== 'Enter') return
                setAttr(draftAttr.trim(), draftAttrValue)
                setDraftAttr('')
                setDraftAttrValue('')
              },
            }),
            h(
              'button',
              {
                type: 'button',
                className: 'cs-ed-mini',
                onClick: () => {
                  setAttr(draftAttr.trim(), draftAttrValue)
                  setDraftAttr('')
                  setDraftAttrValue('')
                },
              },
              t('settings.editor.side.add'),
            ),
          ),
          detail === null ? null : h('div', { className: 'cs-ed-note' }, detail),
          pureRuleNote(t),
        )

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
        h(
          Button,
          {
            variant: pick ? 'primary' : 'ghost',
            size: 'sm',
            onClick: () => {
              setPick((value) => !value)
              if (hitRef.current !== null) hitRef.current.classList.remove('cs-ed-hit')
              hitRef.current = null
            },
          },
          t('settings.editor.pick'),
        ),
        h(Button, { variant: 'ghost', size: 'sm', onClick: () => { resetOptions(); setSelection(null); bump() } }, t('settings.reset')),
        h(Button, { variant: 'primary', size: 'sm', onClick: onClose }, t('settings.editor.done')),
      ),
    ),
    h(
      'div',
      { className: 'cs-ed-body' },
      h('div', { className: 'cs-ed-host', ref: hostRef }),
      side,
    ),
    h(
      'div',
      { className: 'cs-ed-hidden' },
      h('span', { className: 'cs-ed-label' }, t('settings.editor.hidden')),
      hiddenEntries.length === 0
        ? h('span', { className: 'cs-ed-note' }, t('settings.editor.hiddenEmpty'))
        : null,
      ...hiddenEntries.map((entry) =>
        h(
          'button',
          {
            type: 'button',
            className: 'cs-ed-chip',
            key: `${entry.kind}-${entry.id}`,
            title: t('settings.editor.hiddenHint'),
            onClick: () => peek(entry),
            onDoubleClick: () => restore(entry),
          },
          h('span', { className: 'cs-ed-chip-part' }, entryLabel(t, entry, options)),
          entry.elements.length > 1 ? h('span', { className: 'cs-ed-chip-count' }, `${entry.elements.length}`) : null,
        ),
      ),
    ),
    menu === null
      ? null
      : h(Menu, {
          open: true,
          anchorPoint: { x: menu.x, y: menu.y },
          items: menuItems,
          onSelect: onMenu,
          onClose: () => setMenu(null),
          portal: true,
          align: 'start',
          side: 'bottom',
        }),
  )
}

/** The element's own facts, as one line of small print under the controls. */
function describeSelected(clone, selector) {
  let node
  try {
    node = clone.querySelector(selector)
  } catch {
    node = null
  }
  if (node === null) return null
  const facts = describeElement(node)
  const parts = [facts.tag]
  if (facts.children > 0) parts.push(`${facts.children} children`)
  const names = Object.keys(facts.attrs)
  if (names.length > 0) parts.push(names.join(' '))
  return parts.join(' · ')
}

/** A reminder that nothing is applied until the reader means it: a rule, not a temporary edit. */
function pureRuleNote(t) {
  return h('div', { className: 'cs-ed-note' }, t('settings.editor.side.ruleNote'))
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
