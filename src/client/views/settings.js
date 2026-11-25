/**
 * The settings panel: a miniature of the capture, the menu it answers to, and three choices about
 * the layout.
 *
 * The preview is the form. Every chrome piece can be switched off by clicking it in the mock
 * transcript, every added block is edited where it will appear, and the menu behind a right-click
 * repeats all of it as checkable items for anyone who prefers a list. Values are written through
 * `writeOptions`, so a change applies to the next capture and survives a reload without a host
 * round-trip.
 */

import { h, native, useState } from '../shell/runtime.js'
import { useTranslate } from '../shell/i18n.js'
import { resetOptions, useOptions, writeOptions } from '../shell/options.js'
import { EDGE_CHOICES, SCALE_CHOICES } from '../shell/const.js'
import { Preview } from './preview.js'

/** One choice out of a short list, opened from a native menu when the host ships one. */
function MenuRow({ title, description, value, entries, onSelect }) {
  const [open, setOpen] = useState(false)
  const [point, setPoint] = useState({ x: 0, y: 0 })
  const Menu = native?.Menu
  const Button = native?.Button
  const shown = entries.find((entry) => entry[0] === value)

  if (!Menu || !Button) {
    return h(
      'label',
      { className: 'cs-set-row' },
      h(
        'span',
        { className: 'cs-set-text' },
        h('span', { className: 'cs-set-label' }, title),
        h('span', { className: 'cs-set-desc' }, description),
      ),
      h(
        'select',
        { className: 'cs-set-select', value, onChange: (event) => onSelect(event.target.value) },
        entries.map(([optionValue, optionLabel]) =>
          h('option', { key: optionValue, value: optionValue }, optionLabel),
        ),
      ),
    )
  }

  return h(
    'div',
    { className: 'cs-set-row' },
    h(
      'span',
      { className: 'cs-set-text' },
      h('span', { className: 'cs-set-label' }, title),
      h('span', { className: 'cs-set-desc' }, description),
    ),
    h(
      'div',
      { className: 'cs-set-picker' },
      h(Button, {
        variant: 'outline',
        size: 'sm',
        onClick: (event) => {
          const box = event.currentTarget.getBoundingClientRect()
          setPoint({ x: box.left, y: box.bottom + 4 })
          setOpen((current) => !current)
        },
      }, shown ? shown[1] : value),
      h(Menu, {
        open,
        anchorPoint: point,
        align: 'end',
        side: 'bottom',
        selectedId: value,
        items: entries.map(([optionValue, optionLabel]) => ({ id: optionValue, label: optionLabel })),
        onSelect: (id) => {
          setOpen(false)
          onSelect(id)
        },
        onClose: () => setOpen(false),
      }),
    ),
  )
}

/** The section body mounted at `settings.section`. */
export function SettingsSection() {
  const t = useTranslate()
  const options = useOptions()

  return h(
    'div',
    { className: 'cs-set' },
    h('p', { className: 'cs-set-intro' }, t('settings.intro')),
    h(Preview, {}),
    h('p', { className: 'cs-set-desc cs-prev-hint' }, t('settings.previewHint')),

    h(MenuRow, {
      title: t('settings.layout.align'),
      description: t('settings.layout.alignHint'),
      value: options.align,
      entries: [
        ['left', t('settings.align.left')],
        ['center', t('settings.align.center')],
      ],
      onSelect: (value) => writeOptions({ align: value }),
    }),
    h(MenuRow, {
      title: t('settings.layout.edge'),
      description: t('settings.layout.edgeHint'),
      value: String(options.edge),
      entries: [
        [String(EDGE_CHOICES[0]), t('settings.edge.tight')],
        [String(EDGE_CHOICES[1]), t('settings.edge.normal')],
        [String(EDGE_CHOICES[2]), t('settings.edge.loose')],
      ],
      onSelect: (value) => writeOptions({ edge: Number(value) }),
    }),
    h(MenuRow, {
      title: t('settings.layout.scale'),
      description: t('settings.layout.scaleHint'),
      value: options.scale,
      entries: [
        [SCALE_CHOICES[0], t('settings.scale.auto')],
        [SCALE_CHOICES[1], t('settings.scale.x1')],
        [SCALE_CHOICES[2], t('settings.scale.x2')],
        [SCALE_CHOICES[3], t('settings.scale.x3')],
      ],
      onSelect: (value) => writeOptions({ scale: value }),
    }),

    h(
      'div',
      { className: 'cs-set-foot' },
      h('span', { className: 'cs-set-desc' }, t('settings.resetHint')),
      h(
        'button',
        {
          type: 'button',
          className: 'cs-set-reset',
          onClick: () => resetOptions(),
        },
        t('settings.reset'),
      ),
    ),
  )
}
