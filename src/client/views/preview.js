/**
 * The interactive preview at the top of the settings section.
 *
 * A miniature transcript, drawn with the host's own components and the same markers the capture
 * reads. Clicking a piece hides it, clicking it again brings it back, and a right-click opens the
 * full menu: every toggle as a checkable item, plus the two text blocks. What the preview shows is
 * what `dom/clone.js` will prune and what `dom/inserts.js` will add, so the panel explains itself
 * without a paragraph per switch.
 */

import { h, native, useCallback, useRef, useState } from '../shell/runtime.js'
import { INSERT_MAX_CHARS } from '../shell/const.js'
import { useOptions, resetOptions, writeOptions } from '../shell/options.js'
import { useTranslate } from '../shell/i18n.js'

/** The six pieces the capture can drop, in the order the preview stacks them. */
const PIECES = [
  { id: 'nav', flag: 'hideNav' },
  { id: 'attachments', flag: 'hideAttachments' },
  { id: 'process', flag: 'hideProcess' },
  { id: 'clock', flag: 'hideClock' },
  { id: 'toBottom', flag: 'hideToBottom' },
  { id: 'handles', flag: 'hideHandles' },
]

/** A piece's name, in the reader's language. Literal keys so the i18n check can see them. */
export function pieceLabel(t, id) {
  if (id === 'nav') return t('settings.piece.nav')
  if (id === 'attachments') return t('settings.piece.attachments')
  if (id === 'process') return t('settings.piece.process')
  if (id === 'clock') return t('settings.piece.clock')
  if (id === 'toBottom') return t('settings.piece.toBottom')
  if (id === 'handles') return t('settings.piece.handles')
  if (id === 'head') return t('settings.piece.head')
  if (id === 'foot') return t('settings.piece.foot')
  if (id === 'meta') return t('settings.piece.meta')
  if (id === 'divider') return t('settings.piece.divider')
  return id
}

/** One hideable piece: a hit area when it is shown, a dashed reminder when it is not. */
function Piece({ id, label, hidden, onToggle, onContextMenu, children, className }) {
  return h(
    'div',
    {
      className: `cs-prev-piece ${hidden ? 'is-off' : ''} ${className ?? ''}`.trim(),
      onClick: onToggle,
      onContextMenu,
      role: 'button',
      tabIndex: 0,
      onKeyDown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggle()
        }
      },
      title: label,
    },
    hidden ? h('span', { className: 'cs-prev-off' }, label) : children,
  )
}

/** The header block: two lines of prose, or a placeholder when both are empty. */
function HeadBlock({ options, t, onEdit, onContextMenu }) {
  const empty = options.title.length === 0 && options.subtitle.length === 0
  return h(
    'div',
    {
      className: `cs-prev-insert ${empty ? 'is-empty' : ''}`.trim(),
      onClick: onEdit,
      onContextMenu,
      role: 'button',
      tabIndex: 0,
      title: t('settings.menu.head'),
    },
    empty
      ? h('span', { className: 'cs-prev-off' }, `+ ${t('settings.menu.head')}`)
      : [
          h('div', { key: 'title', className: 'cs-prev-title' }, options.title || t('settings.edit.untitled')),
          options.subtitle.length > 0
            ? h('div', { key: 'sub', className: 'cs-prev-subtitle' }, options.subtitle)
            : null,
          options.divider ? h('div', { key: 'rule', className: 'cs-prev-rule' }) : null,
        ],
  )
}

/** The footer block: the reader's own line, then the metadata line the capture can add. */
function FootBlock({ options, t, onEdit, onContextMenu }) {
  const empty = options.footer.length === 0 && !options.showMeta
  return h(
    'div',
    {
      className: `cs-prev-insert ${empty ? 'is-empty' : ''}`.trim(),
      onClick: onEdit,
      onContextMenu,
      role: 'button',
      tabIndex: 0,
      title: t('settings.menu.foot'),
    },
    empty
      ? h('span', { className: 'cs-prev-off' }, `+ ${t('settings.menu.foot')}`)
      : [
          options.divider ? h('div', { key: 'rule', className: 'cs-prev-rule' }) : null,
          options.footer.length > 0
            ? h('div', { key: 'text', className: 'cs-prev-footer' }, options.footer)
            : null,
          options.showMeta
            ? h('div', { key: 'meta', className: 'cs-prev-meta' }, t('insert.metaSample'))
            : null,
        ],
  )
}

/** The editor behind a click on either inserted block. */
function EditModal({ mode, draft, t, onChange, onClose, onSave }) {
  const Modal = native?.Modal
  const Input = native?.Input
  const Switch = native?.Switch
  const Button = native?.Button
  if (!Modal) return null

  const head = mode === 'head'
  const field = (key, label, placeholder, maxLength) =>
    h(
      'label',
      { key, className: 'cs-prev-field' },
      h('span', { className: 'cs-set-label' }, label),
      Input
        ? h(Input, {
            className: 'cs-prev-input',
            value: draft[key],
            maxLength,
            placeholder,
            onChange: (event) => onChange(key, event.target.value),
          })
        : h('input', {
            className: 'cs-prev-input',
            value: draft[key],
            maxLength,
            placeholder,
            onChange: (event) => onChange(key, event.target.value),
          }),
    )

  const toggle = (key, label) =>
    Switch
      ? h(Switch, { key, checked: draft[key], label, onChange: (next) => onChange(key, next) })
      : h(
          'label',
          { key, className: 'cs-set-row cs-set-row-check' },
          h('span', { className: 'cs-set-label' }, label),
          h('input', {
            className: 'cs-set-box',
            type: 'checkbox',
            checked: draft[key],
            onChange: (event) => onChange(key, event.target.checked),
          }),
        )

  const footer = Button
    ? [
        h(Button, { key: 'cancel', variant: 'ghost', size: 'sm', onClick: onClose }, t('settings.edit.cancel')),
        h(Button, { key: 'save', variant: 'primary', size: 'sm', onClick: onSave }, t('settings.edit.save')),
      ]
    : [
        h('button', { key: 'cancel', type: 'button', className: 'cs-set-reset', onClick: onClose }, t('settings.edit.cancel')),
        h('button', { key: 'save', type: 'button', className: 'cs-set-reset', onClick: onSave }, t('settings.edit.save')),
      ]

  return h(
    Modal,
    {
      open: true,
      onClose,
      title: head ? t('settings.menu.head') : t('settings.menu.foot'),
      closeLabel: t('settings.edit.cancel'),
      footer,
    },
    h(
      'div',
      { className: 'cs-prev-editor' },
      head
        ? field('title', t('settings.edit.title'), t('settings.add.titlePlaceholder'), INSERT_MAX_CHARS.title)
        : field('footer', t('settings.edit.footer'), t('insert.metaSample'), INSERT_MAX_CHARS.footer),
      head
        ? field('subtitle', t('settings.edit.subtitle'), t('settings.add.titlePlaceholder'), INSERT_MAX_CHARS.subtitle)
        : null,
      h('p', { className: 'cs-set-desc' }, t('settings.edit.tokens')),
      toggle('divider', t('settings.piece.divider')),
      head ? null : toggle('showMeta', t('settings.piece.meta')),
    ),
  )
}

/** The panel: the mock transcript, its menu, and the editor it opens. */
export function Preview() {
  const t = useTranslate()
  const options = useOptions()
  const [open, setOpen] = useState(false)
  const [point, setPoint] = useState({ x: 0, y: 0 })
  const [draft, setDraft] = useState(null)
  const countRef = useRef(0)

  const toggle = useCallback((flag) => {
    writeOptions({ [flag]: !options[flag] })
  }, [options])

  const openMenu = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    setPoint({ x: event.clientX, y: event.clientY })
    setOpen(true)
  }, [])

  const edit = useCallback((mode) => {
    countRef.current += 1
    setOpen(false)
    setDraft({
      mode,
      title: options.title,
      subtitle: options.subtitle,
      footer: options.footer,
      showMeta: options.showMeta,
      divider: options.divider,
    })
  }, [options])

  const Menu = native?.Menu
  const hiddenIds = PIECES.filter((piece) => options[piece.flag]).map((piece) => piece.flag)
  const items = [
    ...PIECES.map((piece) => ({ id: piece.flag, label: pieceLabel(t, piece.id) })),
    { type: 'separator', id: 'sep-inserts' },
    { id: 'head', label: options.title.length > 0 || options.subtitle.length > 0 ? t('settings.menu.headEdit') : t('settings.menu.head') },
    { id: 'foot', label: options.footer.length > 0 || options.showMeta ? t('settings.menu.footEdit') : t('settings.menu.foot') },
    { type: 'separator', id: 'sep-reset' },
    { id: 'reset', label: t('settings.reset'), danger: true },
  ]

  const onSelect = (id) => {
    if (id === 'head' || id === 'foot') {
      edit(id)
      return
    }
    setOpen(false)
    if (id === 'reset') {
      resetOptions()
      return
    }
    if (id in options) toggle(id)
  }

  const piece = (id, children, className) => {
    const entry = PIECES.find((candidate) => candidate.id === id)
    return h(
      Piece,
      {
        key: id,
        id,
        label: pieceLabel(t, id),
        hidden: Boolean(options[entry.flag]),
        onToggle: () => toggle(entry.flag),
        onContextMenu: openMenu,
        className,
      },
      children,
    )
  }

  return h(
    'div',
    { className: 'cs-prev-wrap' },
    h(
      'div',
      {
        className: `cs-prev align-${options.align}`,
        style: { padding: `${options.edge}px` },
        onContextMenu: openMenu,
      },
      piece('nav', h('span', { className: 'cs-prev-rail' }, t('settings.sample.nav'))),
      h(HeadBlock, { options, t, onEdit: () => edit('head'), onContextMenu: openMenu }),
      h(
        'div',
        { className: 'cs-prev-turn' },
        h('div', { className: 'cs-prev-bubble' }, t('settings.sample.user')),
        piece('attachments', h('div', { className: 'cs-prev-files' }, t('settings.sample.files'))),
        piece('process', h('div', { className: 'cs-prev-think' }, t('settings.sample.process'))),
        h('div', { className: 'cs-prev-answer' }, t('settings.sample.answer')),
        piece('clock', h('span', { className: 'cs-prev-clock' }, t('settings.sample.clock'))),
      ),
      h(FootBlock, { options, t, onEdit: () => edit('foot'), onContextMenu: openMenu }),
      piece('toBottom', h('span', { className: 'cs-prev-chip' }, t('settings.sample.toBottom'))),
      piece('handles', h('span', { className: 'cs-prev-chip' }, t('settings.sample.handles'))),
    ),
    Menu
      ? h(Menu, {
          open,
          anchorPoint: point,
          items,
          selectedIds: hiddenIds,
          onSelect,
          onClose: () => setOpen(false),
          portal: true,
          align: 'start',
        })
      : null,
    draft
      ? h(EditModal, {
          mode: draft.mode,
          draft,
          t,
          onChange: (key, value) => setDraft((current) => ({ ...current, [key]: value })),
          onClose: () => setDraft(null),
          onSave: () => {
            const patch = draft.mode === 'head'
              ? { title: draft.title, subtitle: draft.subtitle, divider: draft.divider }
              : { footer: draft.footer, showMeta: draft.showMeta, divider: draft.divider }
            writeOptions(patch)
            setDraft(null)
          },
        })
      : null,
  )
}
